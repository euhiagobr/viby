
"use client"

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, Clock, Share2, ArrowLeft, RefreshCw, AlertTriangle, XCircle, Users } from 'lucide-react';
import Link from 'next/link';
import Footer from '@/components/layout/Footer';
import { BilheteriaPublic } from '@/components/events/Bilheteria/BilheteriaPublic';
import { cn } from '@/lib/utils';

export default function PublicOccurrencePage() {
  const params = useParams();
  const id = params.id as string;
  const db = useFirestore();
  const router = useRouter();

  const occRef = React.useMemo(() => (db ? doc(db, 'recurring_occurrences', id) : null), [db, id]);
  const { data: occ, loading: occLoading } = useDoc<any>(occRef);

  // Busca o pai na coleção 'events' para herdar as configurações de venda e divulgação
  const seriesRef = React.useMemo(() => (db && occ?.parentId) ? doc(db, 'events', occ.parentId) : null, [db, occ?.parentId]);
  const { data: series } = useDoc<any>(seriesRef);

  const feesRef = React.useMemo(() => db ? doc(db, 'settings', 'fees') : null, [db]);
  const { data: globalFees } = useDoc<any>(feesRef);

  if (occLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-secondary" /></div>;
  
  if (!occ) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-6">
      <XCircle className="w-16 h-16 text-destructive opacity-20" />
      <h1 className="text-2xl font-bold uppercase italic text-primary">Sessão não localizada</h1>
      <Button asChild className="rounded-full"><Link href="/">Voltar ao Início</Link></Button>
    </div>
  );

  const isCuradoria = series?.curationType === 'curadoria';
  const isSoldOut = !isCuradoria && occ.capacidadeMaxima > 0 && (occ.ingressosVendidos || 0) >= occ.capacidadeMaxima;

  // Injetar dados da ocorrência nos dados do evento para os componentes de bilheteria e interesse
  const eventProxy = {
    ...series,
    id: occ.parentId,
    occurrenceId: occ.id,
    organizationId: series?.organizationId || occ.organizationId,
    organizer: series?.organizer || { name: occ.organizerName, id: occ.organizationId },
    title: `${series?.name || occ.name} - ${new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR')}`,
    date: occ.date,
    isRecurring: true,
    isSoldOut: isSoldOut,
    type: series?.type || 'divulgacao',
    disclosurePrices: series?.disclosurePrices || [],
    externalUrl: series?.externalUrl || "",
    curationType: series?.curationType
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl space-y-12">
        <div className="flex justify-between items-center px-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="rounded-full bg-white shadow-sm border-none"><Share2 className="w-4 h-4" /></Button>
          </div>
        </div>

        <section className="space-y-6">
          <Card className="border-none shadow-xl rounded-[3rem] overflow-hidden bg-white w-full">
            <div className="h-48 bg-primary relative flex items-center justify-center text-white">
              <RefreshCw className="w-32 h-32 opacity-10 absolute animate-spin-slow" />
              <div className="text-center space-y-2 px-8 relative z-10">
                <Badge className={cn("text-white font-black uppercase text-[9px] px-4 h-6 border-none", isSoldOut ? "bg-orange-500" : "bg-secondary")}>
                  {isSoldOut ? "Lotação Máxima Atingida" : isCuradoria ? "Sessão de Curadoria" : "Sessão Disponível"}
                </Badge>
                <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter leading-none">{series?.name || occ.name}</h1>
              </div>
            </div>
            <CardContent className="p-10">
              <div className={cn(
                "grid grid-cols-1 gap-8",
                isCuradoria ? "md:grid-cols-2" : "md:grid-cols-3"
              )}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-muted rounded-2xl text-secondary"><Calendar className="w-6 h-6" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase opacity-40">Data Selecionada</p>
                    <p className="font-bold text-sm leading-none mt-1">{new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-muted rounded-2xl text-secondary"><Clock className="w-6 h-6" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase opacity-40">Horário</p>
                    <p className="font-bold text-sm leading-none mt-1">{occ.startTime} às {occ.endTime}</p>
                  </div>
                </div>
                {!isCuradoria && (
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-2xl text-secondary"><Users className="w-6 h-6" /></div>
                    <div>
                      <p className="text-[10px] font-black uppercase opacity-40">Disponibilidade</p>
                      <p className={cn("font-bold text-sm leading-none mt-1", isSoldOut ? "text-orange-500" : "text-green-600")}>
                        {isSoldOut ? "Esgotado" : `${occ.capacidadeMaxima - (occ.ingressosVendidos || 0)} vagas`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-8">
           {!isCuradoria && (
             <div className="p-6 bg-orange-50 rounded-[2rem] border-2 border-dashed border-orange-200 flex items-start gap-4 animate-in zoom-in-95">
                <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                   <h3 className="text-xs font-black uppercase italic text-orange-800">Atenção: Validade Restrita</h3>
                   <p className="text-[10px] text-orange-700 font-medium leading-relaxed uppercase">
                      Este ingresso ou confirmação é válido <strong>exclusivamente para a ocorrência selecionada</strong>. Não poderá ser utilizado em outras datas deste evento recorrente.
                   </p>
                </div>
             </div>
           )}

           {isSoldOut ? (
             <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-16 text-center space-y-6">
                <div className="w-20 h-20 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto">
                   <Users className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                   <h2 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Sessão Lotada</h2>
                   <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">A capacidade máxima para esta data foi atingida.</p>
                </div>
                <Button variant="outline" asChild className="rounded-xl h-12 px-8 font-black uppercase italic text-[10px] border-secondary text-secondary">
                   <Link href={`/${series?.organizer?.username || 'evento'}/${series?.slug || series?.id}`}>Ver outras datas disponíveis</Link>
                </Button>
             </Card>
           ) : (
             <BilheteriaPublic 
               event={eventProxy} 
               globalFees={globalFees} 
               promotions={null} 
               orgSettings={null} 
             />
           )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
