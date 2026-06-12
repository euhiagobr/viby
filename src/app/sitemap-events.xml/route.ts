import { getAdminDb } from '@/lib/firebase/admin';
import { buildUrlSet } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 1800;

export async function GET() {
  const baseUrl = 'https://viby.club';
  try {
    const db = getAdminDb();
    
    // 1. Mapear usernames para construir URLs corretas
    const usernamesSnap = await db.collection('usernames').get();
    const uidToUsername: Record<string, string> = {};
    usernamesSnap.forEach(d => {
      uidToUsername[d.data().uid] = d.id;
    });

    // 2. Buscar eventos ativos
    const eventsSnap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .get();
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const routes = await Promise.all(eventsSnap.docs.map(async (doc) => {
      const event = doc.data();
      const ownerId = event.organizationId || event.organizerId;
      const username = uidToUsername[ownerId] || 'evento';
      const slug = event.slug || doc.id;

      let lastmod = event.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString();

      // Lógica de Recorrência para Sitemap
      if (event.isRecurring) {
        const occSnap = await db.collection('recurring_occurrences')
          .where('parentId', '==', doc.id)
          .where('status', '==', 'active')
          .where('date', '>=', todayStr)
          .orderBy('date', 'asc').limit(1).get();
        
        if (occSnap.empty) return null; // Não indexar recorrentes sem datas futuras
      }

      return {
        loc: `${baseUrl}/${username}/${slug}`,
        lastmod,
        changefreq: 'daily',
        priority: '0.9'
      };
    }));

    return new Response(buildUrlSet(routes.filter((r): r is any => r !== null)), {
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (e) {
    console.error("[Sitemap Events] Fail:", e);
    return new Response(buildUrlSet([]), {
      headers: { 'Content-Type': 'application/xml' },
    });
  }
}
