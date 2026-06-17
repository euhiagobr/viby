'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { headers } from 'next/headers';

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
    const data = snap.data();
    
    if (data?.cityCoverUrl || data?.coverImage) {
      return data.cityCoverUrl || data.coverImage;
    }

    if (!snap.exists) {
      await cityPageRef.set({
        slug: params.slug,
        city: params.city,
        state: params.state,
        country: params.country,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    return null;
  } catch (e) {
    console.error('[CITY COVER ACTION ERROR]', e);
    return null;
  }
}

/**
 * Disparador de geração de capa via API Route.
 * Utilizado pelo pipeline de eventos para garantir SEO visual.
 */
export async function generateAndPersistCityCover(params: {
  slug: string;
  city: string;
  state: string;
  country: string;
  categories?: string[];
}) {
  const head = await headers();
  const origin = head.get('origin') || head.get('host') || 'localhost:3000';
  const protocol = origin.includes('localhost') ? 'http' : 'https';
  
  const apiUrl = `${protocol}://${origin}/api/city-cover`;

  try {
    // Chamada assíncrona (fire and forget) para não travar o salvamento do evento
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: params.slug,
        city: params.city,
        state: params.state,
        country: params.country,
        topCategories: params.categories || []
      })
    }).catch(e => console.warn("[Background City Cover] Silent fail trigger."));

    return null;
  } catch (e) {
    return null;
  }
}
