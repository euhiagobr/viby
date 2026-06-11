import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import ProfilePageClient from './ProfilePageClient';
import { notFound } from 'next/navigation';

const RESERVED_ROUTES = [
  'dashboard', 'admin', 'login', 'cadastro', 'redefinir-senha', 
  'checkout', 'privacidade', 'termos', 'api', 'suporte', 
  'support', 'help', 'onboarding', 'faq', 'recorrente', 'ganhe-dinheiro',
  'marketing', 'afiliados', 'anuncios', 'imposto', 'extrato', 'transferencias',
  'financeiro', 'usuarios', 'paginas', 'denuncias', 'logs', 'emails', 
  'configuracoes', 'equipe', 'notificacoes', 'scanner', 'presenca', 'ingressos',
  'novo', 'new', 'projeto', 'auth'
];

const VIBY_DEFAULT_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

function serializeData(data: any): any {
  if (data === null || data === undefined) return null;
  
  if (typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }
  
  if (data instanceof Date) {
    return data.toISOString();
  }

  if (Array.isArray(data)) {
    return data.map(item => serializeData(item));
  }

  if (typeof data === 'object') {
    const proto = Object.getPrototypeOf(data);
    if (proto !== null && proto !== Object.prototype) {
      return String(data);
    }
    
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

async function getProfileData(usernameParam: string) {
  try {
    const username = decodeURIComponent(usernameParam).toLowerCase().trim();
    if (RESERVED_ROUTES.includes(username)) return null;

    const db = getAdminDb();
    const usernameSnap = await db.collection("usernames").doc(username).get();
    
    if (!usernameSnap.exists) return null;
    
    const { uid, type } = usernameSnap.data()!;
    const targetColl = type === 'user' ? 'users' : 'organizations';
    const dataSnap = await db.collection(targetColl).doc(uid).get();
    
    if (!dataSnap.exists) return null;
    const profile = dataSnap.data()!;
    
    if (['Bloqueado', 'Excluído', 'Desativado', 'Exclusão Programada'].includes(profile.status)) {
       return null;
    }

    return serializeData({ id: dataSnap.id, type, ...profile });
  } catch (e) {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  try {
    const { username } = await params;
    const profile = await getProfileData(username);
    if (!profile) return { title: 'Viby' };

    const name = profile.type === 'organization' ? profile.name : (profile.name || profile.displayName || username);
    const title = `${name} • Viby`;
    const description = profile.bio || `Confira o perfil oficial de ${name} na Viby.`;
    const image = profile.avatar || profile.banner || VIBY_DEFAULT_IMAGE;

    return {
      title,
      description,
      keywords: ['perfil', 'viby', name, profile.username],
      alternates: { canonical: `/${username}` },
      openGraph: {
        title,
        description,
        url: `https://viby.club/${username}`,
        siteName: 'Viby',
        images: [{ url: image, width: 1200, height: 630, alt: name }],
        type: 'profile',
        locale: 'pt_BR',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
      robots: {
        index: true,
        follow: true,
      }
    };
  } catch (e) {
    return { title: 'Viby | Perfil' };
  }
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfileData(username);
  
  if (!profile) {
    // Se for rota reservada, o Next.js continuará procurando por outros arquivos (admin/page.tsx etc)
    // Se não for reservada e não houver perfil, retornamos 404
    const cleanUser = username.toLowerCase().trim();
    if (RESERVED_ROUTES.includes(cleanUser)) return null;
    notFound();
  }

  return <ProfilePageClient username={username} />;
}
