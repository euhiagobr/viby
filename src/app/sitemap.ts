import { MetadataRoute } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://viby.club';
  const now = new Date();

  const routes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/ganhe-dinheiro`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/termos`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/privacidade`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/suporte/faq`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
  ];

  try {
    const db = getAdminDb();
    
    // 1. Perfis (Usernames)
    const usernamesSnap = await db.collection('usernames').get();
    const uidToUsername: Record<string, string> = {};
    
    usernamesSnap.forEach((doc) => {
      const data = doc.data();
      uidToUsername[data.uid] = doc.id;
      routes.push({
        url: `${baseUrl}/${doc.id}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    });

    // 2. Eventos Ativos
    const eventsSnap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .get();
      
    eventsSnap.forEach((doc) => {
      const event = doc.data();
      const ownerId = event.organizationId || event.organizerId;
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
    console.error('[Sitemap] Error:', error);
    return routes;
  }
}
