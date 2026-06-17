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
    
    // Se não existir o registro, cria o metadado básico agora para aparecer no admin
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
    // 1. Garantir que o registro base existe para visibilidade no Admin
    await cityPageRef.set({
      slug: params.slug,
      city: params.city,
      state: params.state,
      country: params.country,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`[City Engine] Iniciando geração IA para: ${params.city}...`);

    // 2. Gerar via OpenAI
    const imageUrl = await gerarCapaCidade({
      city: params.city,
      state: params.state,
      country: params.country,
      topCategories: params.categories || []
    });

    // 3. Baixar imagem e subir para Storage
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    
    const bucket = admin.storage().bucket();
    const filePath = `city-covers/${params.slug}.png`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000, immutable'
      }
    });

    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    // 4. Atualizar o documento com a URL final
    await cityPageRef.update({
      coverImage: publicUrl,
      coverGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[City Engine] Capa persistida para ${params.city}: ${publicUrl}`);
    return publicUrl;
  } catch (error: any) {
    console.error(`[City Engine Failure] ${params.slug}:`, error.message);
    
    await logSystemError({
      error,
      type: 'city_cover_generation_failure',
      severity: 'error',
      metadata: { city: params.city, slug: params.slug }
    });

    return null;
  }
}
