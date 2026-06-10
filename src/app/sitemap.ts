import { MetadataRoute } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';

/**
 * Gerador dinâmico de sitemap.xml.
 * Consulta o Firestore via Admin SDK para listar todos os conteúdos públicos ativos.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getAdminDb();
  const now = new Date();
  const baseUrl = 'https://viby.club';

  // 1. Rotas Estáticas e Institucionais
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/ganhe-dinheiro`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/termos`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacidade`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/suporte/faq`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ];

  try {
    // 2. Buscar Todos os Usernames/Slugs ativos (Índice Global)
    const usernamesSnap = await db.collection('usernames').get();
    const uidToUsername: Record<string, string> = {};
    
    const profileRoutes: MetadataRoute.Sitemap = usernamesSnap.docs.map((doc) => {
      const data = doc.data();
      uidToUsername[data.uid] = doc.id;
      return {
        url: `${baseUrl}/${doc.id}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: data.type === 'organization' ? 0.8 : 0.7,
      };
    });

    // 3. Buscar Eventos Ativos
    const eventsSnap = await db.collection('events').where('status', '==', 'Ativo').get();
    const eventRoutes: MetadataRoute.Sitemap = eventsSnap.docs.map((doc) => {
      const event = doc.data();
      const ownerId = event.organizationId || event.organizerId || event.organizer?.id;
      const ownerUsername = uidToUsername[ownerId] || 'evento';
      const slug = event.slug || doc.id;

      return {
        url: `${baseUrl}/${ownerUsername}/${slug}`,
        lastModified: event.updatedAt?.toDate?.() || now,
        changeFrequency: 'daily',
        priority: 0.9,
      };
    });

    return [...staticRoutes, ...profileRoutes, ...eventRoutes];
  } catch (error) {
    console.error('[Sitemap Error]', error);
    return staticRoutes;
  }
}
