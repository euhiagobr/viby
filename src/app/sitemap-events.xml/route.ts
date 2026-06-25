import { getAdminDb } from '@/lib/firebase/admin';
import { buildUrlSet, normalizeRoutes, isValidUsername } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

/**
 * @fileOverview SITEMAP DE EVENTOS
 * Formato canônico: /[username]/[slug]
 * Apenas eventos com status 'Ativo'.
 */
export async function GET() {
  const db = getAdminDb();
  const globalSet = new Set<string>();
  
  try {
    const snap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .limit(3000)
      .get();

    const rawUrls = snap.docs.map(doc => {
      const data = doc.data();
      const username = data.organizer?.username || data.username;
      const slug = data.slug || doc.id;
      
      if (!isValidUsername(username)) return null;

      return {
        path: `/${username.toLowerCase()}/${slug}`,
        lastmod: data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
        priority: '0.9',
        changefreq: 'daily'
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
