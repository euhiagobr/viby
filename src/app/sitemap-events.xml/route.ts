import { getAdminDb } from '@/lib/firebase/admin';
import { buildUrlSet } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

/**
 * Sitemap Segmentado: Eventos Ativos
 * Preservado como recurso auxiliar para indexação granular.
 */
export async function GET() {
  const baseUrl = 'https://viby.club';
  const db = getAdminDb();
  
  const snap = await db.collection('events').where('status', '==', 'Ativo').get();
  const urls = snap.docs.map(doc => {
    const data = doc.data();
    const username = data.organizer?.username || 'evento';
    const slug = data.slug || doc.id;
    return {
      loc: `${baseUrl}/${username}/${slug}`,
      lastmod: data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
      priority: '0.9',
      changefreq: 'daily'
    };
  });

  return new Response(buildUrlSet(urls), {
    headers: { 'Content-Type': 'application/xml' },
  });
}
