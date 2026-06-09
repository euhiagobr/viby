import * as React from 'react';
import { Metadata } from 'next';
import { collection, query, where, getDocs, getFirestore, doc, getDoc, limit } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import EventoPublicoClient from './EventoPublicoClient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, CalendarX, ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';

/**
 * @fileOverview Busca evento por Slug ou ID de forma resiliente.
 * Suporta redirecionamento automático para a URL canônica (Slug).
 */
async function getEventBySlugOrId(username: string, slugOrId: string) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    
    // 1. Localizar Organização pelo Username para garantir o contexto correto
    const usernameRef = doc(db, "usernames", username.toLowerCase());
    const usernameSnap = await getDoc(usernameRef);
    if (!usernameSnap.exists() || usernameSnap.data().type !== 'organization') return null;
    
    const orgId = usernameSnap.data().uid;
    const normalizedParam = slugOrId.toLowerCase().trim();

    // 2. Tentar localizar o Evento pelo Slug oficial
    const q = query(
      collection(db, "events"),
      where("organizationId", "==", orgId),
      where("slug", "==", normalizedParam),
      limit(1)
    );
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
    }

    // 3. Fallback: Tentar localizar pelo ID diretamente (caso o link seja antigo)
    const eventRef = doc(db, "events", slugOrId);
    const eventSnap = await getDoc(eventRef);
    
    if (eventSnap.exists()) {
      const data = eventSnap.data();
      // Valida se o evento realmente pertence a essa organização
      if (data.organizationId === orgId) {
        return { id: eventSnap.id, ...data } as any;
      }
    }

    return null;
  } catch (e) {
    console.error("[getEventData Server Error]", e);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string, slug: string }> }): Promise<Metadata> {
  const { username, slug } = await params;
  const event = await getEventBySlugOrId(username, slug);

  if (!event) {
    return { title: 'Evento não encontrado' };
  }

  const addr = event.address || {};
  const city = addr.city || event.city || 'Brasil';
  const region = addr.stateRegion || addr.state || event.state || '';

  const title = `${event.title} • ${city} ${region} | Viby`;
  const description = event.shortDescription || event.description?.substring(0, 160) || `Confira os detalhes de ${event.title} na Viby.`;
  
  const ogImageUrl = new URL('https://viby.club/api/og');
  ogImageUrl.searchParams.set('type', 'event');
  ogImageUrl.searchParams.set('title', event.title || 'Evento');
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
      url: `https://viby.club/${username}/${event.slug || event.id}`,
      images: [{ url: ogImageUrl.toString(), width: 1200, height: 630, alt: event.title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImageUrl.toString()] }
  };
}

export default async function EventoPublicoPage({ params }: { params: Promise<{ username: string, slug: string }> }) {
  const { username, slug } = await params;
  const event = await getEventBySlugOrId(username, slug);

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

  // Redirecionamento de Canonização: Se acessou por ID ou slug antigo, redireciona para o slug oficial atual
  if (event.slug && event.slug !== slug) {
    redirect(`/${username}/${event.slug}`);
  }

  const addr = event.address || {};
  
  const parseDate = (val: any) => {
    try {
      if (!val) return new Date().toISOString();
      if (typeof val.toDate === 'function') return val.toDate().toISOString();
      if (typeof val === 'string') return val.includes('T') ? val : `${val}T19:00:00`;
      const d = new Date(val);
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } catch (e) { return new Date().toISOString(); }
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": event.title || 'Evento',
    "startDate": parseDate(event.date),
    "location": {
      "@type": "Place",
      "name": addr.venueName || event.location || 'Local',
      "address": {
        "@type": "PostalAddress",
        "addressLocality": addr.city || event.city || '',
        "addressRegion": addr.stateRegion || addr.state || event.state || '',
        "streetAddress": `${addr.addressLine1 || ''}, ${addr.streetNumber || ''}`,
        "postalCode": addr.postalCode || '',
        "addressCountry": addr.countryCode || "BR"
      }
    },
    "image": event.image,
    "description": event.description || '',
    "organizer": { "@type": "Organization", "name": event.organizer?.name || 'Viby', "url": `https://viby.club/${username}` }
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <EventoPublicoClient id={event.id} username={username} />
    </>
  );
}
