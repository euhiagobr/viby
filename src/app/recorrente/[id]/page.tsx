'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, Clock, MapPin, Share2, Ticket, ArrowLeft, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import Footer from '@/components/layout/Footer';
import { BilheteriaPublic } from '@/components/events/Bilheteria/BilheteriaPublic';

export default function PublicOccurrencePage() {
  const params = useParams();
  const id = params.id as string;
  const db = useFirestore();
  const router = useRouter();

  const occRef = React.useMemo(() => (db ? doc(db, 'recurring_occurrences', id) : null), [db, id]);
  const { data: occ, loading: occLoading } = useDoc<any>(occRef);

  const seriesRef = React.useMemo(() => (db && occ?.parentId) ? doc(db, 'recurring_events', occ.parentId) : null, [db, occ?.parentId]);
  const { data: series } = useDoc<any>(seriesRef);

  const feesRef = React.useMemo(() => db ? doc(db, 'settings', 'fees') : null, [db]);
  const { data: globalFees } = useDoc<any>(feesRef);

  if (occLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-secondary" /></div>;
  
  if (!occ) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-6">
      <XCircle className="w-16 h-16 text-destructive opacity-20" />
      <h1 className="text-2xl font-bold uppercase italic text-primary">Data não localizada</h1>
      <Button asChild className="rounded-full"><Link href="/">Voltar ao Início</Link></Button>
    </div>
  );

  // Injetar dados da ocorrência nos dados do evento para o componente de bilheteria
  const eventProxy = {
    ...series,
    id: occ.parentId, // Vinculado ao pai para regras de bilheteria
    title: `${series?.name} - ${new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR')}`,
    date: occ.date,
    occurrenceId: occ.id,
    isRecurring: true
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl space-y-12">
        <div className="flex justify-between items-center px-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm"><ArrowLeft className="w-5 h-5" /></Button>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="rounded-full bg-white shadow-sm border-none"><Share2 className="w-4 h-4" /></Button>
          </div>
        </div>

        <section className="space-y-6">
          <div className="flex flex-col md:flex-row gap-8 items-start">
             <Card className="flex-1 border-none shadow-xl rounded-[3rem] overflow-hidden bg-white w-full">
                <div className="h-48 bg-primary relative flex items-center justify-center text-white">
                   <RefreshCw className="w-32 h-32 opacity-10 absolute animate-spin-slow" />
                   <div className="text-center space-y-2 px-8 relative z-10">
                      <Badge className="bg-secondary text-white font-black uppercase text-[9px] px-4 h-6">Data Selecionada</Badge>
                      <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter leading-none">{series?.name}</h1>
                   </div>
                </div>
                <CardContent className="p-10 space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="flex items-center gap-4">
                         <div className="p-3 bg-muted rounded-2xl text-secondary"><Calendar className="w-6 h-6" /></div>
                         <div>
                            <p className="text-[10px] font-black uppercase opacity-40">Data</p>
                            <p className="font-bold text-lg leading-none mt-1">{new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="p-3 bg-muted rounded-2xl text-secondary"><Clock className="w-6 h-6" /></div>
                         <div>
                            <p className="text-[10px] font-black uppercase opacity-40">Horário</p>
                            <p className="font-bold text-lg leading-none mt-1">{occ.startTime} às {occ.endTime}</p>
                         </div>
                      </div>
                   </div>
                </CardContent>
             </Card>
          </div>
        </section>

        {/* Bilheteria vinculada à ocorrência */}
        <section className="space-y-8">
           <div className="p-6 bg-orange-50 rounded-[2rem] border-2 border-dashed border-orange-200 flex items-start gap-4 animate-in zoom-in-95">
              <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <h3 className="text-xs font-black uppercase italic text-orange-800">Atenção: Validade Restrita</h3>
                 <p className="text-[10px] text-orange-700 font-medium leading-relaxed uppercase">
                    Este ingresso é válido <strong>exclusivamente para a ocorrência selecionada</strong> ({new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR')}). Não poderá ser utilizado em outras datas deste evento recorrente.
                 </p>
              </div>
           </div>

           <BilheteriaPublic 
             event={eventProxy} 
             globalFees={globalFees} 
             promotions={null} 
             orgSettings={null} 
           />
        </section>
      </main>
      <Footer />
    </div>
  );
}