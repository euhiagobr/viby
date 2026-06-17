import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as admin from 'firebase-admin';
import { getAdminDb, getAdminApp } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * @fileOverview API Route para geração de imagens de capa de cidades com auditoria de performance.
 */
export async function POST(req: Request) {
  console.log('[STEP 1] REQUEST RECEBIDA');
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn('[CITY COVER API] EXCEDEU 60s - ABORTANDO');
    controller.abort();
  }, 60000);

  try {
    console.log('[STEP 2] VALIDANDO PAYLOAD');
    const input = await req.json();
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
FOCO PRINCIPAL: cultura local, turismo urbano, eventos e experiências.
FORMATO OBRIGATÓRIO: 1536x1024 (horizontal). Estilo editorial premium. SEM TEXTOS.`;

    console.log('[STEP 3] INICIANDO OPENAI');
    console.time('OPENAI_IMAGE_GENERATION');

    let response;
    try {
      response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: promptText,
        size: "1536x1024"
      }, { signal: controller.signal });
    } catch (apiErr: any) {
      if (apiErr.name === 'AbortError') {
        console.timeEnd('OPENAI_IMAGE_GENERATION');
        return NextResponse.json({ error: true, message: 'OpenAI timeout' }, { status: 504 });
      }
      throw apiErr;
    }

    console.timeEnd('OPENAI_IMAGE_GENERATION');
    console.log('[STEP 4] OPENAI FINALIZOU');

    console.log('[STEP 5] PROCESSANDO RESPOSTA');
    const openaiUrl = response.data[0]?.url;
    if (!openaiUrl) throw new Error("A OpenAI não retornou uma URL válida.");

    console.log('[STEP 6] DOWNLOAD DA IMAGEM INICIADO');
    const imageFetch = await fetch(openaiUrl, { signal: controller.signal });
    if (!imageFetch.ok) throw new Error("Falha ao baixar imagem da OpenAI");
    const buffer = Buffer.from(await imageFetch.arrayBuffer());
    console.log('[STEP 6] DOWNLOAD DA IMAGEM FINALIZADO');

    console.log('[STEP 7] UPLOAD FIREBASE INICIADO');
    const app = getAdminApp();
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
    console.log('[STEP 7] UPLOAD FIREBASE FINALIZADO');

    console.log('[STEP 8] SALVANDO NO BANCO');
    const db = getAdminDb();
    await db.collection('cityPages').doc(slug).update({
      coverImage: publicUrl,
      coverGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    clearTimeout(timeoutId);
    console.log('[STEP 9] RETORNANDO RESPONSE');
    return NextResponse.json({ url: publicUrl });

  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('[CITY COVER FATAL ERROR]');
    console.error(error);
    if (error.stack) console.error(error.stack);
    
    return NextResponse.json({ 
      error: true, 
      message: error.message || "Erro interno na API de geração" 
    }, { status: 500 });
  }
}
