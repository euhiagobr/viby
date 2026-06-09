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
 * @fileOverview Rota Unificada Mestre de Eventos.
 * Resolve tanto IDs quanto Slugs sob o parâmetro dinâmico [slug].
 */

async function getEventData(username: string, param: string) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    
    const usernameRef = doc(db, "usernames", username.toLowerCase());
    const usernameSnap = await getDoc(usernameRef);
    if (!usernameSnap.exists()) return null;
    
    const orgId = usernameSnap.data().uid;
    const normalizedParam = param.trim();

    // 1. Tentar por ID (Prioridade para links internos/legados)
    const eventIdRef = doc(db, "events", normalizedParam);
    const eventIdSnap = await getDoc(eventIdRef);
    
    if (eventIdSnap.exists()) {
      const data = eventIdSnap.data();
      if (data.organizationId === orgId) {
        return { id: eventIdSnap.id, ...data } as any;
      }
    }

    // 2. Tentar por Slug (SEO / URLs Amigáveis)
    const slugLower = normalizedParam.toLowerCase();
    const q = query(
      collection(db, "events"),
      where("organizationId", "==", orgId),
      where("slug", "==", slugLower),
      limit(1)
    );
    const slugSnap = await getDocs(q);
    
    if (!slugSnap.empty) {
      return { id: slugSnap.docs[0].id, ...slugSnap.docs[0].data() } as any;
    }

    return null;
  } catch (e) {
    console.error("[Event Router Error]", e);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string, slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const event = await getEventData(resolvedParams.username, resolvedParams.slug);

  if (!event) return { title: 'Evento não encontrado' };

  const city = event.address?.city || event.city || 'Brasil';
  const title = `${event.title} • ${city} | Viby`;
  const description = event.shortDescription || event.description?.substring(0, 160);
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: event.image ? [{ url: event.image }] : [],
    }
  };
}

export default async function UnifiedEventPage({ params }: { params: Promise<{ username: string, slug: string }> }) {
  const resolvedParams = await params;
  const event = await getEventData(resolvedParams.username, resolvedParams.slug);

  if (!event) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 text-center">
        <div className="relative w-full max-w-lg mb-12">
          <div className="absolute inset-0 bg-secondary/10 blur-3xl rounded-full" />
          <div className="w-24 h-24 bg-white rounded-[2rem] shadow-2xl flex items-center justify-center mx-auto mb-8">
            <CalendarX className="w-12 h-12 text-secondary" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-primary uppercase italic tracking-tighter leading-none mb-4">OPS!</h1>
          <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-primary">Evento <span className="text-secondary">Indisponível</span></h2>
          <p className="mt-6 text-muted-foreground font-medium max-w-sm mx-auto leading-relaxed">Não encontramos este evento. Verifique o endereço ou procure na página inicial.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <Button variant="outline" asChild className="flex-1 h-14 rounded-2xl font-black uppercase italic border-2 gap-2 border-primary/10">
            <Link href="/"><ArrowLeft className="w-5 h-5" /> Voltar</Link>
          </Button>
          <Button asChild className="flex-1 h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic gap-2">
            <Link href="/"><Home className="w-5 h-5" /> Início</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Redirecionamento Canônico: Se acessou por ID mas existe Slug, manda para a URL bonita
  if (event.slug && event.slug !== resolvedParams.slug) {
    redirect(`/${resolvedParams.username}/${event.slug}`);
  }

  return <EventoPublicoClient id={event.id} username={resolvedParams.username} />;
}