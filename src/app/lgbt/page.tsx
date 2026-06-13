import * as React from "react"
import { Metadata } from "next"
import { getAdminDb } from "@/lib/firebase/admin"
import LGBTClient from "./LGBTClient"

export const metadata: Metadata = {
  title: 'Experiências LGBTQIAPN+ | Viby',
  description: 'Descubra eventos, celebrações e espaços de diversidade LGBTQIAPN+ no Brasil. Junte-se à comunidade na maior vitrine cultural do país.',
  alternates: { canonical: '/lgbt' },
  openGraph: {
    title: 'Experiências LGBTQIAPN+ | Viby',
    description: 'Eventos, celebrações e espaços de diversidade para viver o agora.',
    url: 'https://viby.club/lgbt',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: 'https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fcopaviby.png?alt=media', width: 1200, height: 630 }]
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
