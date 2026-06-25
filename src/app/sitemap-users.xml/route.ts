import { getAdminDb } from '@/lib/firebase/admin';
import { buildUrlSet, normalizeRoutes, resolveUserRoute } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

/**
 * @fileOverview SITEMAP DE USUÁRIOS E MARCAS
 * Mapeia user.id -> user.username. Bloqueia IDs numéricos.
 */
export async function GET() {
  const db = getAdminDb();
  const globalSet = new Set<string>();
  
  try {
    // Pipeline: Load -> Map -> Validate
    const snap = await db.collection('users').limit(5000).get();

    const rawUrls = snap.docs.map(doc => {
      const data = doc.data();
      const username = data.username;
      const route = resolveUserRoute(username);
      
      if (!route) return null;

      return {
        path: route,
        lastmod: data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
        priority: '0.6',
        changefreq: 'weekly'
      };
    }).filter(Boolean) as any[];

    const normalized = normalizeRoutes(rawUrls, globalSet);

    return new Response(buildUrlSet(normalized), {
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (e) {
    return new Response(buildUrlSet([]), { headers: { 'Content-Type': 'application/xml' } });
  }
}
