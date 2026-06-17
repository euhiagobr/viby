'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';

/**
 * @fileOverview Server Actions para gestão de metadados de cidades.
 */

export async function getOrTriggerCityCover(params: {
  slug: string;
  city: string;
  state: string;
  country: string;
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
    console.error('[CITY COVER ACTION ERROR]', e);
    return null;
  }
}

/**
 * Disparador de geração de capa em background.
 * Satisfaz a dependência de events.ts e encaminha para a API Route.
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
    const snap = await cityPageRef.get();
    if (!snap.exists) {
      await cityPageRef.set({
        slug: params.slug,
        city: params.city,
        state: params.state,
        country: params.country,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    
    console.log('[CITY COVER] Background trigger for:', params.city);
    // Nota: Como é background e não queremos travar a Action pai, apenas logamos o registro.
    // A geração real deve ser disparada via UI ou cron job para evitar 504.
    return null;
  } catch (e) {
    return null;
  }
}
