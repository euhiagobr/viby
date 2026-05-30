'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Loader2, Calendar, Clock, Edit, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { RecurringOccurrenceList } from '@/components/recurring-events/RecurringOccurrenceList';
import { toast } from '@/hooks/use-toast';

export default function RecurringEventDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const db = useFirestore();
  const router = useRouter();

  const seriesRef = React.useMemo(() => (db ? doc(db, 'recurring_events', id) : null), [db, id]);
  const { data: series, loading: seriesLoading } = useDoc<any>(seriesRef);

  const occQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'recurring_occurrences'), where('parentId', '==', id), orderBy('date', 'asc'));
  }, [db, id]);

  const { data: occurrences, loading: occLoading } = useCollection<any>(occQuery);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);

  const handleCancelOccurrence = async (occId: string) => {
    if (!db) return;
    if (!confirm("Deseja cancelar esta data específica?")) return;

    setActionLoadingId(occId);
    try {
      await updateDoc(doc(db, 'recurring_occurrences', occId), {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });
      toast({ title: "Ocorrência cancelada" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao cancelar" });
    } finally {
      setActionLoadingId(null);
    }
  };

  if (seriesLoading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;
  if (!series) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/admin/eventos-recorrentes"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary truncate max-w-md">{series.name}</h1>
            <div className="flex items-center gap-3 mt-1">
               <Badge className="bg-secondary text-white font-black uppercase text-[9px] px-3">Recorrência: {series.frequency}</Badge>
               <span className="text-[10px] font-bold text-muted-foreground uppercase">#{id.slice(-6)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" asChild className="rounded-full h-11 px-6 font-bold uppercase text-[10px] border-secondary text-secondary">
              <Link href={`/admin/eventos-recorrentes/${id}/editar`}><Edit className="w-4 h-4 mr-2" /> Editar Série</Link>
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Agenda Gerada</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black">{occurrences?.length || 0} datas</div></CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Ativas</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black text-green-600">{occurrences?.filter(o => o.status === 'active').length || 0}</div></CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Canceladas</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black text-red-500">{occurrences?.filter(o => o.status === 'cancelled').length || 0}</div></CardContent>
         </Card>
      </div>

      <div className="space-y-6">
         <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-secondary" /> Ocorrências na Agenda
         </h2>
         {occLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="animate-spin" /></div>
         ) : (
            <RecurringOccurrenceList 
              occurrences={occurrences || []} 
              onCancel={handleCancelOccurrence} 
              loadingId={actionLoadingId}
            />
         )}
      </div>
    </div>
  );
}
