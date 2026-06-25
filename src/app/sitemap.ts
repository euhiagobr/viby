
/**
 * @fileOverview Desativação do sitemap.ts padrão do Next.js.
 * O controle foi migrado para Route Handlers customizados em /sitemap.xml/route.ts
 * para suportar sitemapindex e sitemaps segmentados.
 */
export default function sitemap() {
  return [];
}
