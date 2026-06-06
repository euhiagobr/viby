
import * as React from 'react';
import { Metadata } from 'next';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import EventoPublicoClient from './EventoPublicoClient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, CalendarX, ArrowLeft } from 'lucide-react';

async function getEventData(id: string) {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app);
  const eventRef = doc(db, 'events', id);
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) return null;
  return { id: eventSnap.id, ...eventSnap.data() } as any;
}

export async function generateMetadata({ params }: { params: Promise<{ username: string, id: string }> }): Promise<Metadata> {
  const { username, id } = await params;
  const event = await getEventData(id);

  if (!event) {
    return { title: 'Evento não encontrado' };
  }

  const addr = event.address || {};
  const city = addr.city || event.city || 'Brasil';
  const region = addr.state || event.state || '';
  const country = addr.country || 'Brasil';

  const title = `${event.title} • ${city} ${region} | Viby`;
  const description = event.shortDescription || event.description?.substring(0, 160) || `Confira os detalhes de ${event.title} na Viby.`;
  
  const ogImageUrl = new URL('https://viby.club/api/og');
  ogImageUrl.searchParams.set('type', 'event');
  ogImageUrl.searchParams.set('title', event.title);
  ogImageUrl.searchParams.set('subtitle', `${city} • ${event.organizer?.name || 'Viby'}`);
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
      images: [{ url: ogImageUrl.toString(), width: 1200, height: 630, alt: event.title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImageUrl.toString()] },
    keywords: [event.title, city, region, country, event.categoryName || 'evento']
  };
}

export default async function EventoPublicoPage({ params }: { params: Promise<{ username: string, id: string }> }) {
  const { username, id } = await params;
  const event = await getEventData(id);

  if (!event) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 text-center">
        <div className="relative w-full max-w-lg mb-12">
          <div className="absolute inset-0 bg-secondary/10 blur-3xl rounded-full" />
          <div className="w-24 h-24 bg-white rounded-[2rem] shadow-2xl flex items-center justify-center mx-auto mb-8"><CalendarX className="w-12 h-12 text-secondary" /></div>
          <h1 className="text-5xl md:text-7xl font-black text-primary uppercase italic tracking-tighter leading-none mb-4">OPS!</h1>
          <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-primary">Evento <span className="text-secondary">Indisponível</span></h2>
          <p className="mt-6 text-muted-foreground font-medium max-w-sm mx-auto leading-relaxed">O evento que você procura pode ter sido removido ou o link está incorreto.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <Button variant="outline" asChild className="flex-1 h-14 rounded-2xl font-black uppercase italic border-2 gap-2 border-primary/10 hover:bg-muted"><Link href="/"><ArrowLeft className="w-5 h-5" /> Voltar</Link></Button>
          <Button asChild className="flex-1 h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic gap-2 hover:bg-secondary transition-all"><Link href="/"><Home className="w-5 h-5" /> Ir ao Início</Link></Button>
        </div>
      </div>
    );
  }

  const addr = event.address || {};
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": event.title,
    "startDate": event.date?.toDate ? event.date.toDate().toISOString() : event.date,
    "location": {
      "@type": "Place",
      "name": addr.venueName || event.location,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": addr.city || event.city,
        "addressRegion": addr.state || event.state,
        "streetAddress": `${addr.street || ''}, ${addr.number || ''}`,
        "postalCode": addr.postalCode || event.cep,
        "addressCountry": addr.countryCode || "BR"
      }
    },
    "image": event.image,
    "description": event.description,
    "organizer": { "@type": "Organization", "name": event.organizer?.name, "url": `https://viby.club/${username}` }
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <EventoPublicoClient id={id} username={username} />
    </>
  );
}
