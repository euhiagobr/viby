
import { buildUrlSet } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

/**
 * @fileOverview Sitemap Segmentado: Rotas Estáticas Reais.
 */
export async function GET() {
  const baseUrl = 'https://viby.club';
  
  // Apenas rotas estáticas que não colidem com usuários ou eventos
  const urls = [
    { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${baseUrl}/copa-do-mundo`, priority: '0.9', changefreq: 'daily' },
    { loc: `${baseUrl}/copa-do-mundo/tabela`, priority: '0.8', changefreq: 'daily' },
    { loc: `${baseUrl}/festa-junina`, priority: '0.9', changefreq: 'daily' },
    { loc: `${baseUrl}/experiencias-lgbtqiapn`, priority: '0.8', changefreq: 'daily' },
    { loc: `${baseUrl}/anunciar`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${baseUrl}/ganhe-dinheiro`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${baseUrl}/suporte/faq`, priority: '0.6', changefreq: 'weekly' },
    { loc: `${baseUrl}/termos`, priority: '0.3', changefreq: 'monthly' },
    { loc: `${baseUrl}/privacidade`, priority: '0.3', changefreq: 'monthly' },
    { loc: `${baseUrl}/viby/marca`, priority: '0.4', changefreq: 'monthly' },
  ];

  return new Response(buildUrlSet(urls), {
    headers: { 'Content-Type': 'application/xml' },
  });
}
