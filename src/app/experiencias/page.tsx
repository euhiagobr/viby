
import * as React from "react";
import { Metadata } from "next";
import { getAdminDb } from "@/lib/firebase/admin";
import ExperienciasClient from "./ExperienciasClient";
import { PublicHeader } from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";

const VIBY_OG_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibycapa.jpeg?alt=media&token=352689b1-73e0-409b-ad29-e1c5e660bac0";

export const metadata: Metadata = {
  title: 'Experiências e Vivências Culturais | Viby',
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

async function getInitialExperiences() {
  try {
    const db = getAdminDb();
    console.log("[DEBUG SERVER] Buscando experiências no Firestore...");
    
    // Consulta otimizada para o novo índice composto
    const snap = await db.collection('experiences')
      .where('status', 'in', ['active'])
      .orderBy('createdAt', 'desc')
      .limit(60)
      .get();
      
    console.log(`[DEBUG SERVER] Firestore retornou ${snap.size} documentos.`);
    
    if (snap.empty) {
      console.warn("[DEBUG SERVER] Atenção: Coleção 'experiences' com status 'active' retornou zero resultados.");
      return [];
    }
    
    const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return serializeData(docs);
  } catch (e: any) {
    console.error("[DEBUG SERVER] Erro fatal no fetch SSR:", e.message);
    return [];
  }
}

export default async function ExperienciasLandingPage() {
  const initialData = await getInitialExperiences();

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      <PublicHeader showBack />
      <ExperienciasClient initialData={initialData} />
      <Footer />
    </div>
  );
}
