'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { logSystemError } from '@/lib/error-manager';
import { headers } from 'next/headers';

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
    console.error('[CITY COVER ERROR]', e);
    return null;
  }
}

/**
 * Gera e persiste a capa da cidade utilizando a API Route interna para evitar timeouts.
 */
export async function generateAndPersistCityCover(params: {
  slug: string;
  city: string;
  state: string;
  country: string;
  categories?: string[];
}) {
  console.log('[CITY COVER] ACTION INICIADA');
  
  const db = getAdminDb();
  const cityPageRef = db.collection('cityPages').doc(params.slug);

  try {
    await cityPageRef.set({
      slug: params.slug,
      city: params.city,
      state: params.state,
      country: params.country,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('[CITY COVER] CHAMANDO API ROUTE INTERNA');
    
    // Obter a URL base dinamicamente para a chamada interna
    const headersList = await headers();
    const host = headersList.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const apiUrl = `${protocol}://${host}/api/city-cover`;

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: params.city,
        state: params.state,
        country: params.country,
        topCategories: params.categories || []
      })
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      throw new Error(errorData.message || "Falha na API de geração de imagem.");
    }

    const { url: imageUrl } = await apiResponse.json();

    console.log('[CITY COVER] DOWNLOAD DA IMAGEM INICIADO');
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) throw new Error(`Falha ao baixar imagem da OpenAI: ${imageResponse.statusText}`);
    
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    
    console.log('[CITY COVER] UPLOAD INICIADO');
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
    console.log('[CITY COVER] UPLOAD FINALIZADO');

    await cityPageRef.update({
      coverImage: publicUrl,
      coverGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('[CITY COVER] SALVO');

    return { success: true, url: publicUrl };
  } catch (error: any) {
    console.error('[CITY COVER ERROR]', error);
    
    await logSystemError({
      error: error,
      type: 'city_cover_generation_failure',
      severity: 'error',
      metadata: { 
        city: params.city, 
        slug: params.slug,
        errorMessage: error.message
      }
    });

    return { success: false, error: error.message };
  }
}
