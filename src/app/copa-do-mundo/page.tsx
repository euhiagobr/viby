import * as React from "react"
import { Metadata } from "next"
import CopaMundoClient from "./CopaMundoClient"
import { COPA_TAGS } from "@/lib/constants"
import { CopaHeader } from "@/components/layout/CopaHeader"
import Footer from '@/components/layout/Footer';
import { getAdminDb } from "@/lib/firebase/admin"

export const metadata: Metadata = {
  title: 'Onde Assistir à Copa do Mundo 2026 | Viby',
  description: 'Descubra bares, telões, festas e eventos para assistir aos jogos da Copa do Mundo 2026 perto de você.',
  alternates: { canonical: 'https://viby.club/copa-do-mundo' },
  openGraph: {
    title: 'Onde Assistir à Copa do Mundo 2026 | Viby',
    description: 'Encontre os melhores locais para torcer pelo Brasil na Copa do Mundo 2026.',
    url: 'https://viby.club/copa-do-mundo',
    images: [{ url: 'https://picsum.photos/seed/copa2026/1200/630' }],
    type: 'website',
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

async function getCopaEvents() {
  try {
    const db = getAdminDb();
    const snap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .where('tags', 'array-contains-any', COPA_TAGS)
      .orderBy('date', 'asc')
      .limit(12)
      .get();
      
    const events = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return serializeData(events);
  } catch (e) {
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
