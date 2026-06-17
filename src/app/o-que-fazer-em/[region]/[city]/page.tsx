import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import CityPageClient from './CityPageClient';
import { notFound } from 'next/navigation';
import { slugifyLocation } from '@/lib/city-utils';

/**
 * @fileOverview Rota dinâmica para páginas de cidades.
 * Implementa fallback para dados legados que ainda não possuem índices de slug.
 */

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
    const normalizedRegion = regionParam.toLowerCase();
    const normalizedCity = citySlug.toLowerCase();

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
      // Essencial para eventos criados antes da implementação dos slugs de busca.
      const allActiveSnap = await db.collection('events')
        .where('status', '==', 'Ativo')
        .get();
      
      events = allActiveSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((e: any) => {
          const eCity = e.city || e.address?.city || "";
          const eState = e.state || e.address?.stateRegion || "";
          const eCountryCode = (e.countryCode || e.address?.countryCode || "BR").toLowerCase();
          
          if (!eCity || !eState) return false;

          const targetCitySlug = slugifyLocation(eCity);
          const targetStateSlug = slugifyLocation(eState);
          const targetRegionSlug = `${eCountryCode}-${targetStateSlug}`;

          return targetCitySlug === normalizedCity && targetRegionSlug === normalizedRegion;
        });
    }

    if (events.length === 0) return null;

    // Filtro temporal: Exibe eventos futuros ou que iniciaram há menos de 6 horas
    const futureEvents = events.filter((e: any) => {
      const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      const visibilityThreshold = new Date(d.getTime() + 6 * 60 * 60 * 1000);
      return visibilityThreshold >= now;
    }).sort((a: any, b: any) => {
      const dA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const dB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
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
