
import * as React from "react"
import { Metadata } from "next"
import LandingPageClient from "./LandingPageClient"
import { getAdminDb } from "@/lib/firebase/admin"
import * as admin from 'firebase-admin';

const VIBY_OG_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

export const metadata: Metadata = {
  title: 'Viby | Descubra e Viva Experiências Incríveis',
  description: 'A maior vitrine de eventos do Brasil. Encontre shows, festivais, workshops e muito mais na sua cidade.',
  keywords: ['eventos', 'ingressos', 'shows', 'experiências', 'viby', 'baladas', 'festivais'],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Viby | Descubra e Viva Experiências Incríveis',
    description: 'A maior vitrine de eventos do Brasil. Encontre shows, festivais, workshops e muito mais na sua cidade.',
    url: 'https://viby.club',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [
      {
        url: VIBY_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Viby',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Viby | Descubra e Viva Experiências Incríveis',
    description: 'A maior vitrine de eventos do Brasil. Encontre shows, festivais, workshops e muito mais na sua cidade.',
    images: [VIBY_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  }
}

function serializeData(data: any): any {
  if (data === null || data === undefined) return null;
  if (typeof data.toDate === 'function') return data.toDate().toISOString();
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(item => serializeData(item));
  if (typeof data === 'object') {
    const serialized: any = {};
    Object.keys(data).forEach(key => {
      serialized[key] = serializeData(data[key]);
    });
    return serialized;
  }
  return data;
}

async function getInitialEvents() {
  try {
    const db = getAdminDb();
    
    // Janela de 30 dias para capturar pais de recorrências ativas
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 30);
    const dateThreshold = admin.firestore.Timestamp.fromDate(thresholdDate);

    const snap = await db.collection('events')
      .where('status', 'in', ['Ativo', 'published'])
      .where('date', '>=', dateThreshold)
      .orderBy('date', 'asc')
      .limit(60) 
      .get();
      
    if (snap.empty) return [];
    
    const events = snap.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
    
    return serializeData(events);
  } catch (e) {
    console.error("[SSR Events Fetch Error]", e);
    return [];
  }
}

export default async function LandingPage() {
  const initialEvents = await getInitialEvents();
  return <LandingPageClient initialEvents={initialEvents} />
}
