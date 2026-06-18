import { getAdminDb } from '@/lib/firebase/admin';
import { permanentRedirect, notFound } from 'next/navigation';

/**
 * @fileOverview Redirecionador Permanente (301).
 * Migra tráfego de /eventos/[slug] para o novo canônico /[username]/[slug].
 */

async function getEventData(slugParam: string) {
  try {
    const slugOrId = decodeURIComponent(slugParam).toLowerCase().trim();
    const db = getAdminDb();

    // 1. Tentar por slug textual
    const queryBySlug = await db.collection("events")
      .where("slug", "==", slugOrId)
      .limit(1).get();
    
    if (!queryBySlug.empty) return queryBySlug.docs[0].data();

    // 2. Tentar por ID de documento
    const docSnap = await db.collection("events").doc(slugOrId).get();
    if (docSnap.exists) return docSnap.data();

    return null;
  } catch (e) {
    return null;
  }
}

export default async function EventLegacyRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getAdminDb();

  const event = await getEventData(slug);
  
  if (event) {
    let actualUsername = event.organizer?.username?.toLowerCase();
    
    // Garantir que temos o username da organização para o redirecionamento correto
    if (!actualUsername && event.organizationId) {
      const orgSnap = await db.collection("organizations").doc(event.organizationId).get();
      if (orgSnap.exists) {
        actualUsername = orgSnap.data()?.username?.toLowerCase();
      }
    }

    const username = actualUsername || 'evento';
    const canonicalSlug = event.slug || event.id || slug;
    
    permanentRedirect(`/${username}/${canonicalSlug}`);
  }

  notFound();
}
