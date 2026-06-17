import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import CityPageClient from './CityPageClient';
import { notFound } from 'next/navigation';
import { slugifyLocation } from '@/lib/city-utils';

/**
 * @fileOverview Rota dinâmica para páginas de cidades.
 * Força a execução dinâmica para garantir que as atualizações de manutenção reflitam imediatamente.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function serializeData(data: any): any {
  if (data === null || data === undefined) return null;
  if (typeof data.toDate === 'function') return data.toDate().toISOString();
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(item => serializeData(item));
  if (typeof data === 'object') {
    const proto = Object.getPrototypeOf(data);
    if (proto !== null && proto !== Object.prototype) return String(data);
    const serialized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        serialized[key] = serializeData(data[key]);
      }
    }
    return serialized;
  }
  return data;
}

async function getCityData(regionParam: string, citySlug: string) {
  try {
    const db = getAdminDb();
    const now = new Date();
    const normalizedRegion = regionParam.toLowerCase().trim();
    const normalizedCity = citySlug.toLowerCase().trim();

    // 1. Tentar consulta otimizada por índice de slugs (Performática)
    const officialSnap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .where('regionSlug', '==', normalizedRegion)
      .where('citySlug', '==', normalizedCity)
      .get();

    let events = [];

    if (!officialSnap.empty) {
      events = officialSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      // 2. FALLBACK RESILIENTE: Buscar todos os ativos e filtrar em memória
      // Essencial enquanto o cache de busca do Next.js ou do Firestore não propaga o backfill.
      const allActiveSnap = await db.collection('events')
        .where('status', '==', 'Ativo')
        .get();
      
      events = allActiveSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((e: any) => {
          const eCity = e.city || e.address?.city || "";
          const eState = e.state || e.address?.stateRegion || "";
          const eCountryCode = (e.countryCode || e.address?.countryCode || "br").toLowerCase();
          
          if (!eCity || !eState) return false;

          const targetCitySlug = slugifyLocation(eCity);
          const targetStateSlug = slugifyLocation(eState);
          const targetRegionSlug = `${eCountryCode}-${targetStateSlug}`;

          return targetCitySlug === normalizedCity && targetRegionSlug === normalizedRegion;
        });
    }

    if (events.length === 0) return null;

    // Filtro temporal: Exibe eventos que ainda não terminaram (Tolerância de 6h)
    const futureEvents = events.filter((e: any) => {
      const dateVal = e.date || e.startDate;
      const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
      if (isNaN(d.getTime())) return false;
      const visibilityThreshold = new Date(d.getTime() + 6 * 60 * 60 * 1000);
      return visibilityThreshold >= now;
    }).sort((a: any, b: any) => {
      const dateA = a.date || a.startDate;
      const dateB = b.date || b.startDate;
      const dA = dateA?.toDate ? dateA.toDate() : new Date(dateA);
      const dB = dateB?.toDate ? dateB.toDate() : new Date(dateB);
      return dA.getTime() - dB.getTime();
    });

    if (futureEvents.length === 0) return null;

    const referenceEvent = futureEvents[0];
    return serializeData({
      events: futureEvents,
      cityName: referenceEvent.city || referenceEvent.address?.city || "Cidade",
      state: referenceEvent.state || referenceEvent.address?.stateRegion || "UF",
      country: referenceEvent.country || referenceEvent.address?.country || "Brasil"
    });
  } catch (e) {
    console.error("[CityData Error]", e);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ region: string, city: string }> }): Promise<Metadata> {
  const { region, city } = await params;
  const data = await getCityData(region, city);
  
  if (!data) return { title: 'Eventos não encontrados | Viby', robots: { index: false } };

  const title = `O que fazer em ${data.cityName} - Eventos, Shows e Festas | Viby`;
  const description = `Confira os próximos eventos em ${data.cityName}. Shows, festas, feiras, experiências e muito mais na Viby.`;
  const url = `https://viby.club/o-que-fazer-em/${region}/${city}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Viby',
      images: [{ url: 'https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417', width: 1200, height: 630 }],
      type: 'website',
      locale: 'pt_BR',
    },
    robots: { index: true, follow: true }
  };
}

export default async function CityDynamicPage({ params }: { params: Promise<{ region: string, city: string }> }) {
  const { region, city } = await params;
  const data = await getCityData(region, city);

  if (!data) {
    notFound();
  }

  const regionLabel = `${data.country} - ${data.state}`;

  return (
    <CityPageClient 
      initialEvents={data.events} 
      cityName={data.cityName}
      citySlug={city}
      regionSlug={region}
      regionLabel={regionLabel}
    />
  );
}
