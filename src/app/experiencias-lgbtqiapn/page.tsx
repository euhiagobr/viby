
import * as React from "react"
import { Metadata } from "next"
import { getAdminDb } from "@/lib/firebase/admin"
import LGBTClient from "./LGBTClient"
import * as admin from 'firebase-admin'

const VIBY_LGBT_OG = 'https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibydiversidadecapa.png?alt=media&token=238e4bbd-1bb6-4ddd-9e36-c81287f8ed54';

export const metadata: Metadata = {
  title: "Viby celebrando a Diversidade | Eventos LGBTQIAPN+",
  description: "Descubra eventos, roteiros e lugares que celebram a diversidade e acolhem todo mundo. Siga sua vibe na Viby.",
  alternates: { canonical: 'https://viby.club/experiencias-lgbtqiapn' },
  openGraph: {
    title: "Viby celebrando a Diversidade",
    description: "Os melhores rolês LGBTQIAPN+ em um só lugar. Encontre sua comunidade.",
    url: 'https://viby.club/experiencias-lgbtqiapn',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [{ 
      url: VIBY_LGBT_OG, 
      width: 1200, 
      height: 630,
      alt: "Viby celebrando a Diversidade"
    }]
  },
  twitter: {
    card: 'summary_large_image',
    title: "Viby celebrando a Diversidade",
    description: "Explore a agenda cultural LGBTQIAPN+ na Viby.",
    images: [VIBY_LGBT_OG]
  }
}

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

async function getInitialEvents() {
  try {
    const db = getAdminDb();
    
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 30);
    const dateThreshold = admin.firestore.Timestamp.fromDate(thresholdDate);

    const snap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .where('date', '>=', dateThreshold)
      .orderBy('date', 'asc')
      .get();
      
    const events = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return serializeData(events);
  } catch (e) {
    console.error("[LGBT Events Fetch Error]", e);
    return [];
  }
}

export default async function ExperienciasLGBTQ() {
  const initialEvents = await getInitialEvents();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Experiências LGBTQIAPN+ na Viby",
    "description": "Agenda cultural e eventos focados na diversidade.",
    "url": "https://viby.club/experiencias-lgbtqiapn",
    "about": {
      "@type": "Thing",
      "name": "LGBTQIAPN+ Culture"
    }
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LGBTClient initialEvents={initialEvents} />
    </>
  );
}
