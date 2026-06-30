
import * as React from "react";
import { Metadata } from "next";
import { getAdminDb } from "@/lib/firebase/admin";
import ExperienciasClient from "./ExperienciasClient";
import { PublicHeader } from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import { slugify } from "@/lib/slug-utils";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VIBY_OG_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibycapa.jpeg?alt=media&token=352689b1-73e0-409b-ad29-e1c5e660bac0";

function serializeData(data: any): any {
  if (data === null || data === undefined) return null;
  if (typeof data.toDate === 'function') return data.toDate().toISOString();
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(item => serializeData(item));
  if (typeof data === 'object') {
    const serialized: any = {};
    Object.keys(data).forEach(key => {
      serialized[key] = serializeData(data[key]);
    });
    return serialized;
  }
  return data;
}

/**
 * SEO DINÂMICO: Altera título e descrição com base na categoria da URL
 */
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }): Promise<Metadata> {
  const params = await searchParams;
  const categoriaSlug = params.categoria as string;
  
  let title = 'Experiências, passeios e atrações | Viby';
  let description = 'Descubra vivências exclusivas, workshops, tours e experiências com agendamento perto de você. Reserve seu lugar na Viby.';

  if (categoriaSlug) {
    try {
      const db = getAdminDb();
      // Buscamos o nome original da categoria para o título
      const catsSnap = await db.collection('categories').where('type', '==', 'experience').get();
      const cat = catsSnap.docs.find(d => slugify(d.data().name) === categoriaSlug);
      
      if (cat) {
        const catName = cat.data().name;
        title = `${catName} | Experiências Viby`;
        description = `Confira os melhores ${catName.toLowerCase()} e experiências culturais para reservar online na Viby.`;
      }
    } catch (e) {
      console.warn("[Metadata Error] Fallback to default.");
    }
  }

  const url = `https://viby.club/experiencias${categoriaSlug ? `?categoria=${categoriaSlug}` : ''}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Viby',
      images: [{ url: VIBY_OG_IMAGE, width: 1200, height: 630 }],
      locale: 'pt_BR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      images: [VIBY_OG_IMAGE],
    }
  }
}

async function getInitialData() {
  try {
    const db = getAdminDb();
    
    const [expSnap, catsSnap] = await Promise.all([
      db.collection('experiences').where('status', '==', 'active').get(),
      db.collection('categories').where('type', '==', 'experience').orderBy('name', 'asc').get()
    ]);
      
    const experiences = expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const categories = catsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return {
      experiences: serializeData(experiences),
      categories: serializeData(categories)
    };
  } catch (e: any) {
    console.error("[SSR Experiences Fetch Error]:", e.message);
    return { experiences: [], categories: [] };
  }
}

export default async function ExperienciasLandingPage() {
  const { experiences, categories } = await getInitialData();

  return (
    <div className="min-h-screen bg-white flex flex-col selection:bg-secondary/30 selection:text-primary">
      <PublicHeader showBack hideCopa />
      <ExperienciasClient initialExperiences={experiences} initialCategories={categories} />
      <Footer />
    </div>
  );
}
