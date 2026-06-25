
import { buildSitemapIndex } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

/**
 * @fileOverview Sitemap Index (Root).
 * Único ponto de entrada para o Googlebot. Aponta para os sitemaps segmentados.
 */
export async function GET() {
  const baseUrl = 'https://viby.club';
  const lastmod = new Date().toISOString();

  const sitemaps = [
    { loc: `${baseUrl}/sitemap-static.xml`, lastmod },
    { loc: `${baseUrl}/sitemap-events.xml`, lastmod },
    { loc: `${baseUrl}/sitemap-users.xml`, lastmod },
    { loc: `${baseUrl}/sitemap-cities.xml`, lastmod },
  ];

  return new Response(buildSitemapIndex(sitemaps), {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600'
    },
  });
}
