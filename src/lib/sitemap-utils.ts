
/**
 * @fileOverview Pipeline de processamento de sitemaps.
 * 1. Load: Coleta de dados brutos.
 * 2. Normalize: Conversão de IDs e caminhos.
 * 3. Validate: Verificação de sanidade e segurança.
 * 4. Deduplicate: Eliminação de duplicatas globais.
 * 5. Build: Geração do XML.
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
  'o-que-fazer-em', 'eventos', 'evento', 'perfil', 'experiencias'
];

export function isValidUsername(username: string | undefined): boolean {
  if (!username) return false;
  const lower = username.toLowerCase().trim();
  if (lower.length < 3) return false;
  if (/^\d+$/.test(lower)) return false; 
  if (RESERVED_ROUTES.includes(lower)) return false;
  return true;
}

export function resolveUserRoute(username: string | undefined): string | null {
  if (!isValidUsername(username)) return null;
  return `/${username!.toLowerCase().trim()}`;
}

export function normalizeRoutes(
  rawUrls: { path: string; lastmod?: string; priority?: string; changefreq?: string }[]
) {
  return rawUrls.map(url => {
    const cleanPath = url.path.startsWith('/') ? url.path : `/${url.path}`;
    const loc = `${BASE_URL}${cleanPath}`.replace(/\/$/, "");
    return {
      loc,
      lastmod: url.lastmod || new Date().toISOString(),
      priority: url.priority || '0.5',
      changefreq: url.changefreq || 'weekly'
    };
  });
}

export function validateData(urls: any[]) {
  return urls.filter(url => {
    try {
      const parsed = new URL(url.loc);
      const path = parsed.pathname.replace(/^\//, "").split('/')[0];
      return !RESERVED_ROUTES.includes(path.toLowerCase());
    } catch (e) {
      return false;
    }
  });
}

export function deduplicateGlobal(urls: any[], globalSet: Set<string>) {
  return urls.filter(url => {
    if (globalSet.has(url.loc)) return false;
    globalSet.add(url.loc);
    return true;
  });
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
  const finalUrls = urls.length > 0 ? urls : [
    { loc: `${BASE_URL}`, lastmod: new Date().toISOString(), priority: '1.0', changefreq: 'daily' }
  ];
  
  const xmlItems = finalUrls.map(url => `
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
