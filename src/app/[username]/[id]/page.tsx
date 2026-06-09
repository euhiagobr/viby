import * as React from 'react';
import { Metadata } from 'next';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { redirect } from 'next/navigation';

/**
 * @fileOverview Rota de legado para IDs. Redireciona para o Slug se disponível.
 */

async function getEventData(id: string) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    const eventRef = doc(db, 'events', id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return null;
    return { id: eventSnap.id, ...eventSnap.data() } as any;
  } catch (e) {
    return null;
  }
}

export default async function EventoLegacyIdPage({ params }: { params: Promise<{ username: string, id: string }> }) {
  const { username, id } = await params;
  const event = await getEventData(id);

  if (event) {
    // Se o evento tem slug, redireciona para a URL amigável
    if (event.slug) {
      redirect(`/${username}/${event.slug}`);
    }
    // Se não tem slug (caso raro), redireciona para a própria página de slug que agora aceita IDs como fallback
    redirect(`/${username}/${id}`);
  }

  // Se o evento não existe, redireciona para a página de slug que tratará o erro "Ops"
  redirect(`/${username}/${id}`);
}