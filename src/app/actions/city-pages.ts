'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';

/**
 * @fileOverview Server Actions para gestão de metadados de cidades.
 * A geração de imagem foi movida para /api/city-cover para evitar timeouts.
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
