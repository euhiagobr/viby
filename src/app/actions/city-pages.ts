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
    console.error('[CITY COVER ERROR]', e);
    return null;
  }
}

/**
 * Gera e persiste a capa da cidade com logs obrigatórios de auditoria.
 */
export async function generateAndPersistCityCover(params: {
  slug: string;
  city: string;
  state: string;
  country: string;
  categories?: string[];
}) {
  console.log('[CITY COVER] ACTION INICIADA NO SERVIDOR');
  console.log('[CITY COVER] PARAMETROS RECEBIDOS:', params);

  const db = getAdminDb();
  const cityPageRef = db.collection('cityPages').doc(params.slug);

  try {
    console.log('[CITY COVER] GARANTINDO EXISTENCIA DO DOCUMENTO');
    await cityPageRef.set({
      slug: params.slug,
      city: params.city,
      state: params.state,
      country: params.country,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('[CITY COVER] DISPARANDO FLOW DE IA');
    const imageUrl = await gerarCapaCidade({
      city: params.city,
      state: params.state,
      country: params.country,
      topCategories: params.categories || []
    });

    console.log('[CITY COVER] DOWNLOAD DA IMAGEM INICIADO');
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Falha ao baixar imagem da OpenAI: ${response.statusText}`);
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
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
    console.log('[CITY COVER] URL:', publicUrl);

    console.log('[CITY COVER] SALVANDO URL NO BANCO');
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
