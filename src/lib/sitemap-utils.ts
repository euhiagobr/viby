/**
 * @fileOverview Utilitários para geração segura de XML para Sitemaps e Indexadores.
 * Implementa o pipeline de normalização, resolução de rotas e deduplicação global.
 */

export const BASE_URL = 'https://viby.club';

export const RESERVED_ROUTES = [
  'dashboard', 'admin', 'login', 'cadastro', 'redefinir-senha', 
  'checkout', 'privacidade', 'termos', 'api', 'suporte', 'explorar',
  'support', 'help', 'onboarding', 'faq', 'recorrente', 'ganhe-dinheiro',
  'marketing', 'afiliados', 'anuncios', 'imposto', 'extrato', 'transferencias',
  'financeiro', 'usuarios', 'paginas', 'denuncias', 'logs', 'emails', 
  'configuracoes', 'equipe', 'notificacoes', 'scanner', 'presenca', 'ingressos',
  'projeto', 'auth', 'para-organizadores', 'search', 'settings', 'viby', 'marca',
  'o-que-fazer-em', 'eventos', 'evento', 'perfil'
];

/**
 * Valida se um username é elegível para indexação.
 * Proíbe IDs puramente numéricos e rotas reservadas.
 */
export function isValidUsername(username: string): boolean {
  if (!username) return false;
  const lower = username.toLowerCase().trim();
  if (lower.length < 3) return false;
  if (/^\d+$/.test(lower)) return false; // Proibição de IDs numéricos
  if (RESERVED_ROUTES.includes(lower)) return false;
  return true;
}

/**
 * Resolve a rota canônica de um usuário ou organização.
 */
export function resolveUserRoute(username: string | undefined): string | null {
  if (!username || !isValidUsername(username)) return null;
  return `/${username.toLowerCase().trim()}`;
}

/**
 * Normaliza e deduplica rotas contra um Set global.
 */
export function normalizeRoutes(
  rawUrls: { path: string; lastmod?: string; priority?: string; changefreq?: string }[],
  globalSet: Set<string>
) {
  const uniqueUrls: any[] = [];

  rawUrls.forEach(url => {
    const fullLoc = `${BASE_URL}${url.path.startsWith('/') ? url.path : `/${url.path}`}`;
    if (!globalSet.has(fullLoc)) {
      globalSet.add(fullLoc);
      uniqueUrls.push({
        loc: fullLoc,
        lastmod: url.lastmod || new Date().toISOString(),
        priority: url.priority || '0.5',
        changefreq: url.changefreq || 'weekly'
      });
    }
  });

  return uniqueUrls;
}

export function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export function buildUrlSet(urls: { loc: string; lastmod: string; changefreq: string; priority: string }[]): string {
  // Fallback obrigatório: se o sitemap estiver vazio, inclui a homepage para evitar erro 404/vazio no Google
  const items = urls.length > 0 ? urls : [{ loc: `${BASE_URL}/`, lastmod: new Date().toISOString(), priority: '1.0', changefreq: 'daily' }];
  
  const xmlItems = items.map(url => `
  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlItems}
</urlset>`.trim();
}

export function buildSitemapIndex(sitemaps: { loc: string; lastmod: string }[]): string {
  const items = sitemaps.map(s => `
  <sitemap>
    <loc>${escapeXml(s.loc)}</loc>
    <lastmod>${s.lastmod}</lastmod>
  </sitemap>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>`.trim();
}
