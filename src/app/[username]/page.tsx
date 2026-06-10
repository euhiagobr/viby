
import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import ProfilePageClient from './ProfilePageClient';

const RESERVED_ROUTES = [
  'dashboard', 'admin', 'login', 'cadastro', 'redefinir-senha', 
  'checkout', 'privacidade', 'termos', 'api', 'suporte', 
  'support', 'help', 'onboarding', 'faq', 'recorrente', 'ganhe-dinheiro'
];

const VIBY_DEFAULT_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

function serializeData(data: any): any {
  if (data === null || data === undefined) return data;
  
  if (typeof data.toDate === 'function') return data.toDate().toISOString();
  
  if (data instanceof Date) return data.toISOString();

  if (Array.isArray(data)) return data.map(item => serializeData(item));
  
  if (typeof data === 'object' && data.constructor.name === 'Object') {
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

async function getProfileData(username: string) {
  const db = getAdminDb();
  try {
    const usernameSnap = await db.collection("usernames").doc(username.toLowerCase().trim()).get();
    if (!usernameSnap.exists) return null;
    
    const { uid, type } = usernameSnap.data()!;
    const targetColl = type === 'user' ? 'users' : 'organizations';
    const dataSnap = await db.collection(targetColl).doc(uid).get();
    
    if (!dataSnap.exists) return null;
    return serializeData({ id: dataSnap.id, type, ...dataSnap.data() });
  } catch (e) {
    console.error("Erro ao buscar perfil no servidor:", e);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const username = resolvedParams.username;
  
  if (RESERVED_ROUTES.includes(username.toLowerCase())) {
    return { title: 'Viby' };
  }

  const profile = await getProfileData(username);
  if (!profile) return { title: 'Perfil não encontrado | Viby' };

  const name = profile.type === 'organization' ? profile.name : (profile.name || profile.displayName || username);
  const title = `${name} • Viby`;
  const description = profile.bio || `Confira o perfil oficial de ${name} na Viby. Eventos, experiências e conexões culturais.`;
  const image = profile.avatar || profile.banner || VIBY_DEFAULT_IMAGE;
  const url = `https://viby.club/${username}`;

  return {
    title,
    description,
    alternates: { canonical: `/${username}` },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Viby',
      images: [{ url: image, width: 1200, height: 630 }],
      locale: 'pt_BR',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const resolvedParams = await params;
  const username = resolvedParams.username;

  if (RESERVED_ROUTES.includes(username.toLowerCase())) return null;
  return <ProfilePageClient username={username} />;
}
