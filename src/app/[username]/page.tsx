
import * as React from 'react';
import { Metadata } from 'next';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import ProfilePageClient from './ProfilePageClient';
import { notFound } from 'next/navigation';

async function getProfileData(username: string) {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app, "eventosviby");
  
  try {
    const usernameRef = doc(db, "usernames", username.toLowerCase());
    const usernameSnap = await getDoc(usernameRef);

    if (!usernameSnap.exists()) return null;
    const { uid, type } = usernameSnap.data();
    
    const targetColl = type === 'user' ? 'users' : 'organizations';
    const dataSnap = await getDoc(doc(db, targetColl, uid));
    
    if (!dataSnap.exists()) return null;
    return { id: dataSnap.id, type, ...dataSnap.data() } as any;
  } catch (e) {
    console.error("Erro ao buscar dados do perfil no servidor:", e);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileData(username);

  if (!profile) {
    return {
      title: 'Perfil não encontrado',
    };
  }

  const name = profile.type === 'organization' ? profile.name : (profile.name || profile.displayName);
  const title = `${name} • @${username} | Viby`;
  const description = profile.bio || `Confira o perfil oficial de ${name} na Viby. Eventos, experiências e conexões culturais.`;
  
  const ogImageUrl = new URL('https://viby.club/api/og');
  ogImageUrl.searchParams.set('type', 'profile');
  ogImageUrl.searchParams.set('name', name);
  ogImageUrl.searchParams.set('username', username);
  if (profile.avatar) ogImageUrl.searchParams.set('avatar', profile.avatar);
  if (profile.banner) ogImageUrl.searchParams.set('image', profile.banner);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `https://viby.club/${username}`,
      images: [
        {
          url: ogImageUrl.toString(),
          width: 1200,
          height: 630,
          alt: name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl.toString()],
    },
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  
  // Verifica se o username é um termo reservado que pode estar conflitando com rotas estáticas
  const reserved = ['dashboard', 'admin', 'login', 'cadastro', 'redefinir-senha', 'checkout', 'privacidade', 'termos', 'api'];
  if (reserved.includes(username.toLowerCase())) {
    // Se por algum motivo o roteamento dinâmico capturou uma rota estática, ignoramos aqui
    // No entanto, o Next.js prioriza pastas estáticas.
    return null;
  }

  const profile = await getProfileData(username);
  
  // Se o perfil realmente não existir, mostramos a página 404 do Next ou o tratamento do client
  // No seu caso, o ProfilePageClient já trata a ausência de dados, mas vamos garantir aqui.

  return <ProfilePageClient username={username} />;
}
