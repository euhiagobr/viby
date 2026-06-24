import * as React from "react"
import { Metadata } from "next"
import LandingPageClient from "./LandingPageClient"
import { getAdminDb } from "@/lib/firebase/admin"
import * as admin from 'firebase-admin';

const VIBY_OG_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibycapa.jpeg?alt=media&token=352689b1-73e0-409b-ad29-e1c5e660bac0";

export const metadata: Metadata = {
  title: 'Viby | Ingressos para Shows, Festas e Eventos na sua Cidade',
  description: 'A maior vitrine de eventos do Brasil. Encontre e compre ingressos para os melhores shows, festivais, workshops e baladas perto de você com segurança.',
  keywords: ['ingressos', 'shows hoje', 'festivais brasil', 'comprar ingressos online', 'viby', 'baladas', 'eventos culturais'],
  alternates: {
    canonical: 'https://viby.club',
  },
  openGraph: {
    title: 'Viby | Ingressos para Shows, Festas e Eventos na sua Cidade',
    description: 'A maior vitrine de eventos do Brasil. Encontre e compre ingressos para os melhores shows, festivais, workshops e baladas perto de você com segurança.',
    url: 'https://viby.club',
    siteName: 'Viby',
    images: [
      {
        url: VIBY_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Viby - Viva o agora',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Viby | Ingressos para Shows e Eventos',
    description: 'A sua próxima experiência está na Viby. Explore a agenda cultural da sua cidade.',
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

    // FILTRO CENTRAL: Apenas status 'Ativo'
    const snap = await db.collection('events')
      .where('status', '==', 'Ativo')
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
