import * as React from "react"
import { Metadata } from "next"
import CopaMundoClient from "./CopaMundoClient"
import { COPA_TAGS } from "@/lib/constants"
import { CopaHeader } from "@/components/layout/CopaHeader"
import Footer from '@/components/layout/Footer';
import { getAdminDb } from "@/lib/firebase/admin"
import * as admin from 'firebase-admin';

const COPA_OG_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fcopaviby.png?alt=media&token=250b69d7-8f77-41b9-a2fc-e6a74dfeb082";

export const metadata: Metadata = {
  title: "Qual a sua Viby na Copa? | Onde assistir a Copa 2026",
  description: "Juntos rumo ao Hexa! Encontre bares, festas e arenas transmitindo os jogos da Copa do Mundo 2026.",
  alternates: {
    canonical: "https://viby.club/copa-do-mundo",
  },
  openGraph: {
    title: "Qual a sua Viby na Copa? | Viby Brasil",
    description: "Saiba onde assistir aos jogos do Brasil e viva a emoção da Copa 2026.",
    url: "https://viby.club/copa-do-mundo",
    siteName: "Viby",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: COPA_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Qual a sua Viby na Copa?"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Qual a sua Viby na Copa? | Viby Brasil",
    description: "Saiba onde assistir aos jogos do Brasil e viva a emoção da Copa 2026.",
    images: [COPA_OG_IMAGE]
  }
};

function serializeData(data: any): any {
  if (data === null || data === undefined) return null;
  if (typeof data.toDate === 'function') return data.toDate().toISOString();
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(item => serializeData(item));
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

async function getCopaEvents() {
  try {
    const db = getAdminDb();
    
    const snap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .where('tags', 'array-contains-any', COPA_TAGS)
      .limit(40)
      .get();
      
    const events = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return serializeData(events);
  } catch (e) {
    console.error("[Copa Events Fetch Error]", e);
    return [];
  }
}

export default async function CopaMundoPage() {
  const initialEvents = await getCopaEvents();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Guia de Eventos Copa do Mundo 2026",
    "description": "Lista de locais transmitindo jogos da Copa do Mundo.",
    "url": "https://viby.club/copa-do-mundo"
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-[#009c3b] selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CopaHeader />
      <CopaMundoClient initialEvents={initialEvents} />
      <Footer />
    </div>
  );
}
