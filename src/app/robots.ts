import { MetadataRoute } from 'next';

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
