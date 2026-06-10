import { MetadataRoute } from 'next';

/**
 * @fileOverview Configuração oficial de rastreamento para robôs de busca.
 * Permite indexação total da área pública e bloqueia áreas administrativas/privadas.
 * A geração via robots.ts elimina a necessidade de um arquivo estático robots.txt.
 */

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/dashboard/',
        '/configuracoes/',
        '/settings/',
        '/api/',
        '/redefinir-senha',
        '/checkout/',
        '/onboarding',
      ],
    },
    sitemap: 'https://viby.club/sitemap.xml',
  };
}
