import { buildUrlSet, normalizeRoutes, validateData, deduplicateGlobal } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const globalSet = new Set<string>();
  
  // 1. Load & 2. Normalize
  const staticRoutes = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/copa-do-mundo', priority: '0.9' },
    { path: '/festa-junina', priority: '0.9' },
    { path: '/experiencias-lgbtqiapn', priority: '0.8' },
    { path: '/anunciar', priority: '0.7' },
    { path: '/ganhe-dinheiro', priority: '0.7' },
    { path: '/suporte/faq', priority: '0.6' },
    { path: '/termos', priority: '0.3' },
    { path: '/privacidade', priority: '0.3' }
  ];

  // 3. Validate & 4. Deduplicate
  const normalized = normalizeRoutes(staticRoutes);
  const validated = validateData(normalized);
  const unique = deduplicateGlobal(validated, globalSet);

  // 5. Build
  return new Response(buildUrlSet(unique), {
    headers: { 'Content-Type': 'application/xml' },
  });
}
