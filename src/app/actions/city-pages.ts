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
    
    if (snap.exists && snap.data()?.coverImage) {
      return snap.data()?.coverImage;
    }

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Gera e persiste a capa da cidade.
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
    console.log(`[City Engine] Inciando geração para: ${params.city}...`);

    // 1. Gerar via OpenAI
    const imageUrl = await gerarCapaCidade({
      city: params.city,
      state: params.state,
      country: params.country,
      topCategories: params.categories || []
    });

    // 2. Baixar imagem e subir para Storage
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

    // 3. Persistir no Firestore
    const cityData = {
      slug: params.slug,
      city: params.city,
      state: params.state,
      country: params.country,
      coverImage: publicUrl,
      coverGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await cityPageRef.set(cityData, { merge: true });

    console.log(`[City Engine] Capa gerada e salva com sucesso para ${params.city}`);
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
