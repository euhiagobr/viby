'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, Clock, MapPin, Share2, Ticket, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PublicOccurrencePage() {
  const params = useParams();
  const id = params.id as string;
  const db = useFirestore();
  const router = useRouter();

  const occRef = React.useMemo(() => (db ? doc(db, 'recurring_occurrences', id) : null), [db, id]);
  const { data: occ, loading } = useDoc<any>(occRef);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-secondary" /></div>;
  if (!occ) return <div className="min-h-screen flex flex-col items-center justify-center gap-4"><h1 className="text-2xl font-bold">Ocorrência não encontrada</h1><Button asChild><Link href="/">Voltar ao Início</Link></Button></div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 animate-in zoom-in-95 duration-500">
        <div className="flex justify-between items-center px-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ArrowLeft className="w-5 h-5" /></Button>
          <Button variant="outline" size="icon" className="rounded-full"><Share2 className="w-4 h-4" /></Button>
        </div>

        <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
           <div className="h-48 bg-primary relative flex items-center justify-center text-white">
              <RefreshCw className="w-20 h-20 opacity-10 absolute" />
              <div className="text-center space-y-2 px-6">
                 <Badge className="bg-secondary text-white font-black uppercase text-[10px] px-3 h-5">Evento Recorrente</Badge>
                 <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none">{occ.name}</h1>
              </div>
           </div>
           <CardContent className="p-10 space-y-8">
              <div className="space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-2xl text-secondary"><Calendar className="w-6 h-6" /></div>
                    <div>
                       <p className="text-[10px] font-black uppercase opacity-40">Quando</p>
                       <p className="font-bold text-lg">{new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-2xl text-secondary"><Clock className="w-6 h-6" /></div>
                    <div>
                       <p className="text-[10px] font-black uppercase opacity-40">Horário</p>
                       <p className="font-bold text-lg">{occ.startTime} às {occ.endTime}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-2xl text-secondary"><MapPin className="w-6 h-6" /></div>
                    <div>
                       <p className="text-[10px] font-black uppercase opacity-40">Local</p>
                       <p className="font-bold text-lg">Confira com o organizador</p>
                    </div>
                 </div>
              </div>

              <Separator className="border-dashed" />

              <div className="space-y-4">
                 <div className="p-6 bg-muted/30 rounded-3xl border border-dashed text-center">
                    <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Status da Ocorrência</p>
                    <p className="font-black uppercase text-xl text-primary">{occ.status === 'active' ? 'Confirmado ✅' : 'Cancelado ❌'}</p>
                 </div>
                 
                 <Button disabled className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg opacity-40 cursor-not-allowed">
                    <Ticket className="w-6 h-6 mr-2" /> Bilheteria em Breve
                 </Button>
              </div>
           </CardContent>
        </Card>
        
        <p className="text-center text-[10px] font-bold text-muted-foreground uppercase opacity-40">Viby.Club • Tecnologia para Experiências</p>
      </div>
    </div>
  );
}
