import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import EventoPublicoClient from './EventoPublicoClient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, CalendarX, ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';

const RESERVED_ROUTES = [
  'dashboard', 'admin', 'login', 'cadastro', 'redefinir-senha', 
  'checkout', 'privacidade', 'termos', 'api', 'suporte', 
  'support', 'help', 'onboarding', 'faq', 'recorrente', 'ganhe-dinheiro',
  'marketing', 'afiliados', 'anuncios', 'imposto', 'extrato', 'transferencias',
  'financeiro', 'usuarios', 'paginas', 'denuncias', 'logs', 'emails', 
  'configuracoes', 'equipe', 'notificacoes', 'scanner', 'presenca', 'ingressos',
  'novo', 'new', 'projeto'
];

const VIBY_OG_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

function serializeData(data: any): any {
  if (data === null || data === undefined) return null;

  if (typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }
  
  if (data instanceof Date) {
    return data.toISOString();
  }

  if (Array.isArray(data)) {
    return data.map(item => serializeData(item));
  }

  if (typeof data === 'object') {
    const proto = Object.getPrototypeOf(data);
    if (proto !== null && proto !== Object.prototype) {
      return String(data);
    }
    
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
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getEventData(usernameParam: string, slugParam: string) {
  try {
    const db = getAdminDb();
    const username = decodeURIComponent(usernameParam).toLowerCase().trim();
    const slug = decodeURIComponent(slugParam).trim();

    const usernameSnap = await db.collection("usernames").doc(username).get();
    if (!usernameSnap.exists) return null;
    const targetUid = usernameSnap.data()!.uid;

    const eventByIdSnap = await db.collection("events").doc(slug).get();
    if (eventByIdSnap.exists) {
      const data = eventByIdSnap.data()!;
      // Impede visualização de eventos marcados como excluídos
      if (data.status === 'Excluído') return null;
      
      const ownerId = data.organizationId || data.organizerId || data.organizer?.id;
      if (ownerId === targetUid) {
        return serializeData({ id: eventByIdSnap.id, ...data });
      }
    }

    const queryBySlug = await db.collection("events")
      .where("slug", "==", slug.toLowerCase())
      .limit(10)
      .get();
    
    if (!queryBySlug.empty) {
      const found = queryBySlug.docs.find(doc => {
        const data = doc.data();
        // Impede visualização de eventos marcados como excluídos na busca por slug
        if (data.status === 'Excluído') return false;
        
        const ownerId = data.organizationId || data.organizerId || data.organizer?.id;
        return ownerId === targetUid;
      });
      if (found) {
        return serializeData({ id: found.id, ...found.data() });
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string, slug: string }> }): Promise<Metadata> {
  try {
    const { username, slug } = await params;
    if (RESERVED_ROUTES.includes(username.toLowerCase())) return { title: 'Viby' };
    
    const event = await getEventData(username, slug);
    if (!event) return { title: 'Evento não encontrado | Viby' };

    const db = getAdminDb();
    let orgData = null;
    
    const orgId = event.organizationId || event.organizerId || event.organizer?.id;
    if (orgId) {
      const orgSnap = await db.collection('organizations').doc(orgId).get();
      orgData = orgSnap.exists ? orgSnap.data() : null;
      if (!orgData) {
        const userSnap = await db.collection('users').doc(orgId).get();
        orgData = userSnap.exists ? userSnap.data() : null;
      }
    }

    const title = event.title || "Evento";
    const description = stripHtml(event.description || event.shortDescription || "").substring(0, 200);
    const image = event.image || orgData?.avatar || VIBY_OG_IMAGE;

    return {
      title,
      description,
      keywords: ['evento', 'ingressos', 'viby', title, event.city, username],
      alternates: { canonical: `/${username}/${slug}` },
      openGraph: {
        title,
        description,
        url: `https://viby.club/${username}/${slug}`,
        siteName: 'Viby',
        images: [{ url: image, width: 1200, height: 630, alt: title }],
        type: 'video.other',
        locale: 'pt_BR',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
      robots: {
        index: true,
        follow: true,
      }
    };
  } catch (e) {
    return { title: 'Viby | Experiências' };
  }
}

export default async function UnifiedEventPage({ params }: { params: Promise<{ username: string, slug: string }> }): Promise<React.ReactElement> {
  const { username, slug } = await params;
  
  if (RESERVED_ROUTES.includes(username.toLowerCase())) {
    return <></>;
  }
  
  const event = await getEventData(username, slug);

  if (!event) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 text-center">
        <div className="relative w-full max-w-lg mb-12">
          <div className="absolute inset-0 bg-secondary/10 blur-3xl rounded-full" />
          <div className="w-24 h-24 bg-white rounded-[2rem] shadow-2xl flex items-center justify-center mx-auto mb-8">
            <CalendarX className="w-12 h-12 text-secondary" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-primary uppercase italic tracking-tighter mb-4">OPS!</h1>
          <h2 className="text-2xl md:text-3xl font-black uppercase italic text-primary">Evento <span className="text-secondary">Indisponível</span></h2>
          <p className="mt-6 text-muted-foreground font-medium max-w-sm mx-auto">Este evento não está mais disponível ou foi removido pelo organizador.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <Button variant="outline" asChild className="flex-1 h-14 rounded-2xl font-black uppercase italic border-2 gap-2 border-primary/10">
            <Link href="/"><ArrowLeft className="w-5 h-5" /> Voltar</Link>
          </Button>
          <Button asChild className="flex-1 h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic gap-2 hover:bg-secondary transition-all">
            <Link href="/"><Home className="w-5 h-5" /> Início</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (event.slug && event.slug !== slug && event.id === slug) {
    redirect(`/${username}/${event.slug}`);
  }

  return <EventoPublicoClient id={event.id} username={username} />;
}
