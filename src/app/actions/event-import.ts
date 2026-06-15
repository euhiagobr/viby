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
    const userData = userSnap.data();
    if (userSnap.exists && userData?.role === 'admin') return true;
    throw new Error("Acesso negado: Exclusivo organização Viby.");
  }
  return true;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
    if (blockedHosts.includes(parsed.hostname)) return false;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(parsed.hostname)) return false;
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="121", "Not(A:Brand";v="24", "Google Chrome";v="121"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Upgrade-Insecure-Requests': '1'
        },
        signal: controller.signal,
        next: { revalidate: 0 },
        cache: 'no-store'
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') throw new Error("O site demorou muito para responder (Timeout).");
      throw new Error("O site bloqueou a conexão do servidor (Cloud Block). Tente colar os dados manualmente.");
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      if (response.status === 403) throw new Error("Acesso negado (403) pelo site de origem.");
      throw new Error(`HTTP Error ${response.status}`);
    }

    const html = await response.text();
    if (!html || html.length < 500) throw new Error("Conteúdo insuficiente na página.");

    const $ = cheerio.load(html);
    const data: any = { urlOriginal: url, method: 'none' };

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).html();
        if (!raw) return;
        const json = JSON.parse(raw);
        const items = Array.isArray(json) ? json : [json];
        const event = items.find((item: any) => 
          item['@type'] === 'Event' || 
          (Array.isArray(item['@type']) && item['@type'].includes('Event')) ||
          item['@context']?.includes('schema.org') && item.name
        );
        
        if (event) {
          data.titulo = event.name || data.titulo;
          data.descricao = event.description || data.descricao;
          data.dataInicio = event.startDate || data.dataInicio;
          data.dataFim = event.endDate || data.dataFim;
          data.imagem = Array.isArray(event.image) ? event.image[0] : (event.image?.url || event.image);
          if (event.location) {
            data.local = event.location.name || event.location.address?.name;
            data.cidade = event.location.address?.addressLocality;
            data.estado = event.location.address?.addressRegion;
          }
          data.method = 'json-ld';
        }
      } catch (e) {}
    });

    if (!data.titulo) {
      data.titulo = $('meta[property="og:title"]').attr('content') || $('title').text()?.split('|')[0]?.trim();
      data.descricao = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content');
      data.imagem = $('meta[property="og:image"]').attr('content');
      if (data.titulo && data.method === 'none') data.method = 'og-meta';
    }

    if (!data.titulo) throw new Error("Dados não localizados. O site pode ser protegido contra extração.");

    const db = getAdminDb();
    await db.collection('event_import_audit').add({
      url,
      userId,
      domain: new URL(url).hostname,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      method: data.method,
      success: true
    });

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
