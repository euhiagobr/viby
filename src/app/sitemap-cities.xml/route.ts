import { getAdminDb } from '@/lib/firebase/admin';
import { buildUrlSet, normalizeRoutes } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

/**
 * @fileOverview SITEMAP DE CIDADES (GUIAS REGIONAIS)
 * Formato: /o-que-fazer-em/[region]/[city]
 */
export async function GET() {
  const db = getAdminDb();
  const globalSet = new Set<string>();
  
  try {
    const snap = await db.collection('cityPages').get();
    
    const rawUrls = snap.docs.map(doc => {
      const data = doc.data();
      const slugParts = doc.id.split('-'); // ID format: country-state-city (ex: br-rs-porto-alegre)
      const country = slugParts[0];
      const state = slugParts[1];
      const city = slugParts.slice(2).join('-');
      
      return {
        path: `/o-que-fazer-em/${country}-${state}/${city}`,
        lastmod: data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
        priority: '0.8',
        changefreq: 'daily'
      };
    });

    const normalized = normalizeRoutes(rawUrls, globalSet);

    return new Response(buildUrlSet(normalized), {
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (e) {
    return new Response(buildUrlSet([]), { headers: { 'Content-Type': 'application/xml' } });
  }
}
