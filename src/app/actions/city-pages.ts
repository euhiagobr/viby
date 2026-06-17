'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { processCityCoverGeneration } from '@/services/city-cover-service';

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

    // Gatilho silencioso de background para primeira visualização
    processCityCoverGeneration(params).catch(e => console.warn("[Background City Cover] Silent fail trigger."));

    return null;
  } catch (e) {
    console.error('[CITY COVER ACTION ERROR]', e);
    return null;
  }
}

/**
 * Exportação obrigatória para compatibilidade com o sistema de eventos.
 */
export async function generateAndPersistCityCover(params: {
  slug: string;
  city: string;
  state: string;
  country: string;
  categories?: string[];
}) {
  return processCityCoverGeneration(params);
}

/**
 * Action acionada pelo botão manual no painel administrativo.
 */
export async function forceGenerateCityCoverAction(cityData: any) {
  return processCityCoverGeneration({
    slug: cityData.slug || cityData.id,
    city: cityData.city,
    state: cityData.state,
    country: cityData.country || "Brasil"
  });
}

/**
 * Permite atualização manual de metadados e URL de capa.
 */
export async function updateCityPageAction(slug: string, data: any) {
  const db = getAdminDb();
  try {
    await db.collection('cityPages').doc(slug).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
