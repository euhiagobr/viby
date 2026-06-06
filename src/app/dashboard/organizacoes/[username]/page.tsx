
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { 
  doc, 
  collection, 
  query, 
  where, 
  orderBy,
  limit,
  getDocs,
  Timestamp,
  startAt,
  endAt
} from "firebase/firestore"
import { 
  Loader2, 
  Eye, 
  Clock, 
  Wallet, 
  ArrowRight, 
  Megaphone,
  LayoutGrid,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Lock,
  BadgeCheck,
  Building2,
  QrCode,
  Calendar
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { formatCurrency } from '@/lib/financial-utils'
import { subDays, startOfDay, endOfDay } from 'date-fns'

const roleTranslations: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  editor: 'Editor',
  finance: 'Financeiro',
  checkin: 'Check-in'
};

export default function OrganizationDashboardPage() {
  const { currentOrg, userRole, loading: orgLoading } = useCurrentOrganization();
  const db = useFirestore();

  const isFinanceManager = ['owner', 'admin', 'finance'].includes(userRole || '');

  // Consulta de TODOS os eventos da marca para o contador de gestão
  const allEventsQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return query(
      collection(db, 'events'), 
      where('organizationId', '==', currentOrg.id)
    );
  }, [db, currentOrg?.id]);

  const { data: rawAllEvents, loading: eventsLoading } = useCollection<any>(allEventsQuery);

  const eventsSummary = React.useMemo(() => {
    if (!rawAllEvents) return { total: 0, active: 0, recent: [] };
    
    const active = rawAllEvents.filter((e: any) => e.status === 'Ativo').length;
    const sorted = [...rawAllEvents].sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    }).slice(0, 5);

    return { total: rawAllEvents.length, active, recent: sorted };
  }, [rawAllEvents]);

  // Estatísticas de QR Code
  const [qrStats, setQrStats] = React.useState({
    total: 0,
    last7Days: 0,
    last30Days: 0,
    lastScan: null as any
  });
  const [loadingQr, setLoadingQr] = React.useState(false);

  React.useEffect(() => {
    if (!db || !currentOrg?.id) return;

    const fetchQrStats = async () => {
      setLoadingQr(true);
      try {
        const now = new Date();
        const start7 = subDays(now, 7);
        const start30 = subDays(now, 30);

        const qAll = query(collection(db, "qr_scans"), where("organizationId", "==", currentOrg.id));
        const snapAll = await getDocs(qAll);
        
        const allScans = snapAll.docs.map(d => ({ ...d.data(), id: d.id }));
        
        const lastScan = [...allScans].sort((a: any, b: any) => 
          (b.scannedAt?.seconds || 0) - (a.scannedAt?.seconds || 0)
        )[0];

        const last7 = allScans.filter((s: any) => {
          const d = s.scannedAt?.toDate ? s.scannedAt.toDate() : new Date(s.scannedAt);
          return d >= start7;
        }).length;

        const last30 = allScans.filter((s: any) => {
          const d = s.scannedAt?.toDate ? s.scannedAt.toDate() : new Date(s.scannedAt);
          return d >= start30;
        }).length;

        setQrStats({
          total: allScans.length,
          last7Days: last7,
          last30Days: last30,
          lastScan: lastScan || null
        });
      } catch (e) {
        console.error("QR Stats Error:", e);
      } finally {
        setLoadingQr(false);
      }
    };

    fetchQrStats();
  }, [db, currentOrg?.id]);

  // Consulta de Vendas (Registrations) para métricas financeiras
  const salesQuery = useMemoFirebase(() => {
    if (!db || !currentOrg || !isFinanceManager) return null;
    return query(
      collection(db, "registrations"), 
      where("organizationId", "==", currentOrg.id)
    );
  }, [db, currentOrg?.id, isFinanceManager]);

  const { data: sales, loading: salesLoading } = useCollection<any>(salesQuery);

  const salesStats = React.useMemo(() => {
    if (!sales) return { today: 0, month: 0 };
    
    const now = new Date();
    const todayStart = startOfDay(now);
    const monthStart = subDays(now, 30);

    return sales.reduce((acc: any, sale: any) => {
      if (!["Pago", "Disponível"].includes(sale.paymentStatus)) return acc;
      
      const saleDate = sale.timestamp?.toDate ? sale.timestamp.toDate() : new Date(sale.timestamp);
      const netAmount = sale.producerNetAmount || 0;

      if (saleDate >= todayStart) acc.today += netAmount;
      if (saleDate >= monthStart) acc.month += netAmount;
      return acc;
    }, { today: 0, month: 0 });
  }, [sales]);

  // Consulta de Seguidores
  const followersQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return query(collection(db, 'follows'), where('followingId', '==', currentOrg.id));
  }, [db, currentOrg?.id]);

  const { data: followers } = useCollection<any>(followersQuery);

  const followerStats = React.useMemo(() => {
    if (!followers) return { total: 0, last30Days: 0, growth: 0 };
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const last30 = followers.filter((f: any) => (f.timestamp?.toDate ? f.timestamp.toDate() : new Date(f.timestamp)) > thirtyDaysAgo).length;
    const previousTotal = followers.length - last30;
    const growth = previousTotal > 0 ? (last30 / previousTotal) * 100 : (last30 > 0 ? 100 : 0);
    return { total: followers.length, last30Days: last30, growth: Math.round(growth) };
  }, [followers]);

  if (orgLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>;

  if (!currentOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-bold">Organização não encontrada</h2>
        <Button asChild variant="outline" className="rounded-full"><Link href="/dashboard/organizacoes">Ver Minhas Marcas</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <LayoutGrid className="w-8 h-8 text-secondary" />
          Dashboard da Marca
        </h1>
        <p className="text-muted-foreground font-medium">Gestão centralizada de {currentOrg.name}.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
              Eventos Totais
              <Megaphone className="w-4 h-4 text-secondary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{eventsSummary.total}</div>
            <p className="text-[9px] font-bold text-secondary uppercase mt-1">{eventsSummary.active} ativos no ar</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden relative">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
              Impacto QR Code
              <QrCode className="w-4 h-4 text-secondary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-black">{qrStats.total.toLocaleString()}</div>
            <p className="text-[9px] font-bold text-secondary uppercase">Escaneamentos totais</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-l-4 border-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
              Receita Hoje
              <Clock className="w-4 h-4 text-green-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isFinanceManager ? (
              salesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <div className="text-2xl font-black text-green-600">{formatCurrency(salesStats.today)}</div>
              )
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 p-2 rounded-lg">
                <Lock className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-tight">Restrito</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-l-4 border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
              Receita (30d)
              <TrendingUp className="w-4 h-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isFinanceManager ? (
              salesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <div className="text-2xl font-black text-primary">{formatCurrency(salesStats.month)}</div>
              )
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 p-2 rounded-lg">
                <Lock className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-tight">Restrito</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-secondary text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest flex justify-between">
              Meu Cargo
              <ShieldCheck className="w-4 h-4 text-white" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-black uppercase italic truncate">{userRole ? roleTranslations[userRole] || userRole : 'Membro'}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
             <div>
                <CardTitle className="text-lg font-bold">Eventos Recentes</CardTitle>
                <CardDescription>Últimos projetos cadastrados.</CardDescription>
             </div>
             <Button variant="ghost" size="sm" asChild className="rounded-xl font-bold uppercase text-[10px] gap-2">
               <Link href={`/dashboard/organizacoes/${currentOrg.username}/events`}>Ver Todos <ArrowRight className="w-3 h-3" /></Link>
             </Button>
          </CardHeader>
          <CardContent className="p-0">
             {eventsLoading ? (
               <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-secondary" /></div>
             ) : eventsSummary.recent.length > 0 ? (
               <div className="divide-y">
                 {eventsSummary.recent.map((event: any) => {
                   const dateValue = event.date || event.startDate;
                   const formattedDate = dateValue ? (dateValue.toDate ? dateValue.toDate().toLocaleDateString('pt-BR') : new Date(dateValue).toLocaleDateString('pt-BR')) : 'Sem data';
                   
                   return (
                     <div key={event.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-4">
                           <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden relative">
                              {event.image && <img src={event.image} className="w-full h-full object-cover" />}
                           </div>
                           <div>
                              <p className="font-bold text-sm leading-tight">{event.title}</p>
                              <p className="text-[10px] text-muted-foreground font-bold uppercase">{formattedDate}</p>
                           </div>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[9px] font-black uppercase",
                          event.status === 'Ativo' ? "border-green-200 text-green-600" : "border-muted text-muted-foreground"
                        )}>{event.status || 'Rascunho'}</Badge>
                     </div>
                   );
                 })}
               </div>
             ) : (
               <div className="p-12 text-center text-muted-foreground italic text-sm">Nenhum evento cadastrado ainda.</div>
             )}
          </CardContent>
        </Card>

        {/* Estatísticas de Divulgação QR */}
        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
           <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                 <QrCode className="w-5 h-5 text-secondary" /> Inteligência de Tráfego QR
              </CardTitle>
              <CardDescription>Escaneamentos de agenda e materiais físicos.</CardDescription>
           </CardHeader>
           <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Últimos 7 dias</p>
                    <p className="text-2xl font-black text-primary">{qrStats.last7Days}</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Últimos 30 dias</p>
                    <p className="text-2xl font-black text-primary">{qrStats.last30Days}</p>
                 </div>
              </div>
              
              <Separator className="border-dashed" />

              <div className="space-y-4">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Último Acesso via QR</h4>
                 {qrStats.lastScan ? (
                   <div className="p-4 bg-muted/20 rounded-2xl border flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-white rounded-lg"><Clock className="w-3.5 h-3.5 text-secondary" /></div>
                         <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase">{qrStats.lastScan.scanType === 'event' ? 'Página de Evento' : 'Agenda Pública'}</span>
                            <span className="text-[9px] text-muted-foreground">{new Date(qrStats.lastScan.scannedAt?.seconds * 1000 || qrStats.lastScan.scannedAt).toLocaleString('pt-BR')}</span>
                         </div>
                      </div>
                      <Badge variant="outline" className="text-[8px] font-black uppercase border-dashed">D+0</Badge>
                   </div>
                 ) : (
                   <div className="p-10 text-center opacity-30 italic text-[10px] uppercase font-bold">Nenhum scan registrado.</div>
                 )}
              </div>

              <div className="pt-2">
                 <Button asChild className="w-full bg-secondary text-white font-black h-12 rounded-xl uppercase italic text-[10px] shadow-lg gap-2">
                    <Link href={`/${currentOrg.username}`} target="_blank">Gerar Novos QR Codes <ArrowRight className="w-4 h-4" /></Link>
                 </Button>
              </div>
           </CardContent>
        </Card>
      </div>
    </div>
  );
}
