import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import EventoPublicoClient from './EventoPublicoClient';
import { notFound, redirect } from 'next/navigation';

/**
 * @fileOverview Rota Canônica Unificada: /[username]/[slug]
 * Resolve o evento verificando o vínculo com o username da organização.
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

function stripHtml(text: string): string {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function getEventData(usernameParam: string, slugParam: string) {
  try {
    const username = decodeURIComponent(usernameParam).toLowerCase().trim();
    const slugOrId = decodeURIComponent(slugParam).toLowerCase().trim();
    const db = getAdminDb();

    let eventDoc = null;

    // 1. Tentar localizar por slug textual
    const queryBySlug = await db.collection("events")
      .where("slug", "==", slugOrId)
      .limit(1).get();
    
    if (!queryBySlug.empty) {
      eventDoc = { id: queryBySlug.docs[0].id, ...queryBySlug.docs[0].data() };
    } else {
      // 2. Fallback: Buscar por ID direto do documento
      const eventByIdSnap = await db.collection("events").doc(slugOrId).get();
      if (eventByIdSnap.exists && eventByIdSnap.data()!.status !== 'Excluído') {
        eventDoc = { id: eventByIdSnap.id, ...eventByIdSnap.data() };
      }
    }

    if (!eventDoc) return null;

    // Resolver Username da Organização com Robustez
    let actualUsername = eventDoc.organizer?.username?.toLowerCase();
    
    if (!actualUsername && eventDoc.organizationId) {
      const orgSnap = await db.collection("organizations").doc(eventDoc.organizationId).get();
      if (orgSnap.exists) {
        actualUsername = orgSnap.data()?.username?.toLowerCase();
      }
    }

    // Validação de Integridade de Rota e Redirecionamento Canônico
    const canonicalSlug = eventDoc.slug || eventDoc.id;
    const isCorrectUsername = actualUsername === username;
    const isCanonicalSlug = slugOrId === canonicalSlug;

    if (!isCorrectUsername || !isCanonicalSlug) {
      // Força o redirecionamento para o padrão /[username]/[slug]
      const targetUsername = actualUsername || username;
      return { redirect: `/${targetUsername}/${canonicalSlug}` };
    }

    // Processar recorrência para SEO
    if (eventDoc.isRecurring) {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const occSnap = await db.collection('recurring_occurrences')
          .where('parentId', '==', eventDoc.id)
          .where('status', '==', 'active')
          .where('date', '>=', todayStr)
          .orderBy('date', 'asc').limit(1).get();
        
        if (!occSnap.empty) {
          const nextOcc = occSnap.docs[0].data();
          eventDoc.date = `${nextOcc.date}T${nextOcc.startTime || '00:00'}:00`;
          if (nextOcc.endTime) eventDoc.endDate = `${nextOcc.date}T${nextOcc.endTime}:00`;
        }
      } catch (occError) {}
    }

    return serializeData(eventDoc);
  } catch (e) {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string, slug: string }> }): Promise<Metadata> {
  const { username, slug } = await params;
  const event = await getEventData(username, slug);
  
  if (!event || event.redirect) return { title: 'Evento Indisponível | Viby', robots: { index: false } };

  const title = `${event.title} | Viby`;
  const description = stripHtml(event.description || "").substring(0, 160);
  const image = event.image || "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";
  const url = `https://viby.club/${username}/${slug}`;

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

export default async function CanonicalEventPage({ params }: { params: Promise<{ username: string, slug: string }> }) {
  const { username, slug } = await params;
  const event = await getEventData(username, slug);

  if (!event) notFound();
  if (event.redirect) redirect(event.redirect);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": event.title,
    "description": stripHtml(event.description || ""),
    "image": [event.image],
    "startDate": event.date,
    "endDate": event.endDate || event.date,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
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
      "name": event.organizer?.name,
      "url": `https://viby.club/${event.organizer?.username}`
    }
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <EventoPublicoClient id={event.id} username={username} />
    </>
  );
}
