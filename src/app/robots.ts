import { MetadataRoute } from 'next';

/**
 * Geração dinâmica do arquivo robots.txt seguindo as regras da plataforma.
 * Bloqueia indexação de áreas administrativas e privadas.
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
