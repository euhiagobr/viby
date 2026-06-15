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
    
    console.error(`[Event Import] Acesso negado para o usuário ${userId}. Não é admin nem membro da Org Oficial.`);
    throw new Error("Acesso negado: Funcionalidade exclusiva da organização Viby.");
  }
  return true;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
    if (blockedHosts.includes(parsed.hostname)) return false;
    // Bloqueia IPs privados
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(parsed.hostname)) return false;
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (e) {
    return false;
  }
}

export async function fetchEventDataFromUrl(url: string, userId: string) {
  console.log(`[Event Import] Iniciando importação da URL: ${url} por Usuário: ${userId}`);
  
  try {
    await validateVibyAdmin(userId);

    if (!isSafeUrl(url)) {
      console.error(`[Event Import] URL considerada insegura ou inválida: ${url}`);
      throw new Error("URL inválida ou insegura.");
    }

    let response;
    try {
      // Cabeçalhos aprimorados para emular um navegador real e evitar bloqueios (WAF/Cloudflare/etc)
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Referer': 'https://www.google.com/',
          'Upgrade-Insecure-Requests': '1',
          'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'cross-site',
          'sec-fetch-user': '?1'
        },
        next: { revalidate: 0 },
        cache: 'no-store'
      });
    } catch (fetchErr: any) {
      console.error(`[Event Import] Erro de rede ou DNS no fetch:`, fetchErr.message || fetchErr);
      throw new Error(`Falha de conexão com o servidor de origem: ${fetchErr.message || 'Verifique o link e tente novamente'}`);
    }

    if (!response.ok) {
      console.error(`[Event Import] Falha no fetch. Status: ${response.status} ${response.statusText}`);
      if (response.status === 403 || response.status === 401) {
        throw new Error("O site de origem bloqueou a tentativa de leitura. Isso geralmente ocorre por medidas de proteção contra robôs do site (ex: Sympla/Eventbrite).");
      }
      throw new Error(`Falha ao carregar a página: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    if (!html || html.length < 100) {
      console.error(`[Event Import] HTML retornado vazio ou muito curto.`);
      throw new Error("O conteúdo da página não pôde ser lido.");
    }

    const $ = cheerio.load(html);
    
    const data: any = {
      urlOriginal: url,
      method: 'none'
    };

    // --- ESTRATÉGIA 1: JSON-LD (Prioridade máxima por ser estruturado) ---
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}');
        const event = Array.isArray(json) ? json.find(j => j['@type'] === 'Event') : (json['@type'] === 'Event' ? json : null);
        
        if (event) {
          console.log(`[Event Import] JSON-LD detectado.`);
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
        // Erro no parse de um bloco JSON-LD específico, ignorar e tentar outros
      }
    });

    // --- ESTRATÉGIA 2: Open Graph (Metadados de redes sociais) ---
    if (!data.titulo) data.titulo = $('meta[property="og:title"]').attr('content');
    if (!data.descricao) data.descricao = $('meta[property="og:description"]').attr('content');
    if (!data.imagem) data.imagem = $('meta[property="og:image"]').attr('content');
    if (data.method === 'none' && data.titulo) data.method = 'og';

    // --- ESTRATÉGIA 3: Meta Tags Padrão ---
    if (!data.titulo) data.titulo = $('title').text();
    if (!data.descricao) data.descricao = $('meta[name="description"]').attr('content');
    if (data.method === 'none' && data.titulo) data.method = 'meta';

    // --- ESTRATÉGIA 4: Extração Heurística (Fallback) ---
    if (!data.titulo) data.titulo = $('h1').first().text().trim();
    if (!data.descricao) {
      // Tenta pegar o primeiro bloco grande de texto
      data.descricao = $('article').first().text().trim() || 
                       $('main').find('p').first().parent().text().trim();
    }
    if (data.method === 'none' && data.titulo) data.method = 'heuristica';

    // Auditoria
    const db = getAdminDb();
    const domain = new URL(url).hostname;

    await db.collection('event_import_audit').add({
      url,
      domain,
      userId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      method: data.method,
      success: !!data.titulo
    });

    if (!data.titulo) {
      throw new Error("Não foi possível extrair informações úteis desta página.");
    }

    console.log(`[Event Import] Sucesso via: ${data.method}`);
    return { success: true, data };

  } catch (error: any) {
    console.error("[Event Import] Erro Crítico:", error.message);
    return { success: false, error: error.message };
  }
}
