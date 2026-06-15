
'use server';

import * as cheerio from 'cheerio';
import { getAdminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

const VIBY_OFFICIAL_UID = "dd9665af-ad6d-405c-a51d-08220fecf96f";

async function validateVibyAdmin(userId: string) {
  const db = getAdminDb();
  const memberRef = db.collection('organizations').doc(VIBY_OFFICIAL_UID).collection('members').doc(userId);
  const memberSnap = await memberRef.get();
  
  if (!memberSnap.exists) {
    const userSnap = await db.collection('users').doc(userId).get();
    if (userSnap.exists && userSnap.data()?.role === 'admin') return true;
    throw new Error("Acesso negado: Funcionalidade exclusiva da organização Viby.");
  }
  return true;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
    if (blockedHosts.includes(parsed.hostname)) return false;
    if (parsed.hostname.startsWith('10.') || parsed.hostname.startsWith('192.168.') || parsed.hostname.startsWith('172.')) return false;
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (e) {
    return false;
  }
}

export async function fetchEventDataFromUrl(url: string, userId: string) {
  try {
    await validateVibyAdmin(userId);

    if (!isSafeUrl(url)) {
      throw new Error("URL inválida ou insegura.");
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (VibyCrawler; +https://viby.club/support)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      throw new Error(`Falha ao carregar a página: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const data: any = {
      urlOriginal: url,
      method: 'fallback'
    };

    // 1. JSON-LD (Prioridade)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}');
        const event = Array.isArray(json) ? json.find(j => j['@type'] === 'Event') : (json['@type'] === 'Event' ? json : null);
        
        if (event) {
          data.titulo = event.name || data.titulo;
          data.descricao = event.description || data.descricao;
          data.dataInicio = event.startDate || data.dataInicio;
          data.dataFim = event.endDate || data.dataFim;
          data.imagem = Array.isArray(event.image) ? event.image[0] : (event.image?.url || event.image);
          
          if (event.location) {
            data.local = event.location.name || event.location.address?.name;
            data.endereco = event.location.address?.streetAddress;
            data.cidade = event.location.address?.addressLocality;
            data.estado = event.location.address?.addressRegion;
          }

          if (event.offers) {
            const offers = Array.isArray(event.offers) ? event.offers : [event.offers];
            data.precoMinimo = Math.min(...offers.map((o: any) => parseFloat(o.price)).filter(p => !isNaN(p)));
            data.precoMaximo = Math.max(...offers.map((o: any) => parseFloat(o.price)).filter(p => !isNaN(p)));
          }
          data.method = 'json-ld';
        }
      } catch (e) {}
    });

    // 2. Open Graph
    data.titulo = data.titulo || $('meta[property="og:title"]').attr('content') || $('title').text();
    data.descricao = data.descricao || $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content');
    data.imagem = data.imagem || $('meta[property="og:image"]').attr('content');
    if (data.method === 'fallback' && data.titulo) data.method = 'og';

    // 3. Fallback Heurístico
    if (!data.titulo) data.titulo = $('h1').first().text().trim();
    if (!data.descricao) data.descricao = $('article').first().text().trim() || $('main').first().text().trim();

    // Auditoria
    const db = getAdminDb();
    const userSnap = await db.collection('users').doc(userId).get();
    const domain = new URL(url).hostname;

    await db.collection('event_import_audit').add({
      url,
      domain,
      userId,
      userName: userSnap.data()?.name || "Admin",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      method: data.method,
      success: !!data.titulo
    });

    return { success: true, data };

  } catch (error: any) {
    console.error("[Event Import] Error:", error.message);
    return { success: false, error: error.message };
  }
}
