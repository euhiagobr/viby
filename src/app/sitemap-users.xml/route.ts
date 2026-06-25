import { getAdminDb } from '@/lib/firebase/admin';
import { buildUrlSet, normalizeRoutes, validateData, deduplicateGlobal, resolveUserRoute } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getAdminDb();
  const globalSet = new Set<string>();
  
  try {
    // 1. Load
    const snap = await db.collection('usernames').limit(5000).get();

    // 2. Normalize
    const rawUrls = snap.docs.map(doc => {
      const route = resolveUserRoute(doc.id);
      if (!route) return null;
      return {
        path: route,
        lastmod: doc.data().updatedAt?.toDate?.().toISOString() || new Date().toISOString()
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
