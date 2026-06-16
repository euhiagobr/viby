import { getAdminDb } from '@/lib/firebase/admin';
import { permanentRedirect, notFound } from 'next/navigation';

/**
 * @fileOverview Redirecionador Permanente (301).
 * Migra tráfego de /eventos/[slug] para o novo canônico /[username]/[slug].
 */
export default async function EventLegacyRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getAdminDb();

  try {
    // 1. Tentar localizar por slug global
    const queryBySlug = await db.collection("events")
      .where("slug", "==", slug)
      .limit(1).get();
    
    if (!queryBySlug.empty) {
      const event = queryBySlug.docs[0].data();
      const username = event.organizer?.username || 'evento';
      permanentRedirect(`/${username}/${slug}`);
    } 
    
    // 2. Fallback: Buscar por ID direto
    const eventByIdSnap = await db.collection("events").doc(slug).get();
    if (eventByIdSnap.exists) {
      const event = eventByIdSnap.data();
      const username = event?.organizer?.username || 'evento';
      permanentRedirect(`/${username}/${slug}`);
    }

    notFound();
  } catch (e) {
    notFound();
  }
}
