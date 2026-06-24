import * as React from "react"
import { Metadata } from "next"
import FestaJuninaClient from "./FestaJuninaClient"
import { JUNINA_TAGS } from "@/lib/constants"
import { ThematicHeader } from "@/components/layout/ThematicHeader"
import Footer from '@/components/layout/Footer';
import { getAdminDb } from "@/lib/firebase/admin"
import * as admin from 'firebase-admin';

export const metadata: Metadata = {
  title: "Qual a sua Viby no Arraiá? | Viby Brasil",
  description:
    "Encontre os melhores arraiás e quermesses. Viva a tradição junina perto de você com a Viby.",
  alternates: {
    canonical: "https://viby.club/festa-junina",
  },
  openGraph: {
    title: "Qual a sua Viby no Arraiá?",
    description:
      "Encontre os melhores arraiás e quermesses. Viva a tradição junina perto de você com a Viby.",
    url: "https://viby.club/festa-junina",
    siteName: "Viby",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fjunnina.jpeg?alt=media&token=be078e49-c9ff-479d-b769-3a99edce440b",
        width: 1200,
        height: 630,
        alt: "Qual a sua Viby no Arraiá?"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Qual a sua Viby no Arraiá?",
    description:
      "Encontre os melhores arraiás e quermesses. Viva a tradição junina perto de você com a Viby.",
    images: [
      "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fjunnina.jpeg?alt=media&token=be078e49-c9ff-479d-b769-3a99edce440b"
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

async function getJuninaEvents() {
  try {
    const db = getAdminDb();
    const snap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .where('tags', 'array-contains-any', JUNINA_TAGS)
      .limit(40)
      .get();
      
    const events = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return serializeData(events);
  } catch (e) {
    console.error("[Junina Events Fetch Error]", e);
    return [];
  }
}

export default async function FestaJuninaPage() {
  const initialEvents = await getJuninaEvents();

  return (
    <div className="min-h-screen bg-[#fefce8] flex flex-col selection:bg-[#ea580c] selection:text-white">
      <ThematicHeader 
        themeColor="bg-[#78350f]" 
        title="Festa Junina" 
        showBack 
      />
      <FestaJuninaClient initialEvents={initialEvents} />
      <Footer />
    </div>
  );
}
