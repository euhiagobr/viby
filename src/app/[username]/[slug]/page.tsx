import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import EventoPublicoClient from './EventoPublicoClient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, CalendarX, ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';

const VIBY_OG_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

/**
 * Função de serialização profunda para garantir que objetos do Firestore 
 * sejam convertidos em tipos puros aceitos pelo Next.js Server Components.
 */
function serializeData(data: any): any {
  if (data === null || data === undefined) return data;

  // Lidar com Timestamps do Firestore
  if (typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }

  // Lidar com Arrays
  if (Array.isArray(data)) {
    return data.map(item => serializeData(item));
  }

  // Lidar com Objetos (POJOs)
  if (typeof data === 'object') {
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

async function getEventData(username: string, param: string) {
  try {
    const db = getAdminDb();
    const usernameSnap = await db.collection("usernames").doc(username.toLowerCase().trim()).get();
    if (!usernameSnap.exists) return null;
    
    const orgId = usernameSnap.data()!.uid;
    const normalizedParam = param.trim();

    // 1. Busca por ID
    const eventIdSnap = await db.collection("events").doc(normalizedParam).get();
    if (eventIdSnap.exists) {
      const data = eventIdSnap.data()!;
      if (data.organizationId === orgId) {
        return serializeData({ id: eventIdSnap.id, ...data });
      }
    }

    // 2. Busca por Slug
    const slugLower = normalizedParam.toLowerCase();
    const slugSnap = await db.collection("events")
      .where("organizationId", "==", orgId)
      .where("slug", "==", slugLower)
      .limit(1)
      .get();
    
    if (!slugSnap.empty) {
      const d = slugSnap.docs[0];
      return serializeData({ id: d.id, ...d.data() });
    }

    return null;
  } catch (e) {
    console.error("[Event Route Resolver] Error:", e);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string, slug: string }> }): Promise<Metadata> {
  const { username, slug } = await params;
  const event = await getEventData(username, slug);
  if (!event) return { title: 'Evento não encontrado' };

  const db = getAdminDb();
  let orgData = null;
  
  if (event.organizationId) {
    const orgSnap = await db.collection('organizations').doc(event.organizationId).get();
    orgData = orgSnap.exists ? orgSnap.data() : null;
  }

  const title = event.title;
  const rawDesc = event.description || event.shortDescription || "";
  const description = stripHtml(rawDesc).substring(0, 200);
  
  const image = event.image || orgData?.avatar || VIBY_OG_IMAGE;
  const url = `https://viby.club/${username}/${event.slug || event.id}`;

  return {
    title,
    description,
    alternates: { canonical: `/${username}/${slug}` },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Viby',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      locale: 'pt_BR',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function UnifiedEventPage({ params }: { params: Promise<{ username: string, slug: string }> }) {
  const { username, slug } = await params;
  const event = await getEventData(username, slug);

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

  if (event.slug && event.slug !== slug) {
    redirect(`/${username}/${event.slug}`);
  }

  return <EventoPublicoClient id={event.id} username={username} />;
}
