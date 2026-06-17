
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
  console.log(`[CITY_AUDIT] Route Input - Region: ${regionParam}, City: ${citySlug}`);
  
  if (!regionData) {
    console.error(`[CITY_AUDIT] Failed to parse region param: ${regionParam}`);
    return null;
  }

  try {
    const db = getAdminDb();
    const now = new Date();

    // Diagnóstico 1: Verificar se existem eventos para esta cidade ignorando slugs
    const diagnosticSnap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .limit(100)
      .get();
    
    const allActive = diagnosticSnap.docs.map(d => d.data());
    console.log(`[CITY_AUDIT] Total Active Events in DB: ${allActive.length}`);
    
    // Procura manual nos dados carregados para validar hipótese de campos ausentes
    const matchesManual = allActive.filter(e => 
      (e.city && e.city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-") === citySlug)
    );
    console.log(`[CITY_AUDIT] Manual matches for ${citySlug} (ignoring slugs index): ${matchesManual.length}`);
    if (matchesManual.length > 0) {
      console.log(`[CITY_AUDIT] Sample Match Fields:`, {
        title: matchesManual[0].title,
        hasRegionSlug: !!matchesManual[0].regionSlug,
        hasCitySlug: !!matchesManual[0].citySlug,
        regionSlugValue: matchesManual[0].regionSlug,
        citySlugValue: matchesManual[0].citySlug
      });
    }

    // Consulta Oficial
    const snap = await db.collection('events')
      .where('regionSlug', '==', regionParam.toLowerCase())
      .where('citySlug', '==', citySlug.toLowerCase())
      .where('status', '==', 'Ativo')
      .get();

    console.log(`[CITY_AUDIT] Official Query Result count: ${snap.size}`);

    if (snap.empty) {
      console.warn(`[CITY_AUDIT] No events found for slugs: ${regionParam}/${citySlug}. Triggering fallback search...`);
      
      const fallbackSnap = await db.collection('events')
        .where('regionSlug', '==', regionParam.toLowerCase())
        .where('citySlug', '==', citySlug.toLowerCase())
        .limit(1)
        .get();
      
      if (fallbackSnap.empty) {
        console.error(`[CITY_AUDIT] Fallback search also empty. Causa: Slugs não existem no documento.`);
        return null;
      }
      
      const example = fallbackSnap.docs[0].data();
      return {
        events: [],
        cityName: example.city,
        state: example.state,
        country: example.country || "Brasil"
      };
    }

    const events = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Filtro manual de data para evitar conflito de tipos no Firestore
    const futureEvents = events.filter(e => {
      const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      return d >= now;
    }).sort((a: any, b: any) => {
      const dA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const dB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return dA.getTime() - dB.getTime();
    });

    console.log(`[CITY_AUDIT] Future events after manual filter: ${futureEvents.length}`);

    const example = events[0];
    return serializeData({
      events: futureEvents,
      cityName: example.city,
      state: example.state,
      country: example.country || "Brasil"
    });
  } catch (e: any) {
    console.error(`[CITY_AUDIT] Critical error in getCityData: ${e.message}`);
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

  if (!data) {
    console.error(`[CITY_AUDIT] Rendering 404 for ${region}/${city}`);
    notFound();
  }

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
