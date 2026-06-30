
import { getAdminDb } from '@/lib/firebase/admin';
import { buildUrlSet, normalizeRoutes, validateData, deduplicateGlobal, isValidUsername } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getAdminDb();
  const globalSet = new Set<string>();
  
  try {
    const snap = await db.collection('experiences')
      .where('status', '==', 'active')
      .limit(2000)
      .get();

    const rawUrls = snap.docs.map(doc => {
      const data = doc.data();
      const username = data.organizer?.username;
      if (!isValidUsername(username)) return null;

      return {
        path: `/${username.toLowerCase()}/experiencia/${data.slug || doc.id}`,
        lastmod: data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
        priority: '0.8'
      };
    }).filter(Boolean) as any[];

    const normalized = normalizeRoutes(rawUrls);
    const validated = validateData(normalized);
    const unique = deduplicateGlobal(validated, globalSet);

    return new Response(buildUrlSet(unique), {
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (e) {
    return new Response(buildUrlSet([]), { headers: { 'Content-Type': 'application/xml' } });
  }
}
