
import { getAdminDb } from '@/lib/firebase/admin';
import { buildUrlSet } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

/**
 * @fileOverview Sitemap Segmentado: Guias de Cidades.
 * Formato: /o-que-fazer-em/[region]/[city]
 */
export async function GET() {
  const baseUrl = 'https://viby.club';
  const db = getAdminDb();
  
  try {
    const snap = await db.collection('cityPages').get();
    
    const urls = snap.docs.map(doc => {
      const data = doc.data();
      const slugParts = doc.id.split('-'); // ID: br-rs-porto-alegre
      const region = slugParts.slice(0, 2).join('-');
      const city = slugParts.slice(2).join('-');
      
      return {
        loc: `${baseUrl}/o-que-fazer-em/${region}/${city}`,
        lastmod: data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
        priority: '0.8',
        changefreq: 'daily'
      };
    });

    return new Response(buildUrlSet(urls), {
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (e) {
    return new Response(buildUrlSet([]), {
      headers: { 'Content-Type': 'application/xml' },
    });
  }
}
