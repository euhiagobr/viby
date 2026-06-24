import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import CityPageClient from './CityPageClient';
import { notFound } from 'next/navigation';
import { slugifyLocation } from '@/lib/city-utils';
import { generateAndPersistCityCover } from '@/app/actions/city-pages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_CITY_COVER = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

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

async function getCityData(regionParam: string, citySlugParam: string) {
  const db = getAdminDb();
  const now = new Date();
  const normalizedRegion = regionParam.toLowerCase().trim();
  const normalizedCity = citySlugParam.toLowerCase().trim();
  const citySlugId = `${normalizedRegion}-${normalizedCity}`;

  try {
    // 1. Buscar metadados da página
    const cityPageSnap = await db.collection('cityPages').doc(citySlugId).get();
    let cityMeta = cityPageSnap.exists ? cityPageSnap.data() : null;

    // 2. Buscar eventos
    const officialSnap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .where('regionSlug', '==', normalizedRegion)
      .where('citySlug', '==', normalizedCity)
      .get();

    let events = [];
    if (!officialSnap.empty) {
      events = officialSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      const allActiveSnap = await db.collection('events')
        .where('status', '==', 'Ativo')
        .get();
      
      events = allActiveSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((e: any) => {
          const eCity = e.city || e.address?.city || "";
          const eState = e.state || e.address?.stateRegion || "";
          const eCountryCode = (e.countryCode || e.address?.countryCode || "br").toLowerCase();
          const targetCitySlug = slugifyLocation(eCity);
          const targetStateSlug = slugifyLocation(eState);
          const targetRegionSlug = `${eCountryCode}-${targetStateSlug}`;
          return targetCitySlug === normalizedCity && 
                 (targetRegionSlug === normalizedRegion || eState.toLowerCase() === normalizedRegion.split('-')[1]);
        });
    }

    const futureEvents = events.filter((e: any) => {
      const dateVal = e.date || e.startDate;
      if (!dateVal) return false;
      let d: Date = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
      const visibilityThreshold = new Date(d.getTime() + 6 * 60 * 60 * 1000);
      return visibilityThreshold >= now;
    }).sort((a: any, b: any) => {
      const dA = new Date(a.date || a.startDate).getTime();
      const dB = new Date(b.date || b.startDate).getTime();
      return dA - dB;
    });

    if (futureEvents.length === 0 && !cityPageSnap.exists) return null;

    const referenceEvent = futureEvents[0] || {};
    const cityName = referenceEvent.city || referenceEvent.address?.city || cityMeta?.city || "Cidade";
    const state = referenceEvent.state || referenceEvent.address?.stateRegion || cityMeta?.state || "UF";
    const country = referenceEvent.country || referenceEvent.address?.country || cityMeta?.country || "Brasil";

    // 3. Gatilho de Geração de Capa Real se faltar
    if (!cityMeta?.cityCoverUrl && !cityMeta?.coverImage) {
      const categories = Array.from(new Set(futureEvents.map((e: any) => e.categoryName).filter(Boolean)));
      generateAndPersistCityCover({
        slug: citySlugId,
        city: cityName,
        state: state,
        country: country,
        categories: categories as string[]
      }).catch(() => {});
    }

    return serializeData({
      events: futureEvents,
      cityName,
      state,
      country,
      coverImage: cityMeta?.cityCoverUrl || cityMeta?.coverImage || DEFAULT_CITY_COVER
    });
  } catch (e: any) {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ region: string, city: string }> }): Promise<Metadata> {
  const { region, city } = await params;
  const data = await getCityData(region, city);
  
  if (!data) return { title: 'Eventos não encontrados | Viby', robots: { index: false } };

  const title = `O que fazer em ${data.cityName} - Eventos, Shows, Festas e Programação | Viby`;
  const description = `Confira os próximos eventos em ${data.cityName}. Shows, festas, feiras, experiências, cultura, gastronomia e muito mais na Viby.`;
  const image = data.coverImage || DEFAULT_CITY_COVER;

  return {
    title,
    description,
    alternates: { canonical: `https://viby.club/o-que-fazer-em/${region}/${city}` },
    openGraph: {
      title: title,
      description: description,
      url: `https://viby.club/o-que-fazer-em/${region}/${city}`,
      siteName: 'Viby',
      images: [{ url: image, width: 1200, height: 630, alt: `O que fazer em ${data.cityName}` }],
      type: 'website',
      locale: 'pt_BR',
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: [image],
    },
    robots: { index: true, follow: true }
  };
}

export default async function CityDynamicPage({ params }: { params: Promise<{ region: string, city: string }> }) {
  const { region, city } = await params;
  const data = await getCityData(region, city);

  if (!data) notFound();

  const regionLabel = `${data.country} - ${data.state}`;

  return (
    <>
      <CityPageClient 
        initialEvents={data.events} 
        cityName={data.cityName}
        citySlug={city}
        regionSlug={region}
        regionLabel={regionLabel}
        coverImage={data.coverImage}
      />
    </>
  );
}
