import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAdminDb, getAdminApp } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * @fileOverview API Route para captura automática de capas reais de cidades.
 * Busca imagens em repositórios públicos (Flickr/Unsplash via LoremFlickr) baseada no nome da cidade.
 * Remove dependência de IA para garantir fotos reais de pontos turísticos e skylines conforme regras.
 */

const VIBY_DEFAULT_CITY_COVER = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

export async function POST(req: Request) {
  console.log('[CITY COVER API] START - BUSCA DE IMAGEM REAL');
  
  try {
    const input = await req.json();
    const { city, state, country, slug } = input;

    if (!slug || !city) {
      throw new Error("Dados da cidade insuficientes para busca.");
    }

    // 1. Definir termos de busca para localizar imagens reais representativas
    // Foco: Skyline, Pontos Turísticos, Centro Urbano, Turismo
    const searchTerms = `${city.replace(/\s+/g, ',')},skyline,tourism,landmarks`;
    const searchUrl = `https://loremflickr.com/1536/1024/${encodeURIComponent(searchTerms)}/all`;
    
    console.log('[CITY COVER API] BUSCANDO EM REPOSITÓRIO REAL:', searchUrl);

    // 2. Download da imagem real via proxy de repositório público
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s para download e processamento

    const imageResponse = await fetch(searchUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'VibyCityPageEngine/1.2' },
      cache: 'no-store'
    });

    clearTimeout(timeoutId);

    if (!imageResponse.ok) {
      throw new Error("O repositório de imagens reais não respondeu no tempo esperado.");
    }

    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    
    if (buffer.length < 5000) {
      throw new Error("Arquivo retornado é inválido ou insuficiente.");
    }

    console.log('[CITY COVER API] IMAGEM REAL LOCALIZADA. INICIANDO PERSISTÊNCIA NO STORAGE.');

    // 3. Salvar no Firebase Storage oficial da Viby
    const app = getAdminApp();
    const bucket = admin.storage(app).bucket('vibyeventos.firebasestorage.app');
    const filePath = `city-covers/${slug}.jpg`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000, immutable'
      }
    });

    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    // 4. Persistir a URL no documento da cidade no Firestore
    const db = getAdminDb();
    await db.collection('cityPages').doc(slug).set({
      coverImage: publicUrl,
      cityCoverUrl: publicUrl, // Campo solicitado para novo padrão de persistência
      coverGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('[CITY COVER API] SUCESSO: Capa real vinculada à cidade.');
    return NextResponse.json({ url: publicUrl, success: true });

  } catch (error: any) {
    console.error('[CITY COVER API ERROR]', error.message);
    
    // Retorna fallback institucional em caso de falha na rede externa ou busca
    return NextResponse.json({ 
      error: true, 
      message: error.message,
      url: VIBY_DEFAULT_CITY_COVER 
    }, { status: 500 });
  }
}
