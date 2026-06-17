
import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import BrandAssetsClient from './BrandAssetsClient';
import { notFound } from 'next/navigation';
import { PublicHeader } from '@/components/layout/PublicHeader';
import Footer from '@/components/layout/Footer';

/**
 * @fileOverview Página de Material de Marca (Media Kit) da Organização.
 */

async function getOrgData(id: string) {
  try {
    const db = getAdminDb();
    const orgSnap = await db.collection('organizations').doc(id).get();
    
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
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const org = await getOrgData(id);
  
  if (!org) return { title: 'Media Kit Não Encontrado | Viby' };

  const title = `Material de Marca: ${org.name} | Viby`;
  const description = `Acesse e baixe os materiais oficiais da marca ${org.name} no Viby.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: org.avatar ? [{ url: org.avatar }] : [],
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
