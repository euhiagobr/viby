import { MetadataRoute } from 'next';

/**
 * @fileOverview Configuração de Robots oficial da Viby.
 * Garante que o Googlebot tenha acesso total às páginas públicas e ao Sitemap Index.
 */

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/dashboard/',
        '/api/',
        '/auth/',
        '/checkout/',
        '/redefinir-senha',
        '/onboarding'
      ],
    },
    sitemap: [
      'https://viby.club/sitemap.xml'
    ],
  };
}
