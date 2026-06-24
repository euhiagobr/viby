import { MetadataRoute } from 'next';

/**
 * @fileOverview Fonte Única e Oficial de Verdade para o robots.txt da Viby.
 * Define as permissões de rastreamento e aponta para o sitemap principal consolidado.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: [
        '/', 
        '/suporte/faq',
        '/recorrente/'
      ],
      disallow: [
        '/admin/',
        '/dashboard/',
        '/api/',
        '/auth/',
        '/checkout/',
        '/redefinir-senha',
        '/onboarding',
        '/suporte/'
      ],
    },
    sitemap: [
      'https://viby.club/sitemap.xml'
    ],
  };
}
