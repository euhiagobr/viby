import { getAdminDb } from '@/lib/firebase/admin';
import { buildUrlSet } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET() {
  const baseUrl = 'https://viby.club';
  try {
    const db = getAdminDb();
    const snap = await db.collection('usernames').get();
    
    const routes = snap.docs.map(doc => ({
      loc: `${baseUrl}/${doc.id}`,
      changefreq: 'weekly',
      priority: '0.7'
    }));

    return new Response(buildUrlSet(routes), {
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (e) {
    return new Response(buildUrlSet([]), {
      headers: { 'Content-Type': 'application/xml' },
    });
  }
}
