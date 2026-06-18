
import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import BrandAssetsClient from './BrandAssetsClient';
import { notFound } from 'next/navigation';
import { PublicHeader } from '@/components/layout/PublicHeader';
import Footer from '@/components/layout/Footer';

/**
 * @fileOverview Página de Material de Marca (Media Kit) da Organização.
 * Resolve a organização por ID ou Username para URLs amigáveis.
 */

async function getOrgData(idOrUsername: string) {
  try {
    const db = getAdminDb();
    let orgId = idOrUsername;

    // 1. Tentar resolver via índice de usernames
    const usernameSnap = await db.collection('usernames').doc(idOrUsername.toLowerCase().trim()).get();
    if (usernameSnap.exists) {
      const data = usernameSnap.data();
      if (data?.type === 'organization') {
        orgId = data.uid;
      }
    }

    // 2. Fallback: Se não resolveu pelo índice, tentar busca direta pelo campo username
    if (orgId === idOrUsername) {
      const orgQuery = await db.collection('organizations')
        .where('username', '==', idOrUsername.toLowerCase().trim())
        .limit(1)
        .get();
      
      if (!orgQuery.empty) {
        orgId = orgQuery.docs[0].id;
      }
    }

    // 3. Buscar o documento final da organização
    const orgSnap = await db.collection('organizations').doc(orgId).get();
    
    if (!orgSnap.exists) return null;
    
    const data = orgSnap.data();
    return {
      id: orgSnap.id,
      name: data?.name || "Organização",
      username: data?.username || "marca",
      avatar: data?.avatar || "",
      banner: data?.banner || "",
      type: data?.type || "Marca",
      verified: data?.verified || false
    };
  } catch (e) {
    console.error("[MediaKit-SSR] Error fetching org:", e);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const org = await getOrgData(id);
  
  if (!org) return { title: 'Media Kit Não Encontrado | Viby' };

  const title = `Material de Marca: ${org.name} | Viby`;
  const description = `Acesse e baixe os materiais oficiais da marca ${org.name} no Viby.`;
  const url = `https://viby.club/viby/${org.username}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      images: org.avatar ? [{ url: org.avatar }] : [],
      type: 'website'
    }
  };
}

export default async function BrandAssetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getOrgData(id);

  if (!org) notFound();

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      <PublicHeader showBack hideCopa />
      
      <main className="flex-1 container mx-auto px-4 py-12 max-w-6xl">
        <BrandAssetsClient organization={org} />
      </main>

      <Footer />
    </div>
  );
}
