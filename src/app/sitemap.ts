import { MetadataRoute } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';

/**
 * @fileOverview Gerador Único de Sitemap oficial da Viby (Next.js 15 Standard).
 * Consolida rotas estáticas, perfis e eventos em uma única estratégia de indexação.
 * Suporta milhares de URLs com priorização e frequência de atualização.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Revalida o cache a cada 1 hora

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://viby.club';
  
  try {
    const db = getAdminDb();

    // 1. Rotas Estáticas e Institucionais
    const routes: MetadataRoute.Sitemap = [
      { url: `${baseUrl}/`, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
      { url: `${baseUrl}/dashboard`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
      { url: `${baseUrl}/para-organizadores`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
      { url: `${baseUrl}/ganhe-dinheiro`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
      { url: `${baseUrl}/suporte/faq`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
      { url: `${baseUrl}/termos`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
      { url: `${baseUrl}/privacidade`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    ];

    // 2. Perfis Públicos (Usuários e Marcas)
    // Consultamos o índice de usernames para garantir URLs amigáveis sem colisão
    const usernamesSnap = await db.collection('usernames').get();
    const uidToUsername: Record<string, string> = {};

    usernamesSnap.forEach(doc => {
      const data = doc.data();
      const username = doc.id;
      uidToUsername[data.uid] = username;
      
      routes.push({
        url: `${baseUrl}/${username}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.6
      });
    });

    // 3. Eventos Públicos (Ativos)
    // Mapeamento dinâmico: https://viby.club/[username]/[slug]
    const eventsSnap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .get();

    eventsSnap.forEach(doc => {
      const event = doc.data();
      const ownerId = event.organizationId || event.organizerId;
      const username = uidToUsername[ownerId] || 'evento';
      const slug = event.slug || doc.id;
      
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
    });

    return routes;

  } catch (error) {
    console.error("[Sitemap Generation Failure]", error);
    // Fallback de segurança para nunca retornar vazio ou erro 500 para o Google
    return [
      { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 }
    ];
  }
}
