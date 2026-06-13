import * as React from 'react';
import { Metadata } from 'next';
import TabelaClient from './TabelaClient';
import { getWorldCupData, getBrazilStats } from '@/services/world-cup-service';
import Footer from '@/components/layout/Footer';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Globe, Trophy } from 'lucide-react';
import { getAdminDb } from '@/lib/firebase/admin';

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

async function getBranding() {
  try {
    const db = getAdminDb();
    const snap = await db.collection('settings').doc('site').get();
    return snap.exists ? snap.data() : null;
  } catch (e) {
    return null;
  }
}

export default async function TabelaCopaPage() {
  const data = await getWorldCupData();
  const brazilStats = getBrazilStats(data.groups, data.matches);
  const settings = await getBranding();
  const siteName = settings?.siteName || "Viby";

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-[#009c3b] selection:text-white">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <Button variant="ghost" size="icon" asChild className="rounded-full"><Link href="/copa-do-mundo"><ArrowLeft className="w-5 h-5" /></Link></Button>
             <Link href="/" className="flex items-center gap-2 group">
               {settings?.logoUrl ? (
                 <Image 
                   src={settings.logoUrl} 
                   alt={siteName} 
                   width={120} 
                   height={40} 
                   style={{ height: 'auto' }}
                   className="h-8 w-auto object-contain" 
                   priority 
                   unoptimized 
                 />
               ) : (
                 <span className="text-xl font-black italic uppercase text-primary ml-1">{siteName}</span>
               )}
             </Link>
          </div>
          <div className="flex items-center gap-2">
             <Badge className="bg-[#ffdf00] text-[#002776] border-none font-black uppercase text-[10px] tracking-widest hidden sm:flex items-center gap-1.5 px-3 h-8">
                <Trophy className="w-3.5 h-3.5 fill-current" /> World Cup 2026
             </Badge>
          </div>
        </div>
      </nav>

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
