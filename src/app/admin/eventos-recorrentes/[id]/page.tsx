'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, updateDoc, serverTimestamp, orderBy, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  RefreshCw, 
  Loader2, 
  Calendar, 
  Clock, 
  Edit, 
  BarChart3, 
  Users, 
  DollarSign,
  Inbox,
  ArrowRight,
  XCircle,
  Eye,
  TrendingUp,
  Target
} from 'lucide-react';
import Link from 'next/link';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/financial-utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Progress } from "@/components/ui/progress";

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

  const { data: rawOccurrences, loading: occLoading } = useCollection<any>(occQuery);
  const [occWithStats, setOccWithStats] = React.useState<any[]>([]);
  const [statsLoading, setStatsLoading] = React.useState(false);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!rawOccurrences || !db) return;

    const fetchStats = async () => {
      setStatsLoading(true);
      const results = await Promise.all(rawOccurrences.map(async (occ) => {
        const q = query(collection(db, "registrations"), where("occurrenceId", "==", occ.id));
        const snap = await getDocs(q);
        
        let revenue = 0;
        let checkins = 0;
        let sold = 0;

        snap.forEach(d => {
          const r = d.data();
          if (r.paymentStatus === 'Pago' || r.paymentStatus === 'Disponível') {
            sold++;
            revenue += (r.price || 0);
            if (r.checkedIn) checkins++;
          }
        });

        return { ...occ, sold, revenue, checkins };
      }));
      setOccWithStats(results);
      setStatsLoading(false);
    };

    fetchStats();
  }, [rawOccurrences, db]);

  const handleCancelOccurrence = async (occId: string) => {
    if (!db) return;
    if (!confirm("Deseja cancelar esta data específica?")) return;
    setActionLoadingId(occId);
    try {
      await updateDoc(doc(db, 'recurring_occurrences', occId), { status: 'cancelled', updatedAt: serverTimestamp() });
      toast({ title: "Ocorrência cancelada" });
    } catch (e) { toast({ variant: "destructive", title: "Erro ao cancelar" }); }
    finally { setActionLoadingId(null); }
  };

  const seriesStats = React.useMemo(() => {
     return occWithStats.reduce((acc, o) => {
        acc.sold += o.sold;
        acc.revenue += o.revenue;
        acc.checkins += o.checkins;
        acc.capacity += (o.capacidadeMaxima || 0);
        return acc;
     }, { sold: 0, revenue: 0, checkins: 0, capacity: 0 });
  }, [occWithStats]);

  if (seriesLoading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="bg-white shadow-sm"><Link href="/admin/eventos-recorrentes"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">{series?.name}</h1>
            <Badge className="bg-secondary text-white font-black uppercase text-[9px] px-3 mt-1">Série Ativa: {series?.frequency}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" asChild className="rounded-xl h-11 px-6 font-bold uppercase text-[10px] border-secondary text-secondary">
              <Link href={`/admin/eventos-recorrentes/${id}/editar`}><Edit className="w-4 h-4 mr-2" /> Editar Série</Link>
           </Button>
           <Button variant="outline" asChild className="rounded-xl h-11 px-6 font-black uppercase text-[10px] bg-white border-primary">
              <Link href={`/recorrente/serie/${id}`} target="_blank">Ver Página Pública <ArrowRight className="w-4 h-4 ml-2" /></Link>
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-40">Ingressos Vendidos</CardTitle></CardHeader>
            <CardContent>
               <div className="text-3xl font-black">{seriesStats.sold}</div>
               <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">De {seriesStats.capacity} vagas totais</p>
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-40">Receita Bruta</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black text-green-600">{formatCurrency(seriesStats.revenue)}</div></CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-40">Total Check-ins</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black text-secondary">{seriesStats.checkins}</div></CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-40">Ocupação Média</CardTitle></CardHeader>
            <CardContent>
               <div className="text-3xl font-black text-primary">{seriesStats.capacity > 0 ? Math.round((seriesStats.sold / seriesStats.capacity) * 100) : 0}%</div>
            </CardContent>
         </Card>
      </div>

      <div className="space-y-6">
         <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary flex items-center gap-2">
               <BarChart3 className="w-5 h-5 text-secondary" /> Performance por Ocorrência
            </h2>
            {statsLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
         </div>

         <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
            <Table>
               <TableHeader className="bg-muted/30">
                  <TableRow>
                     <TableHead className="font-black uppercase text-[9px] p-6">Data</TableHead>
                     <TableHead className="font-black uppercase text-[9px] text-center">Status</TableHead>
                     <TableHead className="font-black uppercase text-[9px] text-center">Vendas / Cap.</TableHead>
                     <TableHead className="font-black uppercase text-[9px] text-center">Ocupação</TableHead>
                     <TableHead className="font-black uppercase text-[9px] text-right">Faturamento</TableHead>
                     <TableHead className="text-right font-black uppercase text-[9px] p-6">Ações</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {occWithStats.map((occ) => {
                    const occupancy = occ.capacidadeMaxima > 0 ? Math.round((occ.sold / occ.capacidadeMaxima) * 100) : 0;
                    return (
                      <TableRow key={occ.id} className={cn("hover:bg-muted/5 transition-colors", occ.status === 'cancelled' && "opacity-50 grayscale")}>
                         <TableCell className="p-6">
                            <div className="flex items-center gap-3">
                               <Calendar className="w-4 h-4 text-secondary" />
                               <span className="font-bold text-sm">{new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                            </div>
                         </TableCell>
                         <TableCell className="text-center">
                            <Badge className={cn("text-[8px] font-black uppercase", occ.status === 'active' ? (occupancy >= 100 ? "bg-orange-500" : "bg-green-500") : "bg-red-500")}>
                               {occ.status === 'active' ? (occupancy >= 100 ? "Lotado" : "Confirmada") : "Cancelada"}
                            </Badge>
                         </TableCell>
                         <TableCell className="text-center">
                            <div className="flex flex-col">
                               <span className="font-bold text-xs">{occ.sold} <span className="opacity-40">/ {occ.capacidadeMaxima}</span></span>
                            </div>
                         </TableCell>
                         <TableCell className="text-center">
                            <div className="flex flex-col gap-1 px-4 min-w-[100px]">
                               <Progress value={occupancy} className="h-1.5" />
                               <span className="text-[9px] font-black">{occupancy}%</span>
                            </div>
                         </TableCell>
                         <TableCell className="text-right font-black text-xs text-primary">{formatCurrency(occ.revenue)}</TableCell>
                         <TableCell className="p-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                               <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-secondary"><Link href={`/recorrente/${occ.id}`} target="_blank"><Eye className="w-4 h-4" /></Link></Button>
                               {occ.status === 'active' && (
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleCancelOccurrence(occ.id)} disabled={actionLoadingId === occ.id}><XCircle className="w-4 h-4" /></Button>
                               )}
                            </div>
                         </TableCell>
                      </TableRow>
                    );
                  })}
               </TableBody>
            </Table>
            {occWithStats.length === 0 && !statsLoading && (
              <div className="p-20 text-center text-muted-foreground italic"><Inbox className="w-12 h-12 mx-auto opacity-10 mb-4" />Nenhuma ocorrência gerada.</div>
            )}
         </div>
      </div>
    </div>
  );
}
