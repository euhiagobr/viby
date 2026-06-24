import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import ThematicPageClient from '@/components/events/ThematicPageClient';
import { THEMATIC_PAGES_CONFIG } from '@/lib/thematic-configs';

export const revalidate = 3600;

const config = THEMATIC_PAGES_CONFIG['ano-novo'];

export const metadata: Metadata = {
  title: config.title,
  description: config.description,
  alternates: { canonical: `https://viby.club/${config.slug}` },
  openGraph: {
    title: config.title,
    description: config.description,
    url: `https://viby.club/${config.slug}`,
    siteName: 'Viby',
    images: [{ url: 'https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibycapa.jpeg?alt=media&token=352689b1-73e0-409b-ad29-e1c5e660bac0' }],
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: config.title,
    description: config.description,
    images: ['https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibycapa.jpeg?alt=media&token=352689b1-73e0-409b-ad29-e1c5e660bac0'],
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

async function getInitialEvents() {
  try {
    const db = getAdminDb();
    const snap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .where('tags', 'array-contains-any', config.tags)
      .limit(12)
      .get();
      
    const events = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return serializeData(events);
  } catch (e) {
    return [];
  }
}

export default async function AnoNovoPage() {
  const initialEvents = await getInitialEvents();
  return <ThematicPageClient initialEvents={initialEvents} config={config} />;
}