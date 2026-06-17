import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as admin from 'firebase-admin';
import { getAdminDb, getAdminApp } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * @fileOverview API Route para geração de imagens de capa de cidades.
 * Isolado para evitar timeouts de Server Actions.
 */
export async function POST(req: Request) {
  console.log('[CITY COVER API] START');
  try {
    const input = await req.json();
    console.log('[CITY COVER API] INPUT', input);

    const { city, state, country, topCategories = [], slug } = input;

    if (!slug || !city) {
      throw new Error("Slug e Cidade são obrigatórios.");
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não localizada no ambiente.");
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const categoriesText = topCategories.length > 0 
      ? `Incorporar sutilmente a energia das seguintes categorias populares: ${topCategories.join(", ")}.` 
      : "manter foco geral em turismo e vida urbana.";

    const promptText = `Crie uma imagem fotorealista premium em formato de banner horizontal representando a cidade de ${city}, ${state}, ${country}.

A imagem deve ser usada como capa oficial de uma plataforma de eventos e experiências chamada Viby.

FOCO PRINCIPAL
Representar visualmente o que fazer na cidade através de:
* cultura local
* turismo urbano
* vida noturna (se aplicável)
* eventos e experiências
* arquitetura e pontos icônicos reais da cidade

COMPOSIÇÃO VISUAL
* Estilo fotorealista ultra detalhado
* Iluminação cinematográfica natural (golden hour ou blue hour)
* Profundidade de campo suave
* Atmosfera vibrante e moderna
* Sensação de cidade viva e ativa
* Estética de capa de portal global de eventos e turismo

ELEMENTOS DA CIDADE
Incluir referências visuais reais e reconhecíveis de ${city} quando possível, como:
* skyline
* pontos turísticos
* áreas culturais
* regiões urbanas icônicas
* paisagens naturais próximas

CATEGORIAS DE EVENTOS (INFLUÊNCIA VISUAL)
${categoriesText}

IDENTIDADE VIBY
Integrar de forma extremamente sutil:
* sensação de plataforma moderna de eventos
* lifestyle urbano contemporâneo
* não incluir logos visíveis
* não incluir textos
* não incluir marcas d’água

RESTRIÇÕES ABSOLUTAS
* NÃO adicionar texto
* NÃO adicionar logotipos
* NÃO adicionar QR codes
* NÃO adicionar preços
* NÃO adicionar datas
* NÃO adicionar banners promocionais
* NÃO adicionar elementos políticos
* NÃO adicionar conteúdo ofensivo
* NÃO estilizar como propaganda explícita

FORMATO OBRIGATÓRIO
* 1536x1024 (horizontal)
* estilo editorial premium
* qualidade publicitária global`;

    console.log('[CITY COVER API] OPENAI CALLED');
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: promptText,
      size: "1536x1024"
    });

    // AUDITORIA DA RESPOSTA OPENAI
    console.log(
      '[CITY COVER API] OPENAI RAW RESPONSE',
      JSON.stringify(response, null, 2)
    );

    console.log(
      '[CITY COVER API] OPENAI DATA',
      response.data
    );

    console.log(
      '[CITY COVER API] ITEM 0',
      response.data?.[0]
    );

    const openaiUrl = response.data[0]?.url;
    if (!openaiUrl) throw new Error("A OpenAI não retornou uma URL válida.");

    console.log('[CITY COVER API] DOWNLOADING IMAGE');
    const imageFetch = await fetch(openaiUrl);
    if (!imageFetch.ok) throw new Error("Falha ao baixar imagem da OpenAI");
    const buffer = Buffer.from(await imageFetch.arrayBuffer());

    console.log('[CITY COVER API] STORAGE UPLOAD');
    const app = getAdminApp();
    // CORREÇÃO: Definição explícita do bucket para evitar falha do Admin SDK
    const bucket = admin.storage(app).bucket('vibyeventos.firebasestorage.app');
    const filePath = `city-covers/${slug}.png`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000, immutable'
      }
    });

    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    console.log('[CITY COVER API] DB UPDATE');
    const db = getAdminDb();
    await db.collection('cityPages').doc(slug).update({
      coverImage: publicUrl,
      coverGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('[CITY COVER API] SUCCESS URL:', publicUrl);
    return NextResponse.json({ url: publicUrl });
  } catch (error: any) {
    console.error('[CITY COVER API ERROR]', error);
    return NextResponse.json({ 
      error: true, 
      message: error.message || "Erro interno na API de geração" 
    }, { status: 500 });
  }
}
