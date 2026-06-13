import * as React from "react"
import { Metadata } from "next"
import ExplorarClient from "./ExplorarClient"
import { getAdminDb } from "@/lib/firebase/admin"

export const metadata: Metadata = {
  title: 'Explorar Eventos | Viby',
  description: 'Descubra as melhores experiências culturais perto de você.',
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

async function getInitialEvents() {
  try {
    const db = getAdminDb();
    const snap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .orderBy('date', 'asc')
      .limit(9)
      .get();
      
    const events = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return serializeData(events);
  } catch (e) {
    return [];
  }
}

export default async function ExplorarPage() {
  const initialEvents = await getInitialEvents();
  return <ExplorarClient initialEvents={initialEvents} />
}
