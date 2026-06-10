import { MetadataRoute } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';

/**
 * @fileOverview Gerador dinâmico de sitemap para a plataforma Viby.
 * Consolida rotas estáticas e dinâmicas (eventos, perfis e marcas) para indexação.
 */

const BASE_URL = 'https://viby.club';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getAdminDb();
  const now = new Date();

  // 1. Rotas Estáticas e Institucionais
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/ganhe-dinheiro`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/termos`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/privacidade`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/suporte/faq`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ];

  try {
    // 2. Buscar Perfis Públicos (Usuários e Organizações)
    const usernamesSnap = await db.collection('usernames').get();
    const profileRoutes: MetadataRoute.Sitemap = usernamesSnap.docs.map((doc) => ({
      url: `${BASE_URL}/${doc.id}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

    // 3. Buscar Eventos Ativos
    const eventsSnap = await db.collection('events').where('status', '==', 'Ativo').get();
    
    // Mapeamento de UID para Username para otimizar a geração
    const uidToUsername: Record<string, string> = {};
    usernamesSnap.docs.forEach(d => {
      const data = d.data();
      uidToUsername[data.uid] = d.id;
    });

    const eventRoutes: MetadataRoute.Sitemap = eventsSnap.docs.map((doc) => {
      const event = doc.data();
      const ownerId = event.organizationId || event.organizerId || event.organizer?.id;
      const ownerUsername = uidToUsername[ownerId] || 'evento';
      const slug = event.slug || doc.id;

      return {
        url: `${BASE_URL}/${ownerUsername}/${slug}`,
        lastModified: event.updatedAt?.toDate?.() || now,
        changeFrequency: 'daily',
        priority: 0.9,
      };
    });

    return [...staticRoutes, ...profileRoutes, ...eventRoutes];
  } catch (e) {
    console.error('[Sitemap Generation Error]', e);
    return staticRoutes;
  }
}
