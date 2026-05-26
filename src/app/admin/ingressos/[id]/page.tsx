'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from '@/firebase';
import { 
  doc, 
  collection, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  serverTimestamp, 
  runTransaction, 
  getDocs,
  deleteDoc,
  addDoc,
  increment,
  limit
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Ticket, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Download, 
  MoreHorizontal, 
  ArrowLeft,
  Loader2,
  Clock,
  MapPin,
  ShieldCheck,
  History,
  AlertTriangle,
  Mail,
  QrCode,
  DollarSign,
  RotateCcw,
  ExternalLink,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, calculateRefundAmount, calculateRetainedGatewayFee } from '@/lib/financial-utils';
import { cn } from "@/lib/utils";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { processTicketRefund } from '@/app/actions/finance';

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
  const [isProcessing, setIsProcessing] = React.useState(false);

  const stats = React.useMemo(() => {
    if (!registrations) return { sold: 0, checkedIn: 0, revenue: 0, cancelled: 0 };
    return registrations.reduce((acc: any, r: any) => {
      if (r.status === 'cancelled' || r.paymentStatus === 'refunded_wallet') {
        acc.cancelled++;
        return acc;
      }
      if (['Pago', 'Disponível'].includes(r.paymentStatus)) {
        acc.sold++;
        acc.revenue += (r.price || 0);
        if (r.checkedIn) acc.checkedIn++;
      }
      return acc;
    }, { sold: 0, checkedIn: 0, revenue: 0, cancelled: 0 });
  }, [registrations]);

  const handleRefund = async () => {
    if (!db || !ticketToRefund || !user) return;
    setIsProcessing(true);
    try {
      const result = await processTicketRefund(ticketToRefund.id, user.uid, "Estorno administrativo forçado via painel global.");
      if (result.success) {
        toast({ title: "Estorno Concluído!", description: `Valor de R$ ${result.refundAmount?.toFixed(2)} creditado na carteira.` });
        setTicketToRefund(null);
      } else {
        toast({ variant: "destructive", title: "Erro no estorno", description: result.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Falha na transação" });
    } finally {
      setIsProcessing(false);
    }
  }

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
         <KPICard title="Estornos/Canc." value={stats.cancelled} icon={RotateCcw} color="red" />
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
                      <TableHead className="font-black uppercase text-[10px]">Ingresso</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-right">Pago (Stripe)</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-center">Status</TableHead>
                      <TableHead className="text-right font-black uppercase text-[10px] p-8">Ações</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {registrations?.filter(r => !search || r.userName?.toLowerCase().includes(search.toLowerCase()) || r.ticketCode?.includes(search.toUpperCase())).map((reg: any) => {
                     const isCancelled = reg.status === 'cancelled' || reg.paymentStatus === 'refunded_wallet';
                     return (
                       <TableRow key={reg.id} className={cn("hover:bg-muted/10", isCancelled && "opacity-50 grayscale bg-red-50/5")}>
                          <TableCell className="p-8"><div className="flex flex-col"><span className="font-bold text-sm">{reg.userName}</span><span className="text-[9px] font-mono text-secondary uppercase">{reg.ticketCode}</span></div></TableCell>
                          <TableCell><div className="flex flex-col"><span className="text-xs font-bold">{reg.ticketTypeName}</span><span className="text-[10px] text-muted-foreground uppercase">{reg.batchName}</span></div></TableCell>
                          <TableCell className="text-right font-black text-sm">{formatCurrency(reg.price || 0)}</TableCell>
                          <TableCell className="text-center">
                             <Badge className={cn("uppercase text-[8px] font-black h-5 px-2", isCancelled ? "bg-red-500 text-white" : reg.checkedIn ? "bg-green-500 text-white" : "bg-blue-500 text-white")}>
                               {isCancelled ? 'Estornado' : reg.checkedIn ? 'Validado' : 'Disponível'}
                             </Badge>
                          </TableCell>
                          <TableCell className="p-8 text-right">
                             {!isCancelled && !reg.checkedIn && (
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

      <AlertDialog open={!!ticketToRefund} onOpenChange={(o) => !o && setTicketToRefund(null)}>
        <AlertDialogContent className="rounded-[2.5rem]">
          <AlertDialogHeader>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2 text-red-600"><AlertTriangle className="w-6 h-6" /></div>
            <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter text-center">Confirmar Estorno Administrativo?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              O ingresso será invalidado e <strong>{formatCurrency(calculateRefundAmount(ticketToRefund?.price || 0))}</strong> voltará para a carteira do usuário. 
              A taxa operacional de gateway será retida pelo sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRefund} disabled={isProcessing} className="bg-destructive text-white rounded-xl font-black uppercase text-[10px] px-8">Confirmar e Devolver Saldo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KPICard({ title, value, icon: Icon, color }: any) {
  const colors: any = { blue: "text-blue-500 bg-blue-50", green: "text-green-600 bg-green-50", red: "text-red-500 bg-red-50", secondary: "text-secondary bg-secondary/5" };
  return (
    <Card className="border-none shadow-sm rounded-3xl bg-white"><CardContent className="p-6"><div className="flex items-center justify-between mb-4"><div className={cn("p-2.5 rounded-2xl", colors[color])}><Icon className="w-5 h-5" /></div></div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">{title}</p><p className="text-2xl font-black text-primary">{value}</p></CardContent></Card>
  );
}
