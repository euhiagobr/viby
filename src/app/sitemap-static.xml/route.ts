import { buildUrlSet, normalizeRoutes } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

/**
 * @fileOverview SITEMAP ESTÁTICO
 * Rotas institucionais fixas.
 */
export async function GET() {
  const globalSet = new Set<string>();
  
  const staticRoutes = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/copa-do-mundo', priority: '0.9', changefreq: 'daily' },
    { path: '/festa-junina', priority: '0.9', changefreq: 'daily' },
    { path: '/experiencias-lgbtqiapn', priority: '0.8', changefreq: 'daily' },
    { path: '/anunciar', priority: '0.7', changefreq: 'weekly' },
    { path: '/ganhe-dinheiro', priority: '0.7', changefreq: 'weekly' },
    { path: '/suporte/faq', priority: '0.6', changefreq: 'weekly' },
    { path: '/termos', priority: '0.3', changefreq: 'monthly' },
    { path: '/privacidade', priority: '0.3', changefreq: 'monthly' },
    { path: '/viby/marca', priority: '0.4', changefreq: 'monthly' },
  ];

  const normalized = normalizeRoutes(staticRoutes, globalSet);

  return new Response(buildUrlSet(normalized), {
    headers: { 'Content-Type': 'application/xml' },
  });
}
