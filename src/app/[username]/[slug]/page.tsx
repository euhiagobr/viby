
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
 * Função de serialização robusta para Next.js 15 RSC.
 * Converte recursivamente Timestamps e Dates em strings ISO.
 */
function serializeData(data: any): any {
  if (data === null || data === undefined) return null;

  // Handle Firestore Timestamps
  if (data && typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }
  
  // Handle native Dates
  if (data instanceof Date) {
    return data.toISOString();
  }

  // Handle Arrays
  if (Array.isArray(data)) {
    return data.map(item => serializeData(item));
  }

  // Handle Objects (Plain)
  if (typeof data === 'object') {
    // Only process plain objects to avoid errors with complex class instances
    if (Object.prototype.toString.call(data) !== '[object Object]') {
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

async function getEventData(username: string, param: string) {
  try {
    const db = getAdminDb();
    const normalizedUsername = username.toLowerCase().trim();
    const normalizedParam = param.trim();

    // 1. Resolve Target UID from the username index
    const usernameSnap = await db.collection("usernames").doc(normalizedUsername).get();
    if (!usernameSnap.exists) {
      console.warn(`[Event Resolver] Username not found in index: ${normalizedUsername}`);
      return null;
    }
    
    const targetUid = usernameSnap.data()!.uid;

    // 2. Try fetching by ID directly (slug in URL might actually be an ID)
    const eventByIdSnap = await db.collection("events").doc(normalizedParam).get();
    if (eventByIdSnap.exists) {
      const data = eventByIdSnap.data()!;
      // Verify ownership across all common fields for maximum resilience
      const isOwner = data.organizationId === targetUid || 
                      data.organizerId === targetUid || 
                      (data.organizer && (data.organizer.id === targetUid || data.organizer.uid === targetUid));
      
      if (isOwner) {
        return serializeData({ id: eventByIdSnap.id, ...data });
      }
    }

    // 3. Try fetching by Slug field query
    const slugLower = normalizedParam.toLowerCase();
    const queryBySlug = await db.collection("events")
      .where("slug", "==", slugLower)
      .limit(5)
      .get();
    
    if (!queryBySlug.empty) {
      // Find the document that belongs to the resolved targetUid
      const found = queryBySlug.docs.find(doc => {
        const d = doc.data();
        return d.organizationId === targetUid || 
               d.organizerId === targetUid || 
               (d.organizer && (d.organizer.id === targetUid || d.organizer.uid === targetUid));
      });
      
      if (found) {
        return serializeData({ id: found.id, ...found.data() });
      }
    }

    // 4. Global Fallback: If found by ID but owner mismatched, 
    // check if the event's actual owner has the username from the URL.
    if (eventByIdSnap.exists) {
       const data = eventByIdSnap.data()!;
       const eventOrgId = data.organizationId || data.organizerId || data.organizer?.id || data.organizer?.uid;
       if (eventOrgId) {
          const orgUsernameSnap = await db.collection("usernames").where("uid", "==", eventOrgId).limit(1).get();
          if (!orgUsernameSnap.empty && orgUsernameSnap.docs[0].id === normalizedUsername) {
            return serializeData({ id: eventByIdSnap.id, ...data });
          }
       }
    }

    return null;
  } catch (e) {
    console.error("[Event Route Resolver] Critical Error:", e);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string, slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const username = resolvedParams.username;
  const slug = resolvedParams.slug;
  
  const event = await getEventData(username, slug);
  if (!event) return { title: 'Evento não encontrado | Viby' };

  const db = getAdminDb();
  let orgData = null;
  
  try {
    const orgId = event.organizationId || event.organizerId || event.organizer?.id;
    if (orgId) {
      const orgSnap = await db.collection('organizations').doc(orgId).get();
      if (!orgSnap.exists) {
         const userSnap = await db.collection('users').doc(orgId).get();
         orgData = userSnap.exists ? userSnap.data() : null;
      } else {
         orgData = orgSnap.data();
      }
    }
  } catch (e) {}

  const title = event.title || "Evento";
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
  const resolvedParams = await params;
  const username = resolvedParams.username;
  const slug = resolvedParams.slug;

  const event = await getEventData(username, slug);

  if (!event) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 text-center selection:bg-secondary selection:text-white">
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
          <Button variant="outline" asChild className="flex-1 h-14 rounded-2xl font-black uppercase italic border-2 gap-2 border-primary/10 hover:bg-muted">
            <Link href="/"><ArrowLeft className="w-5 h-5" /> Voltar</Link>
          </Button>
          <Button asChild className="flex-1 h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic gap-2 hover:bg-secondary transition-all">
            <Link href="/"><Home className="w-5 h-5" /> Início</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Redirecionamento canônico se o acesso for via ID mas o evento possuir um slug amigável
  if (event.slug && event.slug !== slug && event.id === slug) {
    redirect(`/${username}/${event.slug}`);
  }

  return <EventoPublicoClient id={event.id} username={username} />;
}
