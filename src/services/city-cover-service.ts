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
}) {
  const { city, slug } = params;

  try {
    console.log(`[CITY COVER SERVICE] Buscando ponto turístico icônico para: ${city}`);
    
    // 1. Termos de busca refinados para capturar marcos famosos (Ex: Cristo no Rio, Gasômetro em POA)
    const searchTerms = `${city.replace(/\s+/g, ',')},landmark,famous,monument,tourism,cityscape`;
    const searchUrl = `https://loremflickr.com/1920/1080/${encodeURIComponent(searchTerms)}/all`;

    const response = await fetch(searchUrl, {
      cache: 'no-store',
      headers: { 'User-Agent': 'VibyCityPageEngine/1.3' }
    });

    if (!response.ok) throw new Error("Falha ao acessar repositório de imagens.");

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 5000) throw new Error("Imagem inválida ou muito pequena.");

    // 2. Salvar no Storage
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

    // 3. Atualizar Firestore
    const db = getAdminDb();
    await db.collection('cityPages').doc(slug).set({
      coverImage: publicUrl,
      cityCoverUrl: publicUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`[CITY COVER SERVICE] Capa gerada com sucesso: ${publicUrl}`);
    return { success: true, url: publicUrl };

  } catch (error: any) {
    console.error("[CITY COVER SERVICE ERROR]", error.message);
    return { success: false, error: error.message, url: VIBY_DEFAULT_CITY_COVER };
  }
}
