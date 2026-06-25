
import { getAdminDb } from '@/lib/firebase/admin';
import { buildUrlSet, isValidUsername } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

/**
 * @fileOverview Sitemap Segmentado: Perfis de Usuários (Membros e Marcas).
 * Filtra IDs numéricos e garante que apenas usernames reais sejam indexados.
 */
export async function GET() {
  const baseUrl = 'https://viby.club';
  const db = getAdminDb();
  
  try {
    const snap = await db.collection('usernames')
      .where('uid', '!=', '')
      .limit(5000)
      .get();

    const urls = snap.docs
      .map(doc => doc.id)
      .filter(isValidUsername)
      .map(username => ({
        loc: `${baseUrl}/${username}`,
        priority: '0.6',
        changefreq: 'weekly'
      }));

    return new Response(buildUrlSet(urls), {
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (e) {
    return new Response(buildUrlSet([]), {
      headers: { 'Content-Type': 'application/xml' },
    });
  }
}
