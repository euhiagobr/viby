
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { gerarCapaCidade } from '@/ai/flows/gerar-capa-cidade-flow';
import { logSystemError } from '@/lib/error-manager';

/**
 * @fileOverview Server Actions para gestão de metadados e capas de cidades.
 */

export async function getOrTriggerCityCover(params: {
  slug: string;
  city: string;
  state: string;
  country: string;
  categories?: string[];
}) {
  const db = getAdminDb();
  const cityPageRef = db.collection('cityPages').doc(params.slug);
  
  try {
    const snap = await cityPageRef.get();
    
    if (!snap.exists) {
      await cityPageRef.set({
        slug: params.slug,
        city: params.city,
        state: params.state,
        country: params.country,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return null;
    }

    return snap.data()?.coverImage || null;
  } catch (e) {
    return null;
  }
}

/**
 * Gera e persiste a capa da cidade.
 * Garante a criação do documento antes da chamada lenta da IA.
 */
export async function generateAndPersistCityCover(params: {
  slug: string;
  city: string;
  state: string;
  country: string;
  categories?: string[];
}) {
  const db = getAdminDb();
  const cityPageRef = db.collection('cityPages').doc(params.slug);

  try {
    // 1. Garantir que o documento existe antes de começar (status pendente)
    await cityPageRef.set({
      slug: params.slug,
      city: params.city,
      state: params.state,
      country: params.country,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`[City Engine] Iniciando geração IA para: ${params.city}...`);

    // 2. Chamar o fluxo de geração
    const imageUrl = await gerarCapaCidade({
      city: params.city,
      state: params.state,
      country: params.country,
      topCategories: params.categories || []
    });

    // 3. Download e persistência no Storage
    console.log(`[City Engine] Baixando imagem da URL temporária...`);
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Falha ao baixar imagem da OpenAI: ${response.statusText}`);
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    const bucket = admin.storage().bucket();
    const filePath = `city-covers/${params.slug}.png`;
    const file = bucket.file(filePath);

    console.log(`[City Engine] Salvando no Storage: ${filePath}`);
    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000, immutable'
      }
    });

    // 4. Tornar pública e atualizar Firestore
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    await cityPageRef.update({
      coverImage: publicUrl,
      coverGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[City Engine] Concluído para ${params.city}: ${publicUrl}`);
    return publicUrl;
  } catch (error: any) {
    console.error(`[City Engine FATAL FAILURE] ${params.city}:`, error.message);
    
    await logSystemError({
      error: error,
      type: 'city_cover_generation_failure',
      severity: 'error',
      metadata: { city: params.city, slug: params.slug }
    });

    // Retorna o erro estruturado para a UI capturar no console/toast
    return { success: false, error: error.message };
  }
}
