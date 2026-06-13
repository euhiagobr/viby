
import * as React from "react"
import { Metadata } from "next"
import { getAdminDb } from "@/lib/firebase/admin"
import CopaMundoClient from "./CopaMundoClient"

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
    const proto = Object.getPrototypeOf(data);
    if (proto !== null && proto !== Object.prototype) return String(data);
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
    const tags = ["copa do mundo", "copa", "world cup", "fifa world cup", "assistir copa", "transmissão copa"];
    
    const snap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .where('tags', 'array-contains-any', tags)
      .orderBy('date', 'asc')
      .limit(12)
      .get();
      
    const events = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return serializeData(events);
  } catch (e) {
    console.error("[Copa SSR Fetch Error]", e);
    return [];
  }
}

export default async function CopaMundoPage() {
  const initialEvents = await getCopaEvents();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Onde Assistir à Copa do Mundo 2026",
    "description": "Lista de locais e eventos transmitindo a Copa do Mundo 2026.",
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Início", "item": "https://viby.club/" },
        { "@type": "ListItem", "position": 2, "name": "Copa do Mundo", "item": "https://viby.club/copa-do-mundo" }
      ]
    }
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CopaMundoClient initialEvents={initialEvents} />
    </>
  );
}
