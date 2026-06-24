import { MetadataRoute } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache de 1 hora

/**
 * @fileOverview Fonte Única e Oficial de Verdade para o sitemap.xml da Viby.
 * Otimizado para resiliência: Garante que dados corrompidos não quebrem o XML.
 */

const baseUrl = 'https://viby.club';

/**
 * Helper para garantir que a data seja serializável para o XML do sitemap.
 */
function parseSafeDate(dateData: any): Date {
  if (!dateData) return new Date();
  
  try {
    // Caso seja um Timestamp do Admin SDK
    if (typeof dateData.toDate === 'function') {
      return dateData.toDate();
    }
    // Caso venha como objeto serializado do servidor
    if (dateData._seconds) {
      return new Date(dateData._seconds * 1000);
    }
    // Fallback para string ou Date nativo
    const d = new Date(dateData);
    return isNaN(d.getTime()) ? new Date() : d;
  } catch (e) {
    return new Date();
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 1. Rotas Estáticas Públicas
  const routes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
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

    // 2. Perfis (Usernames)
    const usernamesSnap = await db.collection('usernames')
      .limit(1000)
      .get();

    usernamesSnap.forEach(doc => {
      const data = doc.data();
      const username = doc.id; // O ID do documento na coleção usernames é o próprio username
      if (username && !username.includes(' ')) {
        routes.push({
          url: `${baseUrl}/${username}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.6
        });
      }
    });

    // 3. Eventos Ativos (Rota Canônica: /[username]/[slug])
    const eventsSnap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .select('slug', 'organizer.username', 'updatedAt', 'regionSlug', 'citySlug')
      .limit(2000)
      .get();

    const cityPaths = new Set<string>();

    eventsSnap.forEach(doc => {
      const event = doc.data();
      const slug = event.slug || doc.id;
      const username = event.organizer?.username;
      
      // VALIDAÇÃO CRÍTICA: Se não houver username ou slug, não gera a URL para não quebrar o sitemap
      if (!username || !slug) return;

      const lastMod = parseSafeDate(event.updatedAt);

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
    console.error("[Sitemap Generation Failure]", error);
  }

  // Filtragem final para garantir que nenhum objeto inválido foi inserido por erro de processamento
  return routes.filter(route => 
    route.url && 
    !route.url.includes('undefined') && 
    !route.url.includes('null')
  );
}