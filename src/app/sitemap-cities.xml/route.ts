import { getAdminDb } from '@/lib/firebase/admin';
import { buildUrlSet, normalizeRoutes, validateData, deduplicateGlobal } from '@/lib/sitemap-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getAdminDb();
  const globalSet = new Set<string>();
  
  try {
    // 1. Load
    const snap = await db.collection('cityPages').get();
    
    // 2. Normalize
    const rawUrls = snap.docs.map(doc => {
      const data = doc.data();
      const parts = doc.id.split('-'); 
      return {
        path: `/o-que-fazer-em/${parts[0]}-${parts[1]}/${parts.slice(2).join('-')}`,
        lastmod: data.updatedAt?.toDate?.().toISOString() || new Date().toISOString()
      };
    });

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
