import * as React from "react"
import { Metadata } from "next"
import FestaJuninaClient from "./FestaJuninaClient"
import { JUNINA_TAGS } from "@/lib/constants"
import { ThematicHeader } from "@/components/layout/ThematicHeader"
import Footer from '@/components/layout/Footer';
import { getAdminDb } from "@/lib/firebase/admin"

export const metadata: Metadata = {
  title: "Festa Junina 2026 | Encontre Arraiás e Eventos na Viby",
  description:
    "Descubra festas juninas, arraiás, quermesses e eventos temáticos em todo o Brasil. Encontre sua próxima Festa Junina na Viby.",
  alternates: {
    canonical: "https://viby.club/festa-junina",
  },
  openGraph: {
    title: "Festa Junina 2026 | Encontre Arraiás e Eventos na Viby",
    description:
      "Descubra festas juninas, arraiás, quermesses e eventos temáticos em todo o Brasil. Encontre sua próxima Festa Junina na Viby.",
    url: "https://viby.club/festa-junina",
    siteName: "Viby",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417",
        width: 1200,
        height: 630,
        alt: "Festa Junina na Viby"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Festa Junina 2026 | Encontre Arraiás e Eventos na Viby",
    description:
      "Descubra festas juninas, arraiás, quermesses e eventos temáticos em todo o Brasil. Encontre sua próxima Festa Junina na Viby.",
    images: [
      "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417"
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
