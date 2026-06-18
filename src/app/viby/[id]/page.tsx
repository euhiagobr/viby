import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import EventoPublicoClient from '../../[username]/[slug]/EventoPublicoClient';
import { notFound, redirect } from 'next/navigation';

/**
 * @fileOverview Resolução de Eventos da Organização Viby.
 * Esta rota atua como um pass-through para garantir que URLs como /viby/[slug]
 * resolvam eventos corretamente, sem conflitar com /viby/marca.
 */

const VIBY_OFFICIAL_UID = "dd9665af-ad6d-405c-a51d-08220fecf96f";

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

function stripHtml(text: string): string {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function getVibyEventData(slugParam: string) {
  const rawSlugOrId = decodeURIComponent(slugParam).trim();
  
  // Se o slug for 'marca', deixamos o Next.js resolver via /viby/marca/page.tsx
  // Embora a rota estática tenha prioridade, esta é uma camada extra de segurança.
  if (rawSlugOrId === 'marca') return { skip: true };

  try {
    const db = getAdminDb();
    let eventDoc = null;

    // 1. Tentar localizar por slug textual
    const slugLower = rawSlugOrId.toLowerCase();
    const queryBySlug = await db.collection("events")
      .where("organizationId", "==", VIBY_OFFICIAL_UID)
      .where("slug", "==", slugLower)
      .limit(1).get();
    
    if (!queryBySlug.empty) {
      eventDoc = { id: queryBySlug.docs[0].id, ...queryBySlug.docs[0].data() };
    } else {
      // 2. Fallback: Buscar por ID direto
      const eventByIdSnap = await db.collection("events").doc(rawSlugOrId).get();
      if (eventByIdSnap.exists && eventByIdSnap.data()?.organizationId === VIBY_OFFICIAL_UID) {
        eventDoc = { id: eventByIdSnap.id, ...eventByIdSnap.data() };
      }
    }

    if (!eventDoc) return null;

    return serializeData(eventDoc);
  } catch (e) {
    console.error("[getVibyEventData] Erro:", e);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const event = await getVibyEventData(id);
  
  if (!event || event.skip) return {};

  const title = `${event.title} | Viby`;
  const description = stripHtml(event.description || "").substring(0, 160);
  const image = event.image || "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";
  const url = `https://viby.club/viby/${id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Viby',
      images: [{ url: image, width: 1200, height: 630, alt: event.title }],
      type: 'website',
      locale: 'pt_BR',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: { index: true, follow: true }
  };
}

export default async function VibyEventRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Se for 'marca', o Next.js já deveria ter resolvido para /viby/marca/page.tsx
  // mas se chegou aqui, redirecionamos para garantir a integridade.
  if (id === 'marca') redirect('/viby/marca');

  const event = await getVibyEventData(id);

  if (!event) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": event.title,
    "description": stripHtml(event.description || ""),
    "image": [event.image],
    "startDate": event.date,
    "endDate": event.endDate || event.date,
    "location": {
      "@type": "Place",
      "name": event.location || event.address?.venueName,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": event.city,
        "addressRegion": event.state,
        "addressCountry": "BR"
      }
    },
    "organizer": {
      "@type": "Organization",
      "name": "Viby",
      "url": "https://viby.club/viby"
    }
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <EventoPublicoClient id={event.id} username="viby" />
    </>
  );
}
