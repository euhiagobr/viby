import * as React from 'react';
import { Metadata } from 'next';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import EventoPublicoClient from './EventoPublicoClient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MapPinOff, ArrowLeft, Home, CalendarX } from 'lucide-react';

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
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 text-center selection:bg-secondary selection:text-white">
        <div className="relative w-full max-w-lg mb-12">
          <div className="absolute inset-0 bg-secondary/10 blur-3xl rounded-full" />
          <div className="relative">
            <div className="w-24 h-24 bg-white rounded-[2rem] shadow-2xl flex items-center justify-center mx-auto mb-8">
              <CalendarX className="w-12 h-12 text-secondary" />
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black text-primary uppercase italic tracking-tighter leading-none mb-4">
              OPS!
            </h1>
            <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-primary">
              Evento <span className="text-secondary">Indisponível</span>
            </h2>
            <p className="mt-6 text-muted-foreground font-medium max-w-sm mx-auto leading-relaxed">
              O evento que você procura pode ter sido removido, encerrado ou o link está incorreto.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <Button 
            variant="outline" 
            asChild
            className="flex-1 h-14 rounded-2xl font-black uppercase italic border-2 gap-2 border-primary/10 hover:bg-muted"
          >
            <Link href="/">
               <ArrowLeft className="w-5 h-5" /> Voltar
            </Link>
          </Button>
          <Button 
            asChild 
            className="flex-1 h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic gap-2 hover:bg-secondary transition-all"
          >
            <Link href="/dashboard">
              <Home className="w-5 h-5" /> Ver Outros
            </Link>
          </Button>
        </div>

        <div className="mt-20 opacity-20">
           <span className="text-[10px] font-black uppercase tracking-[0.5em]">VIBY CLUB</span>
        </div>
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
