import { MetadataRoute } from 'next';

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
    sitemap: 'https://viby.club/sitemap.xml',
  };
}
