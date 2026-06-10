import { MetadataRoute } from 'next';

/**
 * Gerador dinâmico de robots.txt para a Viby.
 * Define as permissões de rastreamento e aponta para o sitemap dinâmico.
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
        '/auth/',
        '/onboarding',
        '/redefinir-senha'
      ],
    },
    sitemap: 'https://viby.club/sitemap.xml',
  };
}
