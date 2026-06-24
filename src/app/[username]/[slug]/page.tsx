import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import EventoPublicoClient from './EventoPublicoClient';
import { notFound, redirect } from 'next/navigation';

/**
 * @fileOverview Rota Canônica Unificada: /[username]/[slug]
 * Resolve o evento verificando o vínculo com o username da organização e o status.
 * FILTRO CENTRAL: Apenas status 'Ativo' é acessível publicamente.
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

async function getEventData(usernameParam: string, slugParam: string) {
  const rawUsername = decodeURIComponent(usernameParam).trim();
  const rawSlugOrId = decodeURIComponent(slugParam).trim();
  
  try {
    const db = getAdminDb();
    let eventDoc = null;

    // 1. Tentar localizar por slug textual
    const slugLower = rawSlugOrId.toLowerCase();
    const queryBySlug = await db.collection("events")
      .where("slug", "==", slugLower)
      .where("status", "==", "Ativo")
      .limit(1).get();
    
    if (!queryBySlug.empty) {
      eventDoc = { id: queryBySlug.docs[0].id, ...queryBySlug.docs[0].data() };
    } else {
      // 2. Fallback: Buscar por ID direto
      const eventByIdSnap = await db.collection("events").doc(rawSlugOrId).get();
      if (eventByIdSnap.exists && eventByIdSnap.data()?.status === "Ativo") {
        eventDoc = { id: eventByIdSnap.id, ...eventByIdSnap.data() };
      }
    }

    if (!eventDoc) {
      return null;
    }

    // RESOLUÇÃO ROBUSTA DO USERNAME DO PROPRIETÁRIO
    let actualUsername = eventDoc.organizer?.username?.toLowerCase();
    const orgId = eventDoc.organizationId || eventDoc.organizerId;
    
    if (!actualUsername) {
      if (orgId === VIBY_OFFICIAL_UID) {
        actualUsername = "viby";
      } else if (orgId) {
        const orgSnap = await db.collection("organizations").doc(orgId).get();
        if (orgSnap.exists) {
          actualUsername = orgSnap.data()?.username?.toLowerCase() || orgSnap.id;
        }
      }
    }

    const canonicalSlug = eventDoc.slug || eventDoc.id;
    const urlUsernameLower = rawUsername.toLowerCase();
    
    const isCorrectUsername = actualUsername === urlUsernameLower || orgId === rawUsername;
    const isCanonicalSlug = rawSlugOrId === canonicalSlug;

    if (!isCorrectUsername || !isCanonicalSlug) {
      const targetUsername = actualUsername || (orgId === rawUsername ? rawUsername : 'evento');
      const redirectUrl = `/${targetUsername}/${canonicalSlug}`;
      
      if (decodeURIComponent(redirectUrl) !== `/${rawUsername}/${rawSlugOrId}`) {
        return { redirect: redirectUrl };
      }
    }

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
      } catch (occError) {
        console.error(`[SEO-Recurrence] Error:`, occError);
      }
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
      "url": `https://viby.club/${event.organizer?.username || 'evento'}`
    }
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <EventoPublicoClient id={event.id} username={username} />
    </>
  );
}
