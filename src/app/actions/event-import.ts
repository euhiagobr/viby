'use server';

import * as cheerio from 'cheerio';
import { getAdminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

const VIBY_OFFICIAL_UID = "dd9665af-ad6d-405c-a51d-08220fecf96f";

/**
 * Valida se o usuário tem permissão para usar a ferramenta de importação.
 */
async function validateVibyAdmin(userId: string) {
  const db = getAdminDb();
  const memberRef = db.collection('organizations').doc(VIBY_OFFICIAL_UID).collection('members').doc(userId);
  const memberSnap = await memberRef.get();
  
  if (!memberSnap.exists) {
    const userSnap = await db.collection('users').doc(userId).get();
    const userData = userSnap.data();
    if (userSnap.exists && userData?.role === 'admin') return true;
    
    console.error(`[Event Import] Acesso negado para o usuário ${userId}.`);
    throw new Error("Acesso negado: Funcionalidade exclusiva da organização Viby.");
  }
  return true;
}

/**
 * Proteção básica contra SSRF e URLs maliciosas.
 */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
    if (blockedHosts.includes(parsed.hostname)) return false;
    // Bloqueia IPs privados (RFC1918)
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(parsed.hostname)) return false;
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (e) {
    return false;
  }
}

/**
 * Busca e extrai dados de um evento a partir de uma URL externa.
 */
export async function fetchEventDataFromUrl(url: string, userId: string) {
  console.log(`[Event Import] Processando URL: ${url}`);
  
  try {
    await validateVibyAdmin(userId);

    if (!isSafeUrl(url)) {
      throw new Error("URL inválida ou insegura.");
    }

    // Configuração de timeout para evitar travamento do servidor
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos

    let response;
    try {
      // Fetch com headers que simulam um navegador real para evitar bloqueios simples de WAF
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Referer': 'https://www.google.com/',
        },
        signal: controller.signal,
        next: { revalidate: 0 },
        cache: 'no-store'
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      console.error(`[Event Import] Erro de rede:`, fetchErr.message);
      
      if (fetchErr.name === 'AbortError') {
        throw new Error("Tempo de resposta esgotado (Timeout). O site de origem está lento.");
      }
      
      throw new Error(`Falha de conexão: O site de origem (ex: Sympla/Ingresse) pode estar bloqueando requisições automatizadas vindas de servidores cloud.`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      console.error(`[Event Import] HTTP Error: ${response.status}`);
      if (response.status === 403 || response.status === 401) {
        throw new Error("Acesso negado pelo site de origem (403 Forbidden). Proteção anti-bot detectada.");
      }
      throw new Error(`O site de origem retornou erro ${response.status}.`);
    }

    const html = await response.text();
    if (!html || html.length < 200) {
      throw new Error("Conteúdo da página vazio ou insuficiente.");
    }

    const $ = cheerio.load(html);
    const data: any = {
      urlOriginal: url,
      method: 'none'
    };

    // ESTRATÉGIA 1: JSON-LD (DADOS ESTRUTURADOS)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const text = $(el).html() || '';
        const json = JSON.parse(text);
        const items = Array.isArray(json) ? json : [json];
        
        // Procura por objeto do tipo Event
        const event = items.find((item: any) => 
          item['@type'] === 'Event' || 
          (Array.isArray(item['@type']) && item['@type'].includes('Event'))
        );
        
        if (event) {
          console.log(`[Event Import] Extraído via JSON-LD`);
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
            const prices = offers.map((o: any) => parseFloat(o.price)).filter(p => !isNaN(p));
            if (prices.length > 0) {
              data.precoMinimo = Math.min(...prices);
              data.precoMaximo = Math.max(...prices);
            }
          }
          data.method = 'json-ld';
        }
      } catch (e) {
        // Parse error no JSON individual, continua
      }
    });

    // ESTRATÉGIA 2: OPEN GRAPH
    if (!data.titulo) data.titulo = $('meta[property="og:title"]').attr('content');
    if (!data.descricao) data.descricao = $('meta[property="og:description"]').attr('content');
    if (!data.imagem) data.imagem = $('meta[property="og:image"]').attr('content');
    if (data.method === 'none' && data.titulo) data.method = 'og';

    // ESTRATÉGIA 3: META TAGS E HTML
    if (!data.titulo) data.titulo = $('title').text()?.split('|')[0]?.split('-')[0]?.trim();
    if (!data.titulo) data.titulo = $('h1').first().text().trim();
    if (!data.descricao) data.descricao = $('meta[name="description"]').attr('content');
    if (data.method === 'none' && data.titulo) data.method = 'html-scraping';

    // REGISTRO DE AUDITORIA
    const db = getAdminDb();
    await db.collection('event_import_audit').add({
      url,
      domain: new URL(url).hostname,
      userId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      method: data.method,
      success: !!data.titulo
    });

    if (!data.titulo) {
      throw new Error("Não foi possível identificar informações estruturadas nesta página.");
    }

    return { success: true, data };

  } catch (error: any) {
    console.error("[Event Import Action Failure]:", error.message);
    return { success: false, error: error.message || "Erro desconhecido na importação" };
  }
}
