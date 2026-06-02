'use server';

import * as React from 'react';
import { doc, getDoc, getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, ArrowRight, RefreshCw, MapPin } from 'lucide-react';
import Link from 'next/link';
import Footer from '@/components/layout/Footer';

async function getSeriesData(id: string) {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app);
  
  // Busca na coleção principal 'events'
  const seriesRef = doc(db, 'events', id);
  let snap = await getDoc(seriesRef);
  
  // Fallback para 'recurring_events' se for um registro antigo/admin
  if (!snap.exists()) {
    snap = await getDoc(doc(db, 'recurring_events', id));
  }
  
  if (!snap.exists()) return null;

  // Consulta sem orderBy para evitar necessidade de índice composto
  const occQ = query(
    collection(db, 'recurring_occurrences'), 
    where('parentId', '==', id),
    where('status', '==', 'active')
  );
  const occSnap = await getDocs(occQ);
  
  // Ordenação manual em memória para evitar erros de índice
  const occurrences = occSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  return { id: snap.id, ...snap.data(), occurrences } as any;
}

export default async function SeriesPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const series = await getSeriesData(id);

  if (!series) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center">
       <h1 className="text-2xl font-bold">Série não encontrada</h1>
       <Button asChild><Link href="/">Voltar ao Início</Link></Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-20 max-w-4xl">
        <div className="text-center space-y-6 mb-16">
          <Badge className="bg-secondary text-white font-black uppercase text-[10px] px-4 h-6">Série de Eventos</Badge>
          <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter text-primary">{series.name}</h1>
          <p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto">{series.description}</p>
        </div>

        <div className="space-y-8">
           <div className="flex items-center gap-3 px-2">
              <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                 <Calendar className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Escolha uma Data</h2>
           </div>

           <div className="grid grid-cols-1 gap-4">
              {series.occurrences.length > 0 ? (
                series.occurrences.map((occ: any) => (
                  <Link key={occ.id} href={`/recorrente/${occ.id}`}>
                    <Card className="border-none shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all rounded-[2rem] bg-white group cursor-pointer">
                      <CardContent className="p-8 flex items-center justify-between">
                         <div className="flex items-center gap-6">
                            <div className="flex flex-col items-center justify-center w-20 h-20 bg-muted rounded-3xl group-hover:bg-secondary/10 transition-colors">
                               <span className="text-[10px] font-black uppercase text-muted-foreground">{new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}</span>
                               <span className="text-3xl font-black text-primary">{occ.date.split('-')[2]}</span>
                            </div>
                            <div className="space-y-1">
                               <p className="font-black text-xl uppercase italic text-primary">{new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
                               <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground uppercase">
                                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-secondary" /> {occ.startTime}</span>
                                  <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-secondary" /> Local Confirmado</span>
                               </div>
                            </div>
                         </div>
                         <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black uppercase text-secondary tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Ver Ingressos</span>
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-secondary group-hover:text-white transition-all shadow-inner">
                               <ArrowRight className="w-5 h-5" />
                            </div>
                         </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              ) : (
                <div className="py-20 text-center bg-white rounded-[2rem] border-2 border-dashed">
                   <p className="text-sm font-bold text-muted-foreground uppercase">Nenhuma data disponível no momento</p>
                </div>
              )}
           </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}