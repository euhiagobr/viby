
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Send, 
  Users, 
  MousePointer2, 
  MailOpen, 
  TrendingUp, 
  ArrowUpRight,
  Zap,
  Clock,
  Target,
  BarChart3,
  Percent,
  Inbox,
  Loader2
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';

export default function CrmDashboard() {
  const db = useFirestore();

  // Queries Reais
  const campaignsQuery = useMemoFirebase(() => db ? query(collection(db, "crm_campaigns"), orderBy("createdAt", "desc")) : null, [db]);
  const usersQuery = useMemoFirebase(() => db ? collection(db, "users") : null, [db]);
  const leadsQuery = useMemoFirebase(() => db ? collection(db, "organizer_leads") : null, [db]);

  const { data: allCampaigns, loading: loadingCampaigns } = useCollection<any>(campaignsQuery);
  const { data: users } = useCollection<any>(usersQuery);
  const { data: leads } = useCollection<any>(leadsQuery);

  // Consolidação de métricas reais
  const metrics = React.useMemo(() => {
    if (!allCampaigns) return { sent: 0, opens: 0, clicks: 0, conversions: 0 };
    return allCampaigns.reduce((acc, c) => {
      const m = c.metrics || {};
      acc.sent += (m.sent || 0);
      acc.opens += (m.opens || 0);
      acc.clicks += (m.clicks || 0);
      acc.conversions += (m.conversions || 0);
      return acc;
    }, { sent: 0, opens: 0, clicks: 0, conversions: 0 });
  }, [allCampaigns]);

  const statsData = [
    { 
      label: "Envios Totais", 
      value: metrics.sent.toLocaleString(), 
      icon: Send, 
      color: "blue" 
    },
    { 
      label: "Taxa de Abertura", 
      value: metrics.sent > 0 ? `${((metrics.opens / metrics.sent) * 100).toFixed(1)}%` : "0%", 
      icon: MailOpen, 
      color: "green" 
    },
    { 
      label: "Taxa de Cliques", 
      value: metrics.sent > 0 ? `${((metrics.clicks / metrics.sent) * 100).toFixed(1)}%` : "0%", 
      icon: MousePointer2, 
      color: "secondary" 
    },
    { 
      label: "Lead Organizers", 
      value: (leads?.length || 0).toLocaleString(), 
      icon: Target, 
      color: "orange" 
    },
  ];

  // Dados reais para o gráfico (últimas campanhas)
  const chartData = React.useMemo(() => {
    if (!allCampaigns) return [];
    return [...allCampaigns]
      .reverse()
      .slice(-7)
      .map(c => ({
        name: c.title.substring(0, 10),
        envios: c.metrics?.sent || 0
      }));
  }, [allCampaigns]);

  if (loadingCampaigns) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse opacity-40">Processando Inteligência CRM...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsData.map((s, i) => (
          <MetricCard key={i} label={s.label} value={s.value} icon={s.icon} color={s.color} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-8 border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="p-8 border-b bg-muted/20">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-secondary" /> Histórico de Disparos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 h-80">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900}} />
                  <YAxis hide />
                  <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                  <Bar dataKey="envios" fill="hsl(var(--secondary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full opacity-20">
                <Inbox className="w-10 h-10 mb-2" />
                <p className="text-[10px] font-black uppercase">Sem dados históricos</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="p-8 border-b bg-muted/20">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <Clock className="w-5 h-5 text-secondary" /> Últimas Campanhas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             {allCampaigns && allCampaigns.length > 0 ? (
               <div className="divide-y">
                  {allCampaigns.slice(0, 5).map((c: any) => (
                    <div key={c.id} className="p-5 flex items-center justify-between hover:bg-muted/10 transition-colors cursor-pointer">
                       <div className="space-y-0.5">
                          <p className="text-xs font-black uppercase italic text-primary truncate max-w-[150px]">{c.title}</p>
                          <p className="text-[8px] font-bold text-muted-foreground uppercase">{c.status.replace('_',' ')}</p>
                       </div>
                       <Badge variant="outline" className="text-[8px] font-black uppercase">{c.metrics?.sent || 0} envios</Badge>
                    </div>
                  ))}
               </div>
             ) : (
               <div className="p-12 text-center opacity-20 italic text-xs uppercase font-black">Nenhuma campanha registrada</div>
             )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <AutomationShortcut label="Boas-vindas" desc="Gatilho em tempo real para novos leads" active />
         <AutomationShortcut label="Abandono de Carrinho" desc="Monitoramento de pendências de checkout" />
         <AutomationShortcut label="Reativação" desc="Usuários inativos há mais de 30 dias" />
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color }: any) {
  const colors: any = { 
    blue: "bg-blue-50 text-blue-500", 
    green: "bg-green-50 text-green-600", 
    secondary: "bg-secondary/5 text-secondary", 
    orange: "bg-orange-50 text-orange-600" 
  };
  return (
    <Card className="border-none shadow-sm rounded-3xl bg-white group hover:-translate-y-1 transition-all">
       <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className={cn("p-2.5 rounded-2xl", colors[color])}><Icon className="w-5 h-5" /></div>
          </div>
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">{label}</p>
          <p className="text-2xl font-black text-primary">{value}</p>
       </CardContent>
    </Card>
  );
}

function AutomationShortcut({ label, desc, active }: any) {
   return (
      <Card className="border-none shadow-sm rounded-3xl bg-white border-l-4 border-secondary/20">
         <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
               <div className="flex items-center gap-2">
                  <Zap className={cn("w-3.5 h-3.5", active ? "text-orange-500 fill-orange-500" : "text-muted-foreground opacity-20")} />
                  <span className="text-xs font-black uppercase italic text-primary">{label}</span>
               </div>
               <p className="text-[9px] font-medium text-muted-foreground uppercase">{desc}</p>
            </div>
            <div className={cn("w-2 h-2 rounded-full", active ? "bg-green-500 animate-pulse" : "bg-muted")} />
         </CardContent>
      </Card>
   );
}
