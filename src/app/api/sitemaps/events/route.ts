import { getAdminDb } from '@/lib/firebase/admin';
import { buildUrlSet, normalizeRoutes, validateData, deduplicateGlobal, isValidUsername } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getAdminDb();
  const globalSet = new Set<string>();
  
  try {
    // 1. Load
    const snap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .limit(3000)
      .get();

    // 2. Normalize
    const rawUrls = snap.docs.map(doc => {
      const data = doc.data();
      const username = data.organizer?.username || data.username;
      if (!isValidUsername(username)) return null;

      return {
        path: `/${username.toLowerCase()}/${data.slug || doc.id}`,
        lastmod: data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
        priority: '0.9'
      };
    }).filter(Boolean) as any[];

    // 3. Validate & 4. Deduplicate
    const normalized = normalizeRoutes(rawUrls);
    const validated = validateData(normalized);
    const unique = deduplicateGlobal(validated, globalSet);

    // 5. Build
    return new Response(buildUrlSet(unique), {
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (e) {
    return new Response(buildUrlSet([]), { headers: { 'Content-Type': 'application/xml' } });
  }
}
