import { MetadataRoute } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache de 1 hora

/**
 * @fileOverview Fonte Única e Oficial de Verdade para o sitemap.xml da Viby.
 * Otimizado para performance: Queries com limite e serialização robusta.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://viby.club';
  
  // 1. Rotas Estáticas Públicas (Sempre retornadas mesmo se o DB falhar)
  const routes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/dashboard`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/copa-do-mundo`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.95 },
    { url: `${baseUrl}/copa-do-mundo/tabela`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/para-organizadores`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/ganhe-dinheiro`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/suporte/faq`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/festa-junina`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/experiencias-lgbtqiapn`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/termos`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/privacidade`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];

  try {
    const db = getAdminDb();

    // 2. Perfis de Usuários e Organizações (Limitado aos últimos 2000 para performance)
    const usernamesSnap = await db.collection('usernames').limit(2000).get();
    usernamesSnap.forEach(doc => {
      routes.push({
        url: `${baseUrl}/${doc.id}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.6
      });
    });

    // 3. Eventos Ativos (Rota Canônica: /[username]/[slug])
    // Limitado a 3000 eventos ativos para evitar payload excessivo
    const eventsSnap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .orderBy('date', 'desc')
      .limit(3000)
      .get();

    const cityPaths = new Set<string>();

    eventsSnap.forEach(doc => {
      const event = doc.data();
      const slug = event.slug || doc.id;
      const username = event.organizer?.username || 'evento';
      
      let lastMod: Date;
      if (event.updatedAt && typeof event.updatedAt.toDate === 'function') {
        lastMod = event.updatedAt.toDate();
      } else if (event.updatedAt && event.updatedAt._seconds) {
        lastMod = new Date(event.updatedAt._seconds * 1000);
      } else {
        lastMod = new Date();
      }

      routes.push({
        url: `${baseUrl}/${username}/${slug}`,
        lastModified: lastMod,
        changeFrequency: 'daily',
        priority: 0.9
      });

      if (event.regionSlug && event.citySlug) {
        cityPaths.add(`${event.regionSlug}/${event.citySlug}`);
      }
    });

    // 4. Páginas de Cidades
    cityPaths.forEach(path => {
      routes.push({
        url: `${baseUrl}/o-que-fazer-em/${path}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.85
      });
    });

  } catch (error) {
    console.error("[Sitemap Generation Failure] Returning partial static routes", error);
    // Em caso de erro no Firestore, retorna apenas as rotas estáticas para não deixar o sitemap vazio
  }

  return routes;
}
