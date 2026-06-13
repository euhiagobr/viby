import * as React from "react"
import { Metadata } from "next"
import { getAdminDb } from "@/lib/firebase/admin"
import CopaMundoClient from "./CopaMundoClient"
import { COPA_TAGS } from "@/lib/constants"
import Link from "next/link"
import Image from "next/image"
import { Trophy } from "lucide-react"

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

async function getBranding() {
  try {
    const db = getAdminDb();
    const snap = await db.collection('settings').doc('site').get();
    return snap.exists ? snap.data() : null;
  } catch (e) {
    return null;
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
  const settings = await getBranding();
  const siteName = settings?.siteName || "Viby";

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-[#009c3b] selection:text-white">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            {settings?.logoUrl ? (
              <Image 
                src={settings.logoUrl} 
                alt={siteName} 
                width={120} 
                height={40} 
                style={{ height: 'auto' }}
                className="h-8 w-auto object-contain transition-transform group-hover:scale-105" 
                priority 
                unoptimized 
              />
            ) : (
              <span className="text-xl font-black italic uppercase text-primary ml-1">{siteName}</span>
            )}
          </Link>
          <div className="flex items-center gap-4">
             <Link href="/copa-do-mundo/tabela" className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-secondary transition-colors">Tabela Completa</Link>
          </div>
        </div>
      </nav>
      <CopaMundoClient initialEvents={initialEvents} />
      <Footer />
    </div>
  );
}
