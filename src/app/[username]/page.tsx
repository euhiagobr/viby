import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import ProfilePageClient from './ProfilePageClient';
import { notFound } from 'next/navigation';

const RESERVED_ROUTES = [
  'dashboard', 'admin', 'login', 'cadastro', 'redefinir-senha', 
  'checkout', 'privacidade', 'termos', 'api', 'suporte', 'explorar',
  'support', 'help', 'onboarding', 'faq', 'recorrente', 'ganhe-dinheiro',
  'marketing', 'afiliados', 'anuncios', 'imposto', 'extrato', 'transferencias',
  'financeiro', 'usuarios', 'paginas', 'denuncias', 'logs', 'emails', 
  'configuracoes', 'equipe', 'notificacoes', 'scanner', 'presenca', 'ingressos',
  'novo', 'new', 'projeto', 'auth', 'para-organizadores', 'search', 'settings',
  'favicon.ico', 'robots.txt', 'sitemap.xml', 'manifest.webmanifest', 'og'
];

const VIBY_DEFAULT_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

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
    
    if (['Bloqueado', 'Excluído', 'Desativado'].includes(profile.status)) return null;

    return serializeData({ id: dataSnap.id, type, ...profile });
  } catch (e) {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  
  if (RESERVED_ROUTES.includes(username.toLowerCase())) {
    return {};
  }

  const profile = await getProfileData(username);
  if (!profile) return { title: 'Perfil Não Encontrado | Viby', robots: { index: false } };

  const name = profile.type === 'organization' ? profile.name : (profile.name || profile.displayName || username);
  const title = `${name} | @${username} | Viby`;
  const description = profile.bio || `Confira o perfil oficial de ${name} na Viby.`;
  const image = profile.avatar || profile.banner || VIBY_DEFAULT_IMAGE;
  const url = `https://viby.club/${username}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
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
    robots: { index: true, follow: true }
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const usernameLower = username.toLowerCase();

  if (RESERVED_ROUTES.includes(usernameLower)) {
    return null;
  }

  const profile = await getProfileData(username);
  
  if (!profile) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": profile.type === 'organization' ? "Organization" : "Person",
    "name": profile.name || profile.displayName || username,
    "description": profile.bio || "",
    "image": profile.avatar || VIBY_DEFAULT_IMAGE,
    "url": `https://viby.club/${username}`,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": profile.city,
      "addressRegion": profile.state,
      "addressCountry": "BR"
    }
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProfilePageClient username={username} />
    </>
  );
}
