import * as React from "react"
import { Metadata } from "next"
import { getAdminDb } from "@/lib/firebase/admin"
import LGBTClient from "./LGBTClient"

export const metadata: Metadata = {
  title: "Viby celebrando a Diversidade",
  description: "Descubra eventos, roteiros e lugares que celebram a diversidade e acolhem todo mundo. Siga sua vibe na Viby.",
  alternates: { canonical: 'https://viby.com/lgbt' },
  openGraph: {
    title: "Viby celebrando a Diversidade",
    description: "Descubra eventos, roteiros e lugares que celebram a diversidade e acolhem todo mundo. Siga sua vibe na Viby.",
    url: 'https://viby.com/lgbt',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [{ 
      url: 'https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibydiversidadecapa.png?alt=media&token=238e4bbd-1bb6-4ddd-9e36-c81287f8ed54', 
      width: 1200, 
      height: 630,
      alt: "Viby celebrando a Diversidade"
    }]
  },
  twitter: {
    card: 'summary_large_image',
    title: "Viby celebrando a Diversidade",
    description: "Descubra eventos, roteiros e lugares que celebram a diversidade e acolhem todo mundo. Siga sua vibe na Viby.",
    images: ['https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibydiversidadecapa.png?alt=media&token=238e4bbd-1bb6-4ddd-9e36-c81287f8ed54']
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
    const snap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .orderBy('date', 'asc')
      .get();
      
    const events = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return serializeData(events);
  } catch (e) {
    return [];
  }
}

export default async function ExperienciasLGBTQ() {
  const initialEvents = await getInitialEvents();
  return <LGBTClient initialEvents={initialEvents} />
}
