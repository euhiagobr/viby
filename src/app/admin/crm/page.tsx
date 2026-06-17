'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Users, 
  TrendingUp, 
  BarChart3, 
  Target, 
  Loader2, 
  Clock, 
  User, 
  Ticket, 
  Building2, 
  History 
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, getCountFromServer, where } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/financial-utils';
import { Separator } from '@/components/ui/separator';

export default function CrmDashboard() {
  const db = useFirestore();
  const [metrics, setMetrics] = React.useState({
    totalUsers: 0,
    totalBuyers: 0,
    totalOrgs: 0,
    totalLeads: 0
  });
  const [loading, setLoading] = React.useState(true);

  const campaignsQuery = useMemoFirebase(() => 
    db ? query(collection(db, "crm_campaigns"), orderBy("createdAt", "desc")) : null, 
    [db]
  );
  const { data: campaigns } = useCollection<any>(campaignsQuery);

  React.useEffect(() => {
    if (!db) return;
    const fetchCounts = async () => {
      try {
        const [users, buyers, orgs, leads] = await Promise.all([
          getCountFromServer(collection(db, "users")),
          getCountFromServer(query(collection(db, "registrations"), where("paymentStatus", "in", ["Pago", "Disponível"]))),
          getCountFromServer(collection(db, "organizations")),
          getCountFromServer(collection(db, "organizer_leads"))
        ]);
        setMetrics({
          totalUsers: users.data().count,
          totalBuyers: buyers.data().count,
          totalOrgs: orgs.data().count,
          totalLeads: leads.data().count
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchCounts();
  }, [db]);

  const globalPerformance = React.useMemo(() => {
    if (!campaigns) return { sent: 0, revenue: 0 };
    return campaigns.reduce((acc, c) => {
      acc.sent += (c.metrics?.sent || 0);
      acc.revenue += (c.metrics?.revenue || 0);
      return acc;
    }, { sent: 0, revenue: 0 });
  }, [campaigns]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPI label="Usuários (Base)" value={metrics.totalUsers} icon={User} color="blue" loading={loading} />
        <KPI label="Compradores Reais" value={metrics.totalBuyers} icon={Ticket} color="green" loading={loading} />
        <KPI label="Marcas Ativas" value={metrics.totalOrgs} icon={Building2} color="secondary" loading={loading} />
        <KPI label="Leads B2B" value={metrics.totalLeads} icon={Target} color="orange" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-8 border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
          <CardHeader className="p-8 border-b bg-muted/20">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2 text-primary">
              <TrendingUp className="w-5 h-5 text-secondary" /> Performance do Email Marketing
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-10">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <MetricItem label="Disparos Totais" value={globalPerformance.sent} sub="Campanhas Enviadas" />
                <MetricItem label="Receita Atribuída" value={formatCurrency(globalPerformance.revenue)} sub="Conversão Direta" />
                <MetricItem label="Engajamento Médio" value="24.8%" sub="Abertura de Newsletters" highlight />
             </div>
             <div className="h-48 bg-muted/20 rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center gap-2 opacity-30">
                <BarChart3 className="w-8 h-8" />
                <p className="text-[9px] font-black uppercase tracking-[0.3em]">Métricas Analíticas em Tempo Real</p>
             </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
          <CardHeader className="p-8 border-b bg-muted/20">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2 text-primary">
              <Clock className="w-5 h-5 text-secondary" /> Aguardando Aprovação
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             {campaigns?.filter(c => c.status === 'rascunho' || c.status === 'teste_enviado').length > 0 ? (
               <div className="divide-y">
                  {campaigns.filter(c => c.status === 'rascunho' || c.status === 'teste_enviado').slice(0, 5).map(c => (
                    <div key={c.id} className="p-6 hover:bg-muted/10 transition-colors">
                       <p className="font-bold text-sm text-primary uppercase truncate">{c.title}</p>
                       <div className="flex items-center gap-2 mt-1">
                          <Badge className="text-[8px] font-black uppercase h-4 bg-orange-50 text-orange-600 border-orange-200">
                             {c.status === 'rascunho' ? 'Rascunho' : 'Teste Enviado'}
                          </Badge>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase font-medium">Audit Version: {c.brandVersion || 0}</span>
                       </div>
                    </div>
                  ))}
               </div>
             ) : (
               <div className="py-20 text-center opacity-30 italic text-[10px] uppercase font-bold flex flex-col items-center gap-2">
                  <History className="w-8 h-8" />
                  Sem pendências na fila
               </div>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPI({ label, value, icon: Icon, color, loading }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-500",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-500",
    secondary: "bg-secondary/5 text-secondary"
  };
  return (
    <Card className="border-none shadow-sm rounded-3xl bg-white">
       <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className={cn("p-2.5 rounded-2xl", colors[color])}><Icon className="w-5 h-5" /></div>
          </div>
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">{label}</p>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <p className="text-2xl font-black text-primary">{value.toLocaleString()}</p>}
       </CardContent>
    </Card>
  );
}

function MetricItem({ label, value, sub, highlight }: any) {
  return (
    <div className="space-y-1">
       <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60 tracking-widest">{label}</p>
       <p className={cn("text-2xl font-black italic tracking-tighter", highlight ? "text-secondary" : "text-primary")}>{value}</p>
       <p className="text-[8px] font-bold text-muted-foreground uppercase">{sub}</p>
    </div>
  );
}
