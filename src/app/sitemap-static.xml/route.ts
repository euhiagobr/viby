import { buildUrlSet } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

/**
 * Sitemap Segmentado: Rotas Estáticas
 * Preservado como recurso auxiliar para indexação granular.
 */
export async function GET() {
  const baseUrl = 'https://viby.club';
  const urls = [
    { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${baseUrl}/copa-do-mundo`, priority: '0.9', changefreq: 'daily' },
    { loc: `${baseUrl}/festa-junina`, priority: '0.9', changefreq: 'daily' },
    { loc: `${baseUrl}/para-organizadores`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${baseUrl}/ganhe-dinheiro`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${baseUrl}/suporte/faq`, priority: '0.6', changefreq: 'weekly' },
  ];

  return new Response(buildUrlSet(urls), {
    headers: { 'Content-Type': 'application/xml' },
  });
}
