import { MetadataRoute } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

/**
 * @fileOverview Fonte Única e Oficial de Verdade para o sitemap.xml da Viby.
 * Consolida rotas estáticas, perfis de usuários/marcas, eventos e páginas de cidades.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://viby.club';
  
  try {
    const db = getAdminDb();

    // 1. Rotas Estáticas Públicas
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

    // 2. Perfis de Usuários e Organizações
    const usernamesSnap = await db.collection('usernames').get();
    usernamesSnap.forEach(doc => {
      const username = doc.id;
      routes.push({
        url: `${baseUrl}/${username}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.6
      });
    });

    // 3. Eventos Ativos (Rota Canônica: /[username]/[slug])
    const eventsSnap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .get();

    const cityPaths = new Set<string>();

    eventsSnap.forEach(doc => {
      const event = doc.data();
      const slug = event.slug || doc.id;
      const username = event.organizer?.username || 'evento';
      
      let lastMod = new Date();
      if (event.updatedAt) {
        lastMod = event.updatedAt.toDate ? event.updatedAt.toDate() : new Date(event.updatedAt);
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

    return routes;

  } catch (error) {
    console.error("[Sitemap Generation Failure]", error);
    return [
      { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 }
    ];
  }
}
