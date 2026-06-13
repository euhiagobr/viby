import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import EventoPublicoClient from './EventoPublicoClient';
import { notFound } from 'next/navigation';

const RESERVED_ROUTES = [
  'dashboard', 'admin', 'login', 'cadastro', 'redefinir-senha', 
  'checkout', 'privacidade', 'termos', 'api', 'suporte', 'explorar',
  'support', 'help', 'onboarding', 'faq', 'recorrente', 'ganhe-dinheiro',
  'marketing', 'afiliados', 'anuncios', 'imposto', 'extrato', 'transferencias',
  'financeiro', 'usuarios', 'paginas', 'denuncias', 'logs', 'emails', 
  'configuracoes', 'equipe', 'notificacoes', 'scanner', 'presenca', 'ingressos',
  'projeto', 'auth', 'para-organizadores', 'search', 'settings',
  'favicon.ico', 'robots.txt', 'sitemap.xml', 'manifest.webmanifest', 'og'
];

const VIBY_OG_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

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
    const slug = decodeURIComponent(slugParam).trim();

    console.log(`[DEBUG-SERVER] Fetching event. Username: ${username}, Slug: ${slug}`);

    if (RESERVED_ROUTES.includes(username)) {
      console.log(`[DEBUG-SERVER] Username '${username}' is a reserved route.`);
      return null;
    }

    const db = getAdminDb();

    // 1. Buscar UID pelo username
    const usernameSnap = await db.collection("usernames").doc(username).get();
    if (!usernameSnap.exists) {
      console.log(`[DEBUG-SERVER] Username document '${username}' not found in 'usernames' collection.`);
      return null;
    }
    
    const targetUid = usernameSnap.data()!.uid;
    console.log(`[DEBUG-SERVER] Found targetUid: ${targetUid} for username: ${username}`);

    let eventDoc = null;

    // 2. Tentar buscar por ID direto
    const eventByIdSnap = await db.collection("events").doc(slug).get();
    if (eventByIdSnap.exists && eventByIdSnap.data()!.status !== 'Excluído') {
      const data = eventByIdSnap.data()!;
      const ownerId = data.organizationId || data.organizerId;
      if (ownerId === targetUid) {
        console.log(`[DEBUG-SERVER] Event found by direct ID: ${slug}`);
        eventDoc = { id: eventByIdSnap.id, ...data };
      }
    }

    // 3. Tentar buscar por campo 'slug'
    if (!eventDoc) {
      console.log(`[DEBUG-SERVER] Searching for event by slug field: ${slug.toLowerCase()}`);
      const queryBySlug = await db.collection("events")
        .where("organizationId", "==", targetUid)
        .where("slug", "==", slug.toLowerCase())
        .limit(1).get();
      
      if (!queryBySlug.empty) {
        console.log(`[DEBUG-SERVER] Event found by slug field.`);
        eventDoc = { id: queryBySlug.docs[0].id, ...queryBySlug.docs[0].data() };
      } else {
        // Fallback para organizerId legado
        const queryByOrganizer = await db.collection("events")
          .where("organizerId", "==", targetUid)
          .where("slug", "==", slug.toLowerCase())
          .limit(1).get();
          
        if (!queryByOrganizer.empty) {
          console.log(`[DEBUG-SERVER] Event found by slug field (Legacy organizerId).`);
          eventDoc = { id: queryByOrganizer.docs[0].id, ...queryByOrganizer.docs[0].data() };
        }
      }
    }

    if (!eventDoc) {
      console.log(`[DEBUG-SERVER] Event NOT FOUND for slug: ${slug}`);
      return null;
    }

    // Processar recorrência se necessário
    if (eventDoc.isRecurring) {
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
    }

    return serializeData(eventDoc);
  } catch (e: any) {
    console.error(`[DEBUG-SERVER] Error in getEventData:`, e.message);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string, slug: string }> }): Promise<Metadata> {
  const { username, slug } = await params;
  
  if (RESERVED_ROUTES.includes(username.toLowerCase())) {
    return {};
  }

  const event = await getEventData(username, slug);
  if (!event) return { title: 'Evento Indisponível | Viby', robots: { index: false } };

  const title = `${event.title} | @${username} | Viby`;
  const description = stripHtml(event.description || "").substring(0, 160);
  const image = event.image || VIBY_OG_IMAGE;
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

export default async function UnifiedEventPage({ params }: { params: Promise<{ username: string, slug: string }> }) {
  const { username, slug } = await params;
  const usernameLower = username.toLowerCase();

  if (RESERVED_ROUTES.includes(usernameLower)) {
    return null;
  }

  const event = await getEventData(username, slug);

  if (!event) {
    notFound();
  }

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
      "url": `https://viby.club/${username}`
    }
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <EventoPublicoClient id={event.id} username={username} />
    </>
  );
}
