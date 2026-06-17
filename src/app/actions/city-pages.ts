
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

    return null;
  } catch (e) {
    console.error('[CITY COVER ACTION ERROR]', e);
    return null;
  }
}

/**
 * Disparador de geração de capa.
 * Chamado internamente por outras Server Actions para evitar overhead de rede.
 */
export async function generateAndPersistCityCover(params: {
  slug: string;
  city: string;
  state: string;
  country: string;
  categories?: string[];
}) {
  // Chamada direta ao serviço (Server-to-Server)
  // Não utilizamos fetch aqui para evitar problemas de URL absoluta e autenticação de Workstation
  return processCityCoverGeneration(params);
}

/**
 * Action acionada pelo botão manual no painel administrativo.
 */
export async function forceGenerateCityCoverAction(cityData: any) {
  return processCityCoverGeneration({
    slug: cityData.slug,
    city: cityData.city,
    state: cityData.state,
    country: cityData.country
  });
}
