import { getAdminDb } from '@/lib/firebase/admin';
import { permanentRedirect, notFound } from 'next/navigation';

/**
 * @fileOverview Redirecionador Permanente (301).
 * Migra tráfego de /eventos/[slug] para o novo canônico /[username]/[slug].
 * Bloqueia eventos excluídos ou ocultos.
 */

const VIBY_OFFICIAL_UID = "dd9665af-ad6d-405c-a51d-08220fecf96f";

async function getEventData(slugParam: string) {
  try {
    const rawSlugOrId = decodeURIComponent(slugParam).trim();
    const db = getAdminDb();

    // 1. Tentar por slug textual
    const slugLower = rawSlugOrId.toLowerCase();
    const queryBySlug = await db.collection("events")
      .where("slug", "==", slugLower)
      .limit(1).get();
    
    if (!queryBySlug.empty) {
      const data = queryBySlug.docs[0].data();
      if (!['Excluído', 'Oculto'].includes(data.status)) {
        return { id: queryBySlug.docs[0].id, ...data };
      }
    }

    // 2. Tentar por ID direto
    const docSnap = await db.collection("events").doc(rawSlugOrId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (!['Excluído', 'Oculto'].includes(data?.status)) {
        return { id: docSnap.id, ...data };
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

export default async function EventLegacyRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event: any = await getEventData(slug);
  
  if (event) {
    let actualUsername = event.organizer?.username?.toLowerCase();
    const orgId = event.organizationId || event.organizerId;
    
    if (!actualUsername) {
      if (orgId === VIBY_OFFICIAL_UID) {
        actualUsername = "viby";
      } else if (orgId) {
        const orgSnap = await getAdminDb().collection("organizations").doc(orgId).get();
        if (orgSnap.exists) {
          actualUsername = orgSnap.data()?.username?.toLowerCase() || orgSnap.id;
        }
      }
    }

    const username = actualUsername || 'evento';
    const canonicalSlug = event.slug || event.id;
    
    permanentRedirect(`/${username}/${canonicalSlug}`);
  }

  notFound();
}
