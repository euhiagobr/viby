
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
  Percent
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
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

const chartData = [
  { name: 'Seg', envios: 400 },
  { name: 'Ter', envios: 300 },
  { name: 'Qua', envios: 600 },
  { name: 'Qui', envios: 800 },
  { name: 'Sex', envios: 500 },
  { name: 'Sab', envios: 900 },
  { name: 'Dom', envios: 200 },
];

export default function CrmDashboard() {
  const db = useFirestore();
  const campaignsQuery = useMemoFirebase(() => db ? query(collection(db, "crm_campaigns"), orderBy("createdAt", "desc"), limit(5)) : null, [db]);
  const { data: recentCampaigns } = useCollection<any>(campaignsQuery);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard label="Envios Totais" value="128.4K" icon={Send} color="blue" />
        <MetricCard label="Taxa de Abertura" value="24.8%" icon={MailOpen} color="green" />
        <MetricCard label="Taxa de Cliques" value="4.2%" icon={MousePointer2} color="secondary" />
        <MetricCard label="Conversão CRM" value="1.8%" icon={Target} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-8 border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="p-8 border-b bg-muted/20">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-secondary" /> Volume de Disparos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900}} />
                <YAxis hide />
                <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                <Bar dataKey="envios" fill="hsl(var(--secondary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="p-8 border-b bg-muted/20">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <Clock className="w-5 h-5 text-secondary" /> Campanhas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             {recentCampaigns?.length > 0 ? (
               <div className="divide-y">
                  {recentCampaigns.map((c: any) => (
                    <div key={c.id} className="p-5 flex items-center justify-between hover:bg-muted/10 transition-colors cursor-pointer">
                       <div className="space-y-0.5">
                          <p className="text-xs font-black uppercase italic text-primary truncate max-w-[150px]">{c.title}</p>
                          <p className="text-[8px] font-bold text-muted-foreground uppercase">{c.status}</p>
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
         <AutomationShortcut label="Boas-vindas" desc="Disparo 24h após cadastro de Lead" active />
         <AutomationShortcut label="Abandono de Carrinho" desc="Lembrete 2h após inatividade" active />
         <AutomationShortcut label="Reativação" desc="90 dias sem compras na plataforma" />
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
