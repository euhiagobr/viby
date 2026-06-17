
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { gerarCapaCidade } from '@/ai/flows/gerar-capa-cidade-flow';

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

    // Se não existe, disparamos a geração em background (sem await se chamado de certos contextos)
    // Para esta implementação, o chamador decide se aguarda ou não.
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

    return publicUrl;
  } catch (error) {
    console.error(`[City Cover Generation Failed] ${params.slug}:`, error);
    return null;
  }
}
