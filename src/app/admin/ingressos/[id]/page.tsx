
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from '@/firebase';
import { 
  doc, 
  collection, 
  query, 
  where, 
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Ticket, 
  ShieldCheck, 
  Search, 
  ArrowLeft,
  Loader2,
  DollarSign,
  RotateCcw,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/financial-utils';
import { cn } from "@/lib/utils";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { RefundDialog } from '@/components/tickets/RefundDialog';

export default function AdminEventTicketingDetails() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);

  const eventRef = React.useMemo(() => db ? doc(db, "events", eventId) : null, [db, eventId]);
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef);

  const regsQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null;
    return query(collection(db, "registrations"), where("eventId", "==", eventId));
  }, [db, eventId]);

  const { data: registrations, loading: regsLoading } = useCollection<any>(regsQuery);

  const [search, setSearch] = React.useState("");
  const [ticketToRefund, setTicketToRefund] = React.useState<any>(null);

  const stats = React.useMemo(() => {
    if (!registrations) return { sold: 0, checkedIn: 0, revenue: 0, refunded: 0 };
    return registrations.reduce((acc: any, r: any) => {
      if (r.status === 'refunded' || r.paymentStatus === 'Estornado') {
        acc.refunded++;
        return acc;
      }
      if (['Pago', 'Disponível'].includes(r.paymentStatus)) {
        acc.sold++;
        acc.revenue += (r.price || 0);
        if (r.checkedIn) acc.checkedIn++;
      }
      return acc;
    }, { sold: 0, checkedIn: 0, revenue: 0, refunded: 0 });
  }, [registrations]);

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
           <Button variant="ghost" size="icon" onClick={() => router.push('/admin/ingressos')} className="rounded-full"><ArrowLeft className="w-5 h-5" /></Button>
           <div>
              <h1 className="text-2xl font-black italic uppercase tracking-tighter text-primary truncate max-w-md">{event?.title}</h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-2">#{eventId}</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <KPICard title="Ingressos Ativos" value={stats.sold} icon={Ticket} color="blue" />
         <KPICard title="Check-ins" value={stats.checkedIn} icon={ShieldCheck} color="green" />
         <KPICard title="Estornados" value={stats.refunded} icon={RotateCcw} color="red" />
         <KPICard title="Arrecadação Bruta" value={formatCurrency(stats.revenue)} icon={DollarSign} color="secondary" />
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="p-8 border-b">
           <div className="flex justify-between items-center">
              <div><CardTitle className="text-xl">Auditoria de Ingressos</CardTitle><CardDescription>Monitoramento global de vendas deste evento.</CardDescription></div>
              <div className="relative w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Nome ou Protocolo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl" /></div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
           {regsLoading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div> : (
             <Table>
                <TableHeader className="bg-muted/30">
                   <TableRow>
                      <TableHead className="p-8 font-black uppercase text-[10px]">Participante</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Ingresso / Ocorrência</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-right">Pago (Stripe)</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-center">Status</TableHead>
                      <TableHead className="text-right font-black uppercase text-[10px] p-8">Ações</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {registrations?.filter(r => !search || r.userName?.toLowerCase().includes(search.toLowerCase()) || r.ticketCode?.includes(search.toUpperCase())).map((reg: any) => {
                     const isRefunded = reg.status === 'refunded' || reg.paymentStatus === 'Estornado';
                     return (
                       <TableRow key={reg.id} className={cn("hover:bg-muted/10", isRefunded && "opacity-50 grayscale bg-red-50/5")}>
                          <TableCell className="p-8"><div className="flex flex-col"><span className="font-bold text-sm">{reg.userName}</span><span className="text-[9px] font-mono text-secondary uppercase">{reg.ticketCode}</span></div></TableCell>
                          <TableCell>
                             <div className="flex flex-col">
                                <span className="text-xs font-bold">{reg.ticketTypeName}</span>
                                {reg.occurrenceId ? (
                                   <div className="flex items-center gap-1.5 text-[9px] font-black text-secondary uppercase mt-1">
                                      <Calendar className="w-2.5 h-2.5" />
                                      {typeof reg.eventDate === 'string' ? new Date(reg.eventDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Recorrente'}
                                   </div>
                                ) : <span className="text-[10px] text-muted-foreground uppercase">{reg.batchName}</span>}
                             </div>
                          </TableCell>
                          <TableCell className="text-right font-black text-sm">{formatCurrency(reg.price || 0)}</TableCell>
                          <TableCell className="text-center">
                             <Badge className={cn("uppercase text-[8px] font-black h-5 px-2", isRefunded ? "bg-red-500 text-white" : reg.checkedIn ? "bg-green-500 text-white" : "bg-blue-500 text-white")}>
                               {isRefunded ? 'Estornado' : reg.checkedIn ? 'Validado' : 'Disponível'}
                             </Badge>
                          </TableCell>
                          <TableCell className="p-8 text-right">
                             {!isRefunded && !reg.checkedIn && (
                               <Button variant="ghost" size="icon" onClick={() => setTicketToRefund(reg)} className="text-destructive"><RotateCcw className="w-4 h-4" /></Button>
                             )}
                          </TableCell>
                       </TableRow>
                     );
                   })}
                </TableBody>
             </Table>
           )}
        </CardContent>
      </Card>

      <RefundDialog 
        registration={ticketToRefund}
        isOpen={!!ticketToRefund}
        onOpenChange={(open) => !open && setTicketToRefund(null)}
        userRole="admin"
        executorUid={user?.uid || ''}
      />
    </div>
  );
}

function KPICard({ title, value, icon: Icon, color }: any) {
  const colors: any = { blue: "text-blue-500 bg-blue-50", green: "text-green-600 bg-green-50", red: "text-red-500 bg-red-50", secondary: "text-secondary bg-secondary/5" };
  return (
    <Card className="border-none shadow-sm rounded-3xl bg-white"><CardContent className="p-6"><div className="flex items-center justify-between mb-4"><div className={cn("p-2.5 rounded-2xl", colors[color])}><Icon className="w-5 h-5" /></div></div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">{title}</p><p className="text-2xl font-black text-primary">{value}</p></CardContent></Card>
  );
}
