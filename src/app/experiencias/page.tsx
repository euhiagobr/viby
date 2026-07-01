
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

export async function generateMetadata({ searchParams }: { searchParams: Promise<any> }): Promise<Metadata> {
  const params = await searchParams;
  const categoriaSlug = params.categoria as string;
  
  let title = 'Experiências, passeios e atrações | Viby';
  let description = 'Descubra vivências exclusivas, workshops, tours e experiências com agendamento perto de você. Reserve seu lugar na Viby.';

  if (categoriaSlug) {
    try {
      const db = getAdminDb();
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

  return {
    title,
    description,
    alternates: { canonical: 'https://viby.club/experiencias' },
    openGraph: {
      title,
      description,
      url: 'https://viby.club/experiencias',
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
    
    // Busca experiências com status 'active' ou 'Ativo' para garantir compatibilidade
    const expSnap = await db.collection('experiences').get();
    const categoriesSnap = await db.collection('categories').where('type', '==', 'experience').get();
      
    const allExp = expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const activeExperiences = allExp.filter((e: any) => e.status === 'active' || e.status === 'Ativo');
    
    const categories = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return {
      experiences: serializeData(activeExperiences),
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
      <React.Suspense fallback={<div className="flex-1 flex items-center justify-center py-40"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>}>
        <ExperienciasClient initialExperiences={experiences} initialCategories={categories} />
      </React.Suspense>
      <Footer />
    </div>
  );
}

function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
