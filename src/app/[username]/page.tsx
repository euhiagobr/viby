import * as React from 'react';
import { Metadata } from 'next';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import ProfilePageClient from './ProfilePageClient';

const RESERVED_ROUTES = [
  'dashboard', 
  'admin', 
  'login', 
  'cadastro', 
  'redefinir-senha', 
  'checkout', 
  'privacidade', 
  'termos', 
  'api',
  'suporte',
  'support',
  'help',
  'onboarding',
  'faq'
];

/**
 * Converte Timestamps do Firestore em strings para serialização segura no RSC.
 */
function serializeData(data: any) {
  if (!data) return data;
  const serialized = { ...data };
  for (const key in serialized) {
    if (serialized[key]?.toDate && typeof serialized[key].toDate === 'function') {
      serialized[key] = serialized[key].toDate().toISOString();
    } else if (typeof serialized[key] === 'object' && serialized[key] !== null) {
      serialized[key] = serializeData(serialized[key]);
    }
  }
  return serialized;
}

async function getProfileData(username: string) {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app);
  
  try {
    const usernameRef = doc(db, "usernames", username.toLowerCase().trim());
    const usernameSnap = await getDoc(usernameRef);

    if (!usernameSnap.exists()) return null;
    const { uid, type } = usernameSnap.data();
    
    const targetColl = type === 'user' ? 'users' : 'organizations';
    const dataSnap = await getDoc(doc(db, targetColl, uid));
    
    if (!dataSnap.exists()) return null;
    return serializeData({ id: dataSnap.id, type, ...dataSnap.data() });
  } catch (e) {
    console.error("Erro ao buscar dados do perfil no servidor:", e);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  
  if (RESERVED_ROUTES.includes(username.toLowerCase())) {
    return { title: 'Viby' };
  }

  const profile = await getProfileData(username);

  if (!profile) {
    return {
      title: 'Perfil não encontrado',
    };
  }

  const name = profile.type === 'organization' ? profile.name : (profile.name || profile.displayName);
  const title = `${name} • @${username} | Viby`;
  const description = profile.bio || `Confira o perfil oficial de ${name} na Viby. Eventos, experiências e conexões culturais.`;
  
  return {
    title,
    description,
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  
  if (RESERVED_ROUTES.includes(username.toLowerCase())) {
    return null;
  }

  return <ProfilePageClient username={username} />;
}
