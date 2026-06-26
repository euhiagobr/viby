
import * as React from "react";
import { Metadata } from "next";
import { PublicHeader } from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
import CalculadoraClient from "./CalculadoraClient";
import { Calculator, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: 'Calculadora de Economia para Organizadores | Viby',
  description: 'Descubra quanto você pode economizar utilizando a Viby. Compare nossas taxas com a concorrência e veja seu lucro crescer.',
  alternates: { canonical: 'https://viby.club/anunciar/calculadora' },
  openGraph: {
    title: 'Viby | Simulador de Repasses e Economia',
    description: 'Compare gratuitamente nossas taxas com outras plataformas e veja quanto sobra no seu bolso.',
    url: 'https://viby.club/anunciar/calculadora',
    siteName: 'Viby',
    images: [{ url: 'https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibycapa.jpeg?alt=media', width: 1200, height: 630 }],
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Quanto você economiza na Viby?',
    images: ['https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibycapa.jpeg?alt=media'],
  },
  robots: { index: true, follow: true }
};

export default function CalculadoraPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Calculadora de Economia Viby",
    "applicationCategory": "BusinessApplication",
    "description": "Ferramenta de simulação de taxas e repasses para organizadores de eventos.",
    "url": "https://viby.club/anunciar/calculadora",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "BRL"
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      <script 
        type="application/ld+json" 
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} 
      />
      <PublicHeader showBack hideCopa />

      <header className="relative bg-white border-b overflow-hidden">
         <div className="absolute top-0 right-0 p-20 opacity-[0.03] pointer-events-none">
            <Calculator className="w-[600px] h-[600px]" />
         </div>
         <div className="container mx-auto px-4 py-20 md:py-32 relative z-10 text-center space-y-6">
            <div className="bg-secondary/10 text-secondary px-6 py-2 rounded-full w-fit mx-auto font-black uppercase text-xs tracking-widest flex items-center gap-2 animate-bounce">
               <Zap className="w-4 h-4 fill-current" /> Marketing Comercial
            </div>
            <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter leading-[0.85] text-primary">
              DESCUBRA QUANTO VOCÊ PODE <span className="text-secondary">ECONOMIZAR</span>
            </h1>
            <p className="text-lg md:text-xl font-medium text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Compare gratuitamente nossas taxas com outras plataformas e veja quanto o seu evento lucra a mais na Viby.
            </p>
         </div>
      </header>

      <main className="container mx-auto px-4 py-16 md:py-24 flex-1">
         <CalculadoraClient />
      </main>

      <Footer />
    </div>
  );
}
