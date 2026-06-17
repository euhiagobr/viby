import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import CityPageClient from './CityPageClient';
import { notFound } from 'next/navigation';
import { parseRegionParam } from '@/lib/city-utils';

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
  const regionData = parseRegionParam(regionParam);
  if (!regionData) return null;

  try {
    const db = getAdminDb();
    const now = new Date();

    const snap = await db.collection('events')
      .where('regionSlug', '==', regionParam.toLowerCase())
      .where('citySlug', '==', citySlug.toLowerCase())
      .where('status', '==', 'Ativo')
      .where('date', '>=', now)
      .orderBy('date', 'asc')
      .limit(12)
      .get();

    if (snap.empty) {
      const fallbackSnap = await db.collection('events')
        .where('regionSlug', '==', regionParam.toLowerCase())
        .where('citySlug', '==', citySlug.toLowerCase())
        .limit(1)
        .get();
      
      if (fallbackSnap.empty) return null;
      
      const example = fallbackSnap.docs[0].data();
      return {
        events: [],
        cityName: example.city,
        state: example.state,
        country: example.country || "Brasil"
      };
    }

    const events = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const example = events[0];

    return serializeData({
      events,
      cityName: example.city,
      state: example.state,
      country: example.country || "Brasil"
    });
  } catch (e) {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ region: string, city: string }> }): Promise<Metadata> {
  const { region, city } = await params;
  const data = await getCityData(region, city);
  
  if (!data) return { title: 'Eventos não encontrados | Viby', robots: { index: false } };

  const title = `O que fazer em ${data.cityName} - Eventos, Shows, Festas e Programação | Viby`;
  const description = `Confira os próximos eventos em ${data.cityName}. Shows, festas, feiras, experiências, cultura, gastronomia e muito mais na Viby.`;
  const url = `https://viby.club/o-que-fazer-em/${region}/${city}`;
  const image = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Viby',
      images: [{ url: image, width: 1200, height: 630 }],
      type: 'website',
      locale: 'pt_BR',
    },
    robots: { index: true, follow: true }
  };
}

export default async function CityDynamicPage({ params }: { params: Promise<{ region: string, city: string }> }) {
  const { region, city } = await params;
  const data = await getCityData(region, city);

  if (!data) notFound();

  const regionLabel = `${data.country} - ${data.state}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `O que fazer em ${data.cityName}`,
    "description": `Próximos eventos em ${data.cityName}, ${data.state}.`,
    "url": `https://viby.club/o-que-fazer-em/${region}/${city}`,
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": data.events.map((ev: any, idx: number) => ({
        "@type": "ListItem",
        "position": idx + 1,
        "item": {
          "@type": "Event",
          "name": ev.title,
          "description": ev.description?.substring(0, 150),
          "startDate": ev.date,
          "location": {
            "@type": "Place",
            "name": ev.location,
            "address": {
              "@type": "PostalAddress",
              "addressLocality": data.cityName,
              "addressRegion": data.state,
              "addressCountry": "BR"
            }
          }
        }
      }))
    }
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CityPageClient 
        initialEvents={data.events} 
        cityName={data.cityName}
        citySlug={city}
        regionSlug={region}
        regionLabel={regionLabel}
      />
    </>
  );
}
