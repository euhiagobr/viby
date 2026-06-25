import { buildSitemapIndex, BASE_URL } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

/**
 * @fileOverview SITEMAP INDEX (ROOT)
 * Único ponto de entrada para o Googlebot. 
 * Aponta exclusivamente para os sitemaps segmentados.
 */
export async function GET() {
  const lastmod = new Date().toISOString();

  const sitemaps = [
    { loc: `${BASE_URL}/sitemap-static.xml`, lastmod },
    { loc: `${BASE_URL}/sitemap-events.xml`, lastmod },
    { loc: `${BASE_URL}/sitemap-users.xml`, lastmod },
    { loc: `${BASE_URL}/sitemap-cities.xml`, lastmod },
  ];

  return new Response(buildSitemapIndex(sitemaps), {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600'
    },
  });
}
