
import * as React from "react"
import { Metadata } from "next"
import CopaMundoClient from "./CopaMundoClient"
import { COPA_TAGS } from "@/lib/constants"
import { CopaHeader } from "@/components/layout/CopaHeader"
import Footer from '@/components/layout/Footer';
import { getAdminDb } from "@/lib/firebase/admin"
import * as admin from 'firebase-admin';

export const metadata: Metadata = {
  title: "Qual a sua Viby na Copa? | Viby Brasil",
  description:
    "Juntos rumo ao Hexa! Descubra locais e experiências para viver a Copa do Mundo 2026.",
  alternates: {
    canonical: "https://viby.club/copa-do-mundo",
  },
  openGraph: {
    title: "Qual a sua Viby na Copa?",
    description:
      "Juntos rumo ao Hexa! Descubra locais e experiências para viver a Copa do Mundo 2026.",
    url: "https://viby.club/copa-do-mundo",
    siteName: "Viby",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fcopaviby.png?alt=media&token=250b69d7-8f77-41b9-a2fc-e6a74dfeb082",
        width: 1200,
        height: 630,
        alt: "Qual a sua Viby na Copa?"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Qual a sua Viby na Copa?",
    description:
      "Juntos rumo ao Hexa! Descubra locais e experiências para viver a Copa do Mundo 2026.",
    images: [
      "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fcopaviby.png?alt=media&token=250b69d7-8f77-41b9-a2fc-e6a74dfeb082"
    ]
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
    
    // Na Copa, queremos ver tudo o que está tagueado, mesmo que tenha sido criado há mais tempo
    // Removemos o threshold rígido de data para garantir que o "pai" de recorrências seja encontrado
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

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-[#009c3b] selection:text-white">
      <CopaHeader />
      <CopaMundoClient initialEvents={initialEvents} />
      <Footer />
    </div>
  );
}
