
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { 
  doc, 
  collection, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  serverTimestamp, 
  writeBatch, 
  getDocs,
  deleteDoc,
  addDoc
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
  Map as MapIcon,
  ShieldCheck,
  History,
  AlertTriangle,
  Edit2,
  Trash2,
  Mail,
  QrCode,
  DollarSign,
  TrendingUp,
  Inbox,
  Filter,
  Layers,
  ArrowRight,
  UserCheck,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

export default function AdminEventTicketingDetails() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const db = useFirestore();

  const eventRef = React.useMemo(() => db ? doc(db, "events", eventId) : null, [db, eventId]);
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef);

  const regsQuery = useMemoFirebase(() => {
    if (!db) return null;
    // Removido orderBy para evitar necessidade de índice composto
    return query(collection(db, "registrations"), where("eventId", "==", eventId));
  }, [db, eventId]);

  const { data: registrations, loading: regsLoading } = useCollection<any>(regsQuery);

  const [activeTab, setActiveTab] = React.useState("tickets");
  const [search, setSearch] = React.useState("");

  const sortedRegistrations = React.useMemo(() => {
    if (!registrations) return [];
    return [...registrations].sort((a, b) => {
      const timeA = a.timestamp?.seconds || a.createdAt?.seconds || 0;
      const timeB = b.timestamp?.seconds || b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  }, [registrations]);

  const stats = React.useMemo(() => {
    if (!registrations) return { sold: 0, checkedIn: 0, revenue: 0, cancelled: 0 };
    return registrations.reduce((acc: any, r: any) => {
      if (r.status === 'Excluído' || r.status === 'Cancelado') {
        acc.cancelled++;
        return acc;
      }
      if (['Pago', 'Disponível'].includes(r.paymentStatus)) {
        acc.sold++;
        acc.revenue += (r.price || r.ticketBasePrice || 0);
        if (r.checkedIn) acc.checkedIn++;
      }
      return acc;
    }, { sold: 0, checkedIn: 0, revenue: 0, cancelled: 0 });
  }, [registrations]);

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-secondary" /></div>;
  if (!event) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
           <Button variant="ghost" size="icon" asChild><Link href="/admin/ingressos"><ArrowLeft className="w-5 h-5" /></Link></Button>
           <div>
              <h1 className="text-2xl font-black italic uppercase tracking-tighter text-primary truncate max-w-md">{event.title}</h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-2">
                 <Calendar className="w-3 h-3 text-secondary" /> {event.date?.toDate ? event.date.toDate().toLocaleDateString('pt-BR') : event.date}
                 <span className="opacity-20">|</span>
                 <MapPin className="w-3 h-3 text-secondary" /> {event.city}
              </p>
           </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="rounded-xl h-11 px-6 font-bold uppercase text-[10px] gap-2">
              <Download className="w-4 h-4" /> Exportar Dados
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <KPICard title="Vendas Líquidas" value={stats.sold} icon={Ticket} color="blue" />
         <KPICard title="Presentes" value={stats.checkedIn} icon={UserCheck} color="green" />
         <KPICard title="Cancelamentos" value={stats.cancelled} icon={XCircle} color="red" />
         <KPICard title="Receita Bruta" value={formatCurrency(stats.revenue)} icon={DollarSign} color="secondary" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12 flex-wrap h-auto">
           <TabsTrigger value="tickets" className="rounded-lg px-6 font-bold gap-2"><Ticket className="w-4 h-4" /> Ingressos</TabsTrigger>
           <TabsTrigger value="participants" className="rounded-lg px-6 font-bold gap-2"><Users className="w-4 h-4" /> CRM Público</TabsTrigger>
           <TabsTrigger value="checkin" className="rounded-lg px-6 font-bold gap-2"><CheckCircle2 className="w-4 h-4" /> Check-in</TabsTrigger>
           <TabsTrigger value="finance" className="rounded-lg px-6 font-bold gap-2"><DollarSign className="w-4 h-4" /> Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="animate-in fade-in duration-300">
           <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <CardHeader className="p-8 border-b">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                       <CardTitle className="text-xl">Base de Ingressos</CardTitle>
                       <CardDescription>Gerenciamento individual de cada venda e reserva.</CardDescription>
                    </div>
                    <div className="relative w-full md:w-80">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                       <Input placeholder="Código, Nome ou Email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-11 rounded-xl" />
                    </div>
                 </div>
              </CardHeader>
              <CardContent className="p-0">
                 {regsLoading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div> : (
                   <Table>
                      <TableHeader className="bg-muted/30">
                         <TableRow>
                            <TableHead className="p-6 font-black uppercase text-[10px] tracking-widest">Ingresso / QR</TableHead>
                            <TableHead className="font-black uppercase text-[10px] tracking-widest">Participante</TableHead>
                            <TableHead className="font-black uppercase text-[10px] tracking-widest">Tipo / Lote</TableHead>
                            <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Status</TableHead>
                            <TableHead className="text-right font-black uppercase text-[10px] tracking-widest p-6">Ações</TableHead>
                         </TableRow>
                      </TableHeader>
                      <TableBody>
                         {sortedRegistrations.filter(r => !search || r.userName?.toLowerCase().includes(search.toLowerCase()) || r.ticketCode?.includes(search.toUpperCase())).map((reg: any) => (
                           <TableRow key={reg.id} className="hover:bg-muted/5 transition-colors">
                              <TableCell className="p-6">
                                 <div className="flex items-center gap-3">
                                    <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><QrCode className="w-5 h-5" /></div>
                                    <div className="flex flex-col">
                                       <span className="font-mono font-black text-xs text-primary">{reg.ticketCode}</span>
                                       <span className="text-[8px] font-bold text-muted-foreground uppercase">{reg.timestamp?.toDate ? reg.timestamp.toDate().toLocaleDateString('pt-BR') : 'Sem data'}</span>
                                    </div>
                                 </div>
                              </TableCell>
                              <TableCell>
                                 <div className="flex flex-col">
                                    <span className="font-bold text-sm text-primary">{reg.attendeeName || reg.userName || "Pendente"}</span>
                                    <span className="text-[10px] text-muted-foreground">{reg.userEmail}</span>
                                 </div>
                              </TableCell>
                              <TableCell>
                                 <div className="flex flex-col">
                                    <span className="text-xs font-bold">{reg.ticketTypeName || 'Acesso'}</span>
                                    <span className="text-[9px] font-black uppercase text-secondary">{reg.batchName || 'Único'}</span>
                                 </div>
                              </TableCell>
                              <TableCell className="text-center">
                                 <Badge className={cn(
                                   "uppercase text-[8px] font-black h-5 px-2", 
                                   reg.checkedIn ? "bg-green-500" : 
                                   reg.paymentStatus === 'Pago' ? "bg-blue-500" : 
                                   reg.paymentStatus === 'Pendente' ? "bg-orange-500" : "bg-muted"
                                 )}>
                                   {reg.checkedIn ? 'Utilizado' : (reg.paymentStatus || 'Pendente')}
                                 </Badge>
                              </TableCell>
                              <TableCell className="p-6 text-right">
                                 <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl w-56">
                                       <DropdownMenuItem className="gap-2 cursor-pointer"><Mail className="w-4 h-4" /> Reenviar Voucher</DropdownMenuItem>
                                       <DropdownMenuItem className="gap-2 cursor-pointer"><Edit2 className="w-4 h-4" /> Alterar Dados</DropdownMenuItem>
                                       <DropdownMenuSeparator />
                                       <DropdownMenuItem className="gap-2 text-destructive cursor-pointer focus:text-destructive"><XCircle className="w-4 h-4" /> Cancelar Ingresso</DropdownMenuItem>
                                    </DropdownMenuContent>
                                 </DropdownMenu>
                              </TableCell>
                           </TableRow>
                         ))}
                         {sortedRegistrations.length === 0 && (
                           <TableRow>
                             <TableCell colSpan={5} className="py-20 text-center text-muted-foreground italic">Nenhum ingresso localizado para este evento.</TableCell>
                           </TableRow>
                         )}
                      </TableBody>
                   </Table>
                 )}
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="participants" className="animate-in fade-in duration-300">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white">
              <CardHeader><CardTitle>Gestão de Público</CardTitle></CardHeader>
              <CardContent className="py-20 text-center text-muted-foreground italic">CRM de participantes em sincronização com o banco de dados.</CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="checkin" className="animate-in fade-in duration-300">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-2 border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                 <CardHeader className="bg-green-50 border-b border-green-100">
                    <CardTitle className="text-green-800 text-lg flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Painel de Portaria</CardTitle>
                 </CardHeader>
                 <CardContent className="h-96 flex flex-col items-center justify-center space-y-4">
                    <QrCode className="w-16 h-16 text-green-600 opacity-20" />
                    <p className="text-sm font-bold text-muted-foreground uppercase">Scanner operacional ativo</p>
                    <Button asChild variant="secondary" className="rounded-xl"><Link href="/admin/scanner">Abrir Scanner Admin</Link></Button>
                 </CardContent>
              </Card>
              <Card className="border-none shadow-sm rounded-[2rem] bg-white">
                 <CardHeader><CardTitle className="text-lg">Resumo de Entrada</CardTitle></CardHeader>
                 <CardContent className="space-y-6">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black uppercase opacity-40">Taxa de Presença</p>
                       <p className="text-3xl font-black">{stats.sold > 0 ? Math.round((stats.checkedIn / stats.sold) * 100) : 0}%</p>
                    </div>
                    <Separator className="border-dashed" />
                    <div className="space-y-4">
                       <div className="flex justify-between items-center"><span className="text-xs font-bold opacity-60 uppercase">Vendas Pagas</span><span className="font-black">{stats.sold}</span></div>
                       <div className="flex justify-between items-center"><span className="text-xs font-bold text-green-600 uppercase">Confirmados</span><span className="font-black text-green-600">{stats.checkedIn}</span></div>
                       <div className="flex justify-between items-center"><span className="text-xs font-bold text-orange-500 uppercase">Aguardando</span><span className="font-black text-orange-500">{stats.sold - stats.checkedIn}</span></div>
                    </div>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>

        <TabsContent value="finance" className="animate-in fade-in duration-300">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="border-none shadow-sm rounded-[2rem] bg-white">
                 <CardHeader><CardTitle className="text-lg font-black uppercase italic tracking-tighter">Relatório de Receita</CardTitle></CardHeader>
                 <CardContent className="space-y-6">
                    <div className="space-y-4">
                       <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-xs font-bold uppercase opacity-60">Receita Bruta (Vendas)</span><span className="font-black text-primary">{formatCurrency(stats.revenue)}</span></div>
                       <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-xs font-bold uppercase text-red-500">Taxas da Plataforma</span><span className="font-black text-red-500">-{formatCurrency(stats.revenue * 0.15)}</span></div>
                       <div className="flex justify-between items-center py-2"><span className="text-sm font-black uppercase text-green-600">Líquido de Repasse</span><span className="text-xl font-black text-green-600">{formatCurrency(stats.revenue * 0.85)}</span></div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-2xl flex gap-3"><Info className="w-5 h-5 text-secondary shrink-0" /><p className="text-[10px] font-medium leading-relaxed opacity-60 uppercase">Este é um resumo operacional. Os valores definitivos para repasse devem ser consultados no módulo Financeiro/ERP.</p></div>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPICard({ title, value, icon: Icon, color }: any) {
  const colors: any = { blue: "text-blue-500 bg-blue-50", green: "text-green-600 bg-green-50", orange: "text-orange-500 bg-orange-50", red: "text-red-500 bg-red-50", secondary: "text-secondary bg-secondary/5" };
  return (
    <Card className="border-none shadow-sm rounded-3xl bg-white group">
       <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className={cn("p-2.5 rounded-2xl transition-transform group-hover:scale-110", colors[color])}><Icon className="w-5 h-5" /></div>
          </div>
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">{title}</p>
          <p className="text-2xl font-black text-primary">{value}</p>
       </CardContent>
    </Card>
  );
}
