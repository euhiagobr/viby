import { buildUrlSet } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = 'https://viby.club';
  const now = new Date().toISOString();

  const routes = [
    { loc: `${baseUrl}/`, lastmod: now, changefreq: 'daily', priority: '1.0' },
    { loc: `${baseUrl}/ganhe-dinheiro`, lastmod: now, changefreq: 'weekly', priority: '0.8' },
    { loc: `${baseUrl}/para-organizadores`, lastmod: now, changefreq: 'weekly', priority: '0.8' },
    { loc: `${baseUrl}/termos`, lastmod: now, changefreq: 'monthly', priority: '0.5' },
    { loc: `${baseUrl}/privacidade`, lastmod: now, changefreq: 'monthly', priority: '0.5' },
    { loc: `${baseUrl}/suporte/faq`, lastmod: now, changefreq: 'weekly', priority: '0.6' },
  ];

  return new Response(buildUrlSet(routes), {
    headers: { 'Content-Type': 'application/xml' },
  });
}
