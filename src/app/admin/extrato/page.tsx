'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  Wallet, 
  Coins, 
  Receipt,
  Loader2,
  Calendar,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Clock,
  BarChart3
} from 'lucide-react';
import { formatCurrency } from '@/lib/financial-utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { cn } from '@/lib/utils';
import { ERPMetrics, calculateRealProfit } from '@/lib/financial-erp-utils';
import { Separator } from '@/components/ui/separator';

export default function AdminERPDashboard() {
  const db = useFirestore();

  // Queries para consolidação
  const ticketsQuery = useMemoFirebase(() => db ? query(collection(db, "tax_tickets")) : null, [db]);
  const adsQuery = useMemoFirebase(() => db ? query(collection(db, "tax_ads")) : null, [db]);
  const expensesQuery = useMemoFirebase(() => db ? query(collection(db, "internal_expenses")) : null, [db]);
  const payoutRequestsQuery = useMemoFirebase(() => db ? query(collection(db, "payout_requests")) : null, [db]);

  const { data: tickets, loading: loadingTickets } = useCollection<any>(ticketsQuery);
  const { data: ads, loading: loadingAds } = useCollection<any>(adsQuery);
  const { data: expenses, loading: loadingExpenses } = useCollection<any>(expensesQuery);
  const { data: payouts, loading: loadingPayouts } = useCollection<any>(payoutRequestsQuery);

  const metrics = React.useMemo((): ERPMetrics => {
    const m: ERPMetrics = {
      grossRevenue: 0,
      netRevenue: 0,
      totalStripeFees: 0,
      totalTaxes: 0,
      totalPayouts: 0,
      totalAdsRevenue: 0,
      internalExpenses: 0,
      realProfit: 0,
      pendingPayouts: 0,
      totalRefunds: 0
    };

    if (tickets) {
      tickets.forEach(t => {
        m.grossRevenue += (t.totalFacePrice || 0);
        m.netRevenue += (t.vibyGrossProfit || 0);
        m.totalStripeFees += (t.stripeFeeAmount || 0);
        m.totalTaxes += (t.taxAmount || 0);
        m.totalPayouts += (t.payoutToProducer || 0);
        if (t.status === 'cancelado') m.totalRefunds += (t.totalFacePrice || 0);
      });
    }

    if (ads) {
      ads.forEach(ad => {
        m.totalAdsRevenue += (ad.grossValue || 0);
        m.totalTaxes += (ad.taxValue || 0);
        m.netRevenue += (ad.netValue || 0);
      });
    }

    if (expenses) {
      expenses.forEach(e => {
        m.internalExpenses += (e.amount || 0);
      });
    }

    if (payouts) {
      payouts.forEach(p => {
        if (p.status === 'Pendente') m.pendingPayouts += (p.amount || 0);
      });
    }

    m.realProfit = calculateRealProfit(m);
    return m;
  }, [tickets, ads, expenses, payouts]);

  const chartData = [
    { name: 'Bruto', value: metrics.grossRevenue, color: 'hsl(var(--primary))' },
    { name: 'Repasses', value: metrics.totalPayouts, color: 'hsl(var(--secondary))' },
    { name: 'Custos/Taxas', value: metrics.totalStripeFees + metrics.totalTaxes + metrics.internalExpenses, color: '#ef4444' },
    { name: 'Lucro Real', value: metrics.realProfit, color: '#10b981' },
  ];

  if (loadingTickets || loadingAds) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>;
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPI kpiTitle="Faturamento Bruto" value={metrics.grossRevenue + metrics.totalAdsRevenue} icon={TrendingUp} trend="+12.4%" />
        <KPI kpiTitle="Lucro Líquido Real" value={metrics.realProfit} icon={CheckCircle2} color="green" />
        <KPI kpiTitle="Pendência de Repasse" value={metrics.pendingPayouts} icon={Clock} color="orange" />
        <KPI kpiTitle="Despesas Operacionais" value={metrics.internalExpenses} icon={ArrowDownRight} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-8 border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="p-8 border-b">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
               <BarChart3 className="w-5 h-5 text-secondary" /> Fluxo de Caixa Consolidado
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-[10px] font-black uppercase" />
                <YAxis hide />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-primary text-white p-3 rounded-xl shadow-2xl border-none">
                          <p className="text-[10px] font-black uppercase opacity-60 mb-1">{payload[0].payload.name}</p>
                          <p className="text-sm font-black">{formatCurrency(Number(payload[0].value))}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-none shadow-sm rounded-[2.5rem] bg-primary text-white relative overflow-hidden">
          <CardHeader className="p-8">
             <CardTitle className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2">
               <Scale className="w-5 h-5 text-secondary" /> Saúde Financeira
             </CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-8 relative z-10">
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Margem de Lucro</p>
                <div className="flex items-baseline gap-2">
                   <p className="text-5xl font-black italic tracking-tighter">
                     {metrics.grossRevenue > 0 ? ((metrics.realProfit / (metrics.grossRevenue + metrics.totalAdsRevenue)) * 100).toFixed(1) : 0}%
                   </p>
                </div>
             </div>
             
             <Separator className="bg-white/10" />

             <div className="space-y-4">
                <MetricLine label="Impostos Totais" value={metrics.totalTaxes} />
                <MetricLine label="Taxas Gateway (Stripe)" value={metrics.totalStripeFees} />
                <MetricLine label="Comissões Viby (Líquidas)" value={metrics.netRevenue - metrics.totalAdsRevenue} />
             </div>

             <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3">
                   <AlertTriangle className="w-5 h-5 text-secondary" />
                   <p className="text-[10px] font-medium leading-relaxed uppercase">
                     Considere as projeções de repasses futuros no saldo em custódia para evitar quebras de caixa.
                   </p>
                </div>
             </div>
          </CardContent>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
               <Coins className="w-4 h-4 text-secondary" /> Receita de Anúncios
            </h3>
            <div className="space-y-1">
               <p className="text-3xl font-black text-primary">{formatCurrency(metrics.totalAdsRevenue)}</p>
               <p className="text-[10px] font-bold text-green-600 uppercase">100% de margem operacional</p>
            </div>
         </Card>
         <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
               <Receipt className="w-4 h-4 text-secondary" /> Taxas Administrativas
            </h3>
            <div className="space-y-1">
               <p className="text-3xl font-black text-primary">{formatCurrency(metrics.netRevenue - metrics.totalAdsRevenue)}</p>
               <p className="text-[10px] font-bold text-muted-foreground uppercase">Proveniente de ingressos</p>
            </div>
         </Card>
         <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
               <ArrowDownRight className="w-4 h-4 text-red-500" /> Estornos Totais
            </h3>
            <div className="space-y-1">
               <p className="text-3xl font-black text-red-500">{formatCurrency(metrics.totalRefunds)}</p>
               <p className="text-[10px] font-bold text-muted-foreground uppercase">Vendas canceladas / Chargebacks</p>
            </div>
         </Card>
      </div>
    </div>
  );
}

function KPI({ kpiTitle, value, icon: Icon, trend, color = "blue" }: any) {
  const colors: any = {
    blue: "text-blue-500 bg-blue-50",
    green: "text-green-600 bg-green-50",
    orange: "text-orange-500 bg-orange-50",
    red: "text-red-500 bg-red-50"
  };
  return (
    <Card className="border-none shadow-sm rounded-3xl bg-white group">
       <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className={cn("p-2.5 rounded-2xl transition-transform group-hover:scale-110", colors[color])}>
                <Icon className="w-5 h-5" />
             </div>
             {trend && <Badge variant="secondary" className="text-[9px] font-black">{trend}</Badge>}
          </div>
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">{kpiTitle}</p>
          <p className="text-2xl font-black text-primary">{formatCurrency(value)}</p>
       </CardContent>
    </Card>
  );
}

function MetricLine({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-none">
       <span className="text-[10px] font-bold uppercase opacity-60">{label}</span>
       <span className="text-xs font-black">{formatCurrency(value)}</span>
    </div>
  );
}