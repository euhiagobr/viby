
import * as React from 'react';
import { Metadata } from 'next';
import TabelaClient from './TabelaClient';
import Footer from '@/components/layout/Footer';
import { CopaHeader } from '@/components/layout/CopaHeader';
import { Globe } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Tabela da Copa do Mundo 2026',
  description: 'Classificação dos grupos, resultados e próximos jogos da Copa do Mundo 2026.',
  alternates: { canonical: 'https://viby.club/copa-do-mundo/tabela' },
  openGraph: {
    title: 'Tabela da Copa do Mundo 2026 | Viby',
    description: 'Acompanhe grupos, jogos e resultados da Copa do Mundo 2026 em tempo real.',
    url: 'https://viby.club/copa-do-mundo/tabela',
    images: [{ url: 'https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417' }],
    type: 'website',
  }
};

export default function TabelaCopaPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-[#009c3b] selection:text-white">
      <CopaHeader />

      <header className="bg-white border-b overflow-hidden relative">
         <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
            <Globe className="w-[800px] h-[800px] absolute -right-20 -top-20" />
         </div>
         <div className="container mx-auto px-4 py-16 md:py-24 relative z-10 text-center space-y-6">
            <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter leading-[0.85] text-primary">TABELA <span className="text-[#009c3b]">COMPLETA</span></h1>
            <p className="text-lg md:text-xl font-medium text-muted-foreground max-w-xl mx-auto uppercase tracking-wide">Dados atualizados em tempo real!</p>
         </div>
      </header>

      <main className="container mx-auto px-4 py-12 md:py-20 flex-1">
         <TabelaClient />
      </main>

      <Footer />
    </div>
  );
}
