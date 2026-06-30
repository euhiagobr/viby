import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import ExperienciaPublicaClient from './ExperienciaPublicaClient';
import { notFound } from 'next/navigation';

async function getExperienceData(usernameParam: string, slugParam: string) {
  const db = getAdminDb();
  try {
    const q = await db.collection('experiences')
      .where('slug', '==', slugParam)
      .where('organizer.username', '==', usernameParam.toLowerCase())
      .limit(1)
      .get();

    if (q.empty) return null;
    
    const doc = q.docs[0];
    const data = doc.data();
    
    // Serialização básica para o Next.js 15
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.().toISOString() || null,
      updatedAt: data.updatedAt?.toDate?.().toISOString() || null,
    };
  } catch (e) {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string, slug: string }> }): Promise<Metadata> {
  const { username, slug } = await params;
  const exp: any = await getExperienceData(username, slug);
  
  if (!exp || exp.status === 'draft') return { title: 'Experiência não encontrada | Viby', robots: { index: false } };

  const title = `${exp.title} | ${exp.organizer?.name} | Viby`;
  const description = exp.shortDescription || exp.description?.substring(0, 160);
  const url = `https://viby.club/${username}/experiencia/${slug}`;
  const image = exp.image || "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibycapa.jpeg?alt=media&token=352689b1-73e0-409b-ad29-e1c5e660bac0";

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Viby',
      images: [{ url: image, width: 1200, height: 630 }],
      type: 'website',
      locale: 'pt_BR',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image]
    },
    robots: { index: true, follow: true }
  };
}

export default async function PublicExperiencePage({ params }: { params: Promise<{ username: string, slug: string }> }) {
  const { username, slug } = await params;
  const exp = await getExperienceData(username, slug);

  if (!exp || (exp.status === 'draft')) notFound();

  return <ExperienciaPublicaClient experience={exp} />;
}
