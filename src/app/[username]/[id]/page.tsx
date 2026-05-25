
import * as React from 'react';
import { Metadata } from 'next';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import EventoPublicoClient from './EventoPublicoClient';

// Server-side data fetching for SEO
async function getEventData(id: string) {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app, "eventosviby");
  const eventRef = doc(db, 'events', id);
  const eventSnap = await getDoc(eventRef);
  
  if (!eventSnap.exists()) return null;
  return { id: eventSnap.id, ...eventSnap.data() } as any;
}

export async function generateMetadata({ params }: { params: Promise<{ username: string, id: string }> }): Promise<Metadata> {
  const { username, id } = await params;
  const event = await getEventData(id);

  if (!event) {
    return {
      title: 'Evento não encontrado',
    };
  }

  const title = `${event.title} • ${event.city || 'Viby'}`;
  const description = event.shortDescription || event.description?.substring(0, 160) || `Evento produzido por ${event.organizer?.name}. Ingressos disponíveis na Viby.`;
  
  const ogImageUrl = new URL('https://viby.club/api/og');
  ogImageUrl.searchParams.set('type', 'event');
  ogImageUrl.searchParams.set('title', event.title);
  ogImageUrl.searchParams.set('subtitle', `${event.city} • ${event.organizer?.name || 'Viby'}`);
  ogImageUrl.searchParams.set('category', event.categoryName || 'Evento');
  if (event.image) ogImageUrl.searchParams.set('image', event.image);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `https://viby.club/${username}/${id}`,
      images: [
        {
          url: ogImageUrl.toString(),
          width: 1200,
          height: 630,
          alt: event.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl.toString()],
    },
  };
}

export default async function EventoPublicoPage({ params }: { params: Promise<{ username: string, id: string }> }) {
  const { username, id } = await params;
  const event = await getEventData(id);

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl font-bold">Evento não encontrado.</p>
      </div>
    );
  }

  // Inject JSON-LD Schema.org for Rich Results
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": event.title,
    "startDate": event.date?.toDate ? event.date.toDate().toISOString() : event.date,
    "location": {
      "@type": "Place",
      "name": event.location,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": event.city,
        "addressRegion": event.address?.state,
        "streetAddress": `${event.address?.street}, ${event.address?.number}`,
        "addressCountry": "BR"
      }
    },
    "image": event.image,
    "description": event.description,
    "organizer": {
      "@type": "Organization",
      "name": event.organizer?.name,
      "url": `https://viby.club/${username}`
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EventoPublicoClient id={id} username={username} />
    </>
  );
}
