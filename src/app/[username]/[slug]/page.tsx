import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import EventoPublicoClient from './EventoPublicoClient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, CalendarX, ArrowLeft } from 'lucide-react';
import { redirect, notFound } from 'next/navigation';

const RESERVED_ROUTES = [
  'dashboard', 'admin', 'login', 'cadastro', 'redefinir-senha', 
  'checkout', 'privacidade', 'termos', 'api', 'suporte', 
  'support', 'help', 'onboarding', 'faq', 'recorrente', 'ganhe-dinheiro',
  'marketing', 'afiliados', 'anuncios', 'imposto', 'extrato', 'transferencias',
  'financeiro', 'usuarios', 'paginas', 'denuncias', 'logs', 'emails', 
  'configuracoes', 'equipe', 'notificacoes', 'scanner', 'presenca', 'ingressos',
  'novo', 'new', 'projeto', 'auth'
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
    if (RESERVED_ROUTES.includes(username)) return null;

    const db = getAdminDb();
    const slug = decodeURIComponent(slugParam).trim();

    const usernameSnap = await db.collection("usernames").doc(username).get();
    if (!usernameSnap.exists) return null;
    const targetUid = usernameSnap.data()!.uid;

    let eventDoc = null;
    const eventByIdSnap = await db.collection("events").doc(slug).get();
    if (eventByIdSnap.exists && eventByIdSnap.data()!.status !== 'Excluído') {
      const ownerId = eventByIdSnap.data()!.organizationId || eventByIdSnap.data()!.organizerId;
      if (ownerId === targetUid) eventDoc = { id: eventByIdSnap.id, ...eventByIdSnap.data() };
    }

    if (!eventDoc) {
      const queryBySlug = await db.collection("events")
        .where("organizationId", "==", targetUid)
        .where("slug", "==", slug.toLowerCase())
        .limit(1).get();
      if (!queryBySlug.empty) eventDoc = { id: queryBySlug.docs[0].id, ...queryBySlug.docs[0].data() };
    }

    if (!eventDoc) return null;

    // Lógica para Recorrência no Servidor (SEO)
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
  } catch (e) {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string, slug: string }> }): Promise<Metadata> {
  const { username, slug } = await params;
  const event = await getEventData(username, slug);
  if (!event) return { title: 'Evento Indisponível | Viby' };

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
      type: 'video.other',
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
  const event = await getEventData(username, slug);

  if (!event) {
    if (RESERVED_ROUTES.includes(username.toLowerCase())) return null;
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 text-center">
        <div className="relative w-full max-w-lg mb-12">
          <div className="absolute inset-0 bg-secondary/10 blur-3xl rounded-full" />
          <div className="w-24 h-24 bg-white rounded-[2rem] shadow-2xl flex items-center justify-center mx-auto mb-8"><CalendarX className="w-12 h-12 text-secondary" /></div>
          <h1 className="text-5xl md:text-7xl font-black text-primary uppercase italic tracking-tighter mb-4">OPS!</h1>
          <h2 className="text-2xl md:text-3xl font-black uppercase italic text-primary">Evento <span className="text-secondary">Indisponível</span></h2>
          <p className="mt-6 text-muted-foreground font-medium max-w-sm mx-auto">Este evento não está mais disponível ou foi removido pelo organizador.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <Button variant="outline" asChild className="flex-1 h-14 rounded-2xl font-black uppercase italic border-2 gap-2"><Link href="/"><ArrowLeft className="w-5 h-5" /> Voltar</Link></Button>
          <Button asChild className="flex-1 h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic gap-2 hover:bg-secondary"><Link href="/"><Home className="w-5 h-5" /> Início</Link></Button>
        </div>
      </div>
    );
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
