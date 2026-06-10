import { MetadataRoute } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache de 1 hora para performance e SEO

/**
 * Gerador automático de sitemap.xml.
 * Consolida rotas institucionais e conteúdos dinâmicos do Firestore.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://viby.club';
  const now = new Date();

  // 1. Rotas Institucionais Estáticas
  const routes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/ganhe-dinheiro`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/termos`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/privacidade`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/suporte/faq`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
  ];

  try {
    const db = getAdminDb();
    
    // 2. Buscar Todos os Usernames Ativos (Perfis)
    const usernamesSnap = await db.collection('usernames').get();
    const uidToUsername: Record<string, string> = {};
    
    usernamesSnap.forEach((doc) => {
      const data = doc.data();
      uidToUsername[data.uid] = doc.id;
      routes.push({
        url: `${baseUrl}/${doc.id}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: data.type === 'organization' ? 0.8 : 0.7,
      });
    });

    // 3. Buscar Eventos Públicos Ativos
    const eventsSnap = await db.collection('events').where('status', '==', 'Ativo').get();
    eventsSnap.forEach((doc) => {
      const event = doc.data();
      const ownerId = event.organizationId || event.organizerId || event.organizer?.id;
      const ownerUsername = uidToUsername[ownerId] || 'evento';
      const slug = event.slug || doc.id;

      routes.push({
        url: `${baseUrl}/${ownerUsername}/${slug}`,
        lastModified: event.updatedAt?.toDate?.() || now,
        changeFrequency: 'daily',
        priority: 0.9,
      });
    });

    return routes;
  } catch (error) {
    // Fallback silencioso para rotas estáticas em caso de erro no banco (essencial durante build/CI)
    console.warn('[Sitemap] Database connection skipped during static generation. Serving basic routes.');
    return routes;
  }
}
