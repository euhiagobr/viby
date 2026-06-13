import * as React from 'react';
import { Metadata } from 'next';
import TabelaClient from './TabelaClient';
import { getWorldCupData, getBrazilStats } from '@/services/world-cup-service';
import Footer from '@/components/layout/Footer';
import { CopaHeader } from '@/components/layout/CopaHeader';
import { Globe } from 'lucide-react';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Tabela da Copa do Mundo 2026 | Classificação e Jogos | Viby',
  description: 'Acompanhe em tempo real a classificação dos grupos, resultados, próximos jogos e chaveamento do mata-mata da Copa do Mundo 2026.',
  alternates: { canonical: 'https://viby.club/copa-do-mundo/tabela' },
  openGraph: {
    title: 'Tabela da Copa do Mundo 2026 | Viby',
    description: 'Acompanhe grupos, jogos e resultados da Copa do Mundo 2026.',
    url: 'https://viby.club/copa-do-mundo/tabela',
    images: [{ url: 'https://picsum.photos/seed/copatabela/1200/630' }],
    type: 'website',
  }
};

export default async function TabelaCopaPage() {
  const data = await getWorldCupData();
  const brazilStats = getBrazilStats(data.groups, data.matches);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-[#009c3b] selection:text-white">
      <CopaHeader />

      <header className="bg-white border-b overflow-hidden relative">
         <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
            <Globe className="w-[800px] h-[800px] absolute -right-20 -top-20" />
         </div>
         <div className="container mx-auto px-4 py-16 md:py-24 relative z-10 text-center space-y-6">
            <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter leading-[0.85] text-primary">TABELA <span className="text-[#009c3b]">COMPLETA</span></h1>
            <p className="text-lg md:text-xl font-medium text-muted-foreground max-w-xl mx-auto uppercase tracking-wide">Acompanhe a jornada rumo à glória eterna.</p>
         </div>
      </header>

      <main className="container mx-auto px-4 py-12 md:py-20 flex-1">
         <TabelaClient data={data} brazilStats={brazilStats} />
      </main>

      <Footer />
    </div>
  );
}
