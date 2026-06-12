import { getAdminDb } from '@/lib/firebase/admin';
import { buildUrlSet } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = 'https://viby.club';
  try {
    const db = getAdminDb();
    const snap = await db.collection('categories').get();
    
    // Como não há rota de categoria específica, indexamos a busca por categoria na home
    const routes = snap.docs.map(doc => ({
      loc: `${baseUrl}/dashboard?category=${doc.id}`,
      changefreq: 'weekly',
      priority: '0.4'
    }));

    return new Response(buildUrlSet(routes), {
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (e) {
    return new Response(buildUrlSet([]), {
      headers: { 'Content-Type': 'application/xml' },
    });
  }
}
