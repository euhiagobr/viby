'use server';

import * as admin from 'firebase-admin';
import { getAdminDb, getAdminApp } from '@/lib/firebase/admin';

/**
 * @fileOverview Serviço centralizado para captura e persistência de capas de cidades.
 * Busca imagens reais focadas em pontos turísticos e marcos icônicos.
 */

const VIBY_DEFAULT_CITY_COVER = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

export async function processCityCoverGeneration(params: {
  slug: string;
  city: string;
  state: string;
  country: string;
  categories?: string[];
}) {
  const { city, slug, state, country } = params;

  try {
    console.log(`[CITY COVER SERVICE] Iniciando geração para: ${city}, ${state}`);
    
    // 1. Termos de busca refinados. 
    // Usar o nome da cidade + estado + landmark garante maior precisão geográfica.
    const searchTerms = `${city},${state},landmark,tourism`.toLowerCase().replace(/\s+/g, ',');
    
    // Adicionamos um seed aleatório (lock) para evitar que o serviço retorne a mesma imagem 
    // de fallback para requisições similares em sequência.
    const seed = Math.floor(Math.random() * 1000000);
    const searchUrl = `https://loremflickr.com/1920/1080/${encodeURIComponent(searchTerms)}/all?lock=${seed}`;

    console.log(`[CITY COVER SERVICE] Fetching: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      cache: 'no-store',
      headers: { 
        'User-Agent': 'VibyCityPageEngine/1.4',
        'Accept': 'image/*'
      }
    });

    if (!response.ok) throw new Error(`Falha no fetch: ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (buffer.length < 5000) throw new Error("Imagem retornada é inválida ou muito pequena.");

    // 2. Salvar no Storage
    const app = getAdminApp();
    const bucket = admin.storage(app).bucket('vibyeventos.firebasestorage.app');
    const filePath = `city-covers/${slug}.jpg`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000, immutable',
        customMetadata: {
          city,
          state,
          generatedAt: new Date().toISOString()
        }
      }
    });

    await file.makePublic();
    
    // Adicionamos timestamp na URL para forçar o refresh no cliente após regerar
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}?v=${Date.now()}`;

    // 3. Atualizar Firestore
    const db = getAdminDb();
    await db.collection('cityPages').doc(slug).set({
      coverImage: publicUrl,
      cityCoverUrl: publicUrl,
      city,
      state,
      country,
      coverGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`[CITY COVER SERVICE] Sucesso: ${publicUrl}`);
    return { success: true, url: publicUrl };

  } catch (error: any) {
    console.error("[CITY COVER SERVICE ERROR]", error.message);
    return { success: false, error: error.message, url: VIBY_DEFAULT_CITY_COVER };
  }
}
