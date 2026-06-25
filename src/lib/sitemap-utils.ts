
/**
 * @fileOverview Utilitários para geração segura de XML para Sitemaps e Indexadores.
 */

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

export function buildUrlSet(urls: { loc: string; lastmod?: string; changefreq?: string; priority?: string }[]): string {
  const items = urls.map(url => `
  <url>
    <loc>${escapeXml(url.loc)}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
    ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ''}
    ${url.priority ? `<priority>${url.priority}</priority>` : ''}
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`.trim();
}

export function buildSitemapIndex(sitemaps: { loc: string; lastmod?: string }[]): string {
  const items = sitemaps.map(s => `
  <sitemap>
    <loc>${escapeXml(s.loc)}</loc>
    ${s.lastmod ? `<lastmod>${s.lastmod}</lastmod>` : ''}
  </sitemap>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>`.trim();
}

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

export function isValidUsername(username: string): boolean {
  if (!username) return false;
  // Ignora IDs numéricos (apenas dígitos)
  if (/^\d+$/.test(username)) return false;
  // Ignora rotas reservadas
  if (RESERVED_ROUTES.includes(username.toLowerCase())) return false;
  // Mínimo de 3 caracteres
  if (username.length < 3) return false;
  return true;
}
