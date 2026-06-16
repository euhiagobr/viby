'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Users, 
  MousePointer2, 
  MailOpen, 
  TrendingUp, 
  Zap,
  Target,
  BarChart3,
  Inbox,
  Loader2,
  Clock
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, getCountFromServer, where } from 'firebase/firestore';
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
  const [realMetrics, setRealMetrics] = React.useState({
    totalUsers: 0,
    totalLeads: 0,
    totalCampaigns: 0,
    totalSent: 0
  });
  const [loadingMetrics, setLoadingMetrics] = React.useState(true);

  // Queries Reais
  const campaignsQuery = useMemoFirebase(() => db ? query(collection(db, "crm_campaigns"), orderBy("createdAt", "desc")) : null, [db]);
  const { data: campaigns, loading: loadingCampaigns } = useCollection<any>(campaignsQuery);

  React.useEffect(() => {
    if (!db) return;
    const fetchCounts = async () => {
      try {
        const [usersCount, leadsCount, campaignCount] = await Promise.all([
          getCountFromServer(collection(db, "users")),
          getCountFromServer(collection(db, "organizer_leads")),
          getCountFromServer(collection(db, "crm_campaigns"))
        ]);

        setRealMetrics({
          totalUsers: usersCount.data().count,
          totalLeads: leadsCount.data().count,
          totalCampaigns: campaignCount.data().count,
          totalSent: 0 // Será calculado via agregação de campanhas
        });
      } catch (e) {
        console.error("Erro ao carregar métricas reais:", e);
      } finally {
        setLoadingMetrics(false);
      }
    };
    fetchCounts();
  }, [db]);

  const campaignMetrics = React.useMemo(() => {
    if (!campaigns) return { sent: 0, opens: 0, clicks: 0 };
    return campaigns.reduce((acc, c) => {
      acc.sent += (c.metrics?.sent || 0);
      acc.opens += (c.metrics?.opens || 0);
      acc.clicks += (c.metrics?.clicks || 0);
      return acc;
    }, { sent: 0, opens: 0, clicks: 0 });
  }, [campaigns]);

  const statsData = [
    { label: "Usuários na Base", value: realMetrics.totalUsers.toLocaleString(), icon: Users, color: "blue" },
    { label: "Leads Captados", value: realMetrics.totalLeads.toLocaleString(), icon: Target, color: "orange" },
    { label: "Total Enviados", value: campaignMetrics.sent.toLocaleString(), icon: Send, color: "secondary" },
    { label: "Taxa de Abertura", value: campaignMetrics.sent > 0 ? `${((campaignMetrics.opens / campaignMetrics.sent) * 100).toFixed(1)}%` : "0%", icon: MailOpen, color: "green" },
  ];

  const chartData = React.useMemo(() => {
    if (!campaigns || campaigns.length === 0) return [];
    return [...campaigns]
      .reverse()
      .slice(-7)
      .map(c => ({
        name: c.title.substring(0, 10),
        envios: c.metrics?.sent || 0
      }));
  }, [campaigns]);

  if (loadingCampaigns || loadingMetrics) {
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
              <BarChart3 className="w-5 h-5 text-secondary" /> Histórico de Engajamento
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
                <p className="text-[10px] font-black uppercase">Sem dados de disparos reais</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="p-8 border-b bg-muted/20">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <Clock className="w-5 h-5 text-secondary" /> Campanhas Reais
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             {campaigns && campaigns.length > 0 ? (
               <div className="divide-y">
                  {campaigns.slice(0, 5).map((c: any) => (
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
