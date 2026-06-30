
import * as React from "react";
import { Metadata } from "next";
import { getAdminDb } from "@/lib/firebase/admin";
import ExperienciasClient from "./ExperienciasClient";
import { PublicHeader } from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";

const VIBY_OG_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibycapa.jpeg?alt=media&token=352689b1-73e0-409b-ad29-e1c5e660bac0";

export const metadata: Metadata = {
  title: 'Experiências, passeios e atrações | Viby',
  description: 'Descubra vivências exclusivas, workshops, tours e experiências com agendamento perto de você. Reserve seu lugar na Viby.',
  alternates: {
    canonical: 'https://viby.club/experiencias',
  },
  openGraph: {
    title: 'Experiências e Vivências Culturais | Viby',
    description: 'Encontre e reserve vivências inesquecíveis. O melhor do marketplace de experiências está na Viby.',
    url: 'https://viby.club/experiencias',
    siteName: 'Viby',
    images: [{ url: VIBY_OG_IMAGE, width: 1200, height: 630 }],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Viby | Experiências Culturais',
    images: [VIBY_OG_IMAGE],
  }
}

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

async function getInitialData() {
  try {
    const db = getAdminDb();
    
    const [expSnap, catsSnap] = await Promise.all([
      db.collection('experiences').where('status', '==', 'active').limit(50).get(),
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
      
      <div className="container mx-auto px-6 py-20 border-t border-muted/50">
         <p className="text-center text-muted-foreground font-medium text-lg max-w-2xl mx-auto">
            Descubra passeios, atrações e experiências selecionadas em todo o Brasil.
         </p>
      </div>
      <Footer />
    </div>
  );
}
