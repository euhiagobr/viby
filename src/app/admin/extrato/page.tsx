"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, orderBy, limit } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  BarChart3,
  PieChart as PieChartIcon,
  Globe
} from 'lucide-react';
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"
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
import { cn } from '@/lib/utils';
import { ERPMetrics, calculateRealProfit } from '@/lib/financial-erp-utils';
import { Separator } from '@/components/ui/separator';

export default function AdminERPDashboard() {
  const db = useFirestore();
  const { formatPrice, convertValue } = useCurrency();

  // Queries para consolidação do ERP
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
        const cur = (t.currency || 'BRL') as CurrencyCode;
        const normalize = (val: number) => convertValue(val, cur, 'BRL');

        if (t.status === 'cancelado') {
           m.totalRefunds += normalize(t.totalFacePrice || 0);
           return;
        }
        const totalBrutoTicket = (t.totalFacePrice || 0) + (t.buyerFeeAmount || 0);
        m.grossRevenue += normalize(totalBrutoTicket);
        m.netRevenue += normalize(t.vibyGrossProfit || 0);
        m.totalStripeFees += normalize(t.stripeFeeAmount || 0);
        m.totalTaxes += normalize(t.taxAmount || 0);
        m.totalPayouts += normalize(t.payoutToProducer || 0);
      });
    }

    if (ads) {
      ads.forEach(ad => {
        if (ad.status === 'cancelado' || ad.status === 'rejeitado') return;
        // Ads são atualmente fixos em BRL, mas mantemos lógica de normalização por segurança
        const cur = (ad.currency || 'BRL') as CurrencyCode;
        const normalize = (val: number) => convertValue(val, cur, 'BRL');

        m.grossRevenue += normalize(ad.grossValue || 0);
        const adProfit = normalize(ad.netValue || 0);
        m.totalAdsRevenue += adProfit;
        m.netRevenue += adProfit;
        m.totalTaxes += normalize(ad.taxValue || 0);
      });
    }

    if (expenses) {
      expenses.forEach(e => {
        // Despesas são registradas em BRL (Custo de Porto Alegre)
        m.internalExpenses += (e.amount || 0);
      });
    }

    if (payouts) {
      payouts.forEach(p => {
        if (p.status === 'Pendente') m.pendingPayouts += convertValue(p.amount || 0, (p.currency || 'BRL'), 'BRL');
      });
    }

    m.realProfit = calculateRealProfit(m);
    return m;
  }, [tickets, ads, expenses, payouts, convertValue]);

  const chartData = [
    { name: 'Faturamento', value: metrics.grossRevenue, color: 'hsl(var(--primary))' },
    { name: 'Repasses', value: metrics.totalPayouts, color: 'hsl(var(--secondary))' },
    { name: 'Impostos/Taxas', value: metrics.totalStripeFees + metrics.totalTaxes, color: '#ef4444' },
    { name: 'DRE Líquido', value: metrics.realProfit, color: '#10b981' },
  ];

  if (loadingTickets || loadingAds) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse text-muted-foreground">
          Consolidando dados financeiros...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPI kpiTitle="Volume Bruto (BRL)" value={metrics.grossRevenue} icon={TrendingUp} color="blue" formatPrice={formatPrice} />
        <KPI kpiTitle="Lucro Líquido Real" value={metrics.realProfit} icon={CheckCircle2} color="green" formatPrice={formatPrice} />
        <KPI kpiTitle="Repasses Pendentes" value={metrics.pendingPayouts} icon={Clock} color="orange" formatPrice={formatPrice} />
        <KPI kpiTitle="Despesa Operacional" value={metrics.internalExpenses} icon={ArrowDownRight} color="red" formatPrice={formatPrice} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-8 border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
          <CardHeader className="p-8 border-b">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
               <BarChart3 className="w-5 h-5 text-secondary" /> Performance ERP Consolidated
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
                          <p className="text-sm font-black">{formatPrice(Number(payload[0].value), 'BRL')}</p>
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
               <Scale className="w-5 h-5 text-secondary" /> Rentabilidade Global
             </CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-8 relative z-10">
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Margem Líquida Unificada</p>
                <div className="flex items-baseline gap-2">
                   <p className="text-5xl font-black italic tracking-tighter">
                     {metrics.grossRevenue > 0 ? ((metrics.realProfit / metrics.grossRevenue) * 100).toFixed(1) : 0}%
                   </p>
                </div>
             </div>
             
             <Separator className="bg-white/10" />

             <div className="space-y-4">
                <MetricLine label="Imposto Provisionado" value={metrics.totalTaxes} formatPrice={formatPrice} />
                <MetricLine label="Custo Stripe (Normalizado)" value={metrics.totalStripeFees} formatPrice={formatPrice} />
                <MetricLine label="Receita Bruta Viby" value={metrics.netRevenue} formatPrice={formatPrice} />
                <MetricLine label="Repasses de Produção" value={metrics.totalPayouts} formatPrice={formatPrice} />
             </div>

             <div className="p-4 bg-white/10 rounded-2xl border border-white/10 flex items-start gap-3">
                <Globe className="w-5 h-5 text-secondary shrink-0" />
                <p className="text-[10px] font-medium leading-relaxed uppercase">
                   Todos os valores foram normalizados para BRL utilizando as taxas de câmbio vigentes para consolidar o balanço.
                </p>
             </div>
          </CardContent>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-4 hover:shadow-md transition-all">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
               <Coins className="w-4 h-4 text-secondary" /> Divulgação & Ads
            </h3>
            <div className="space-y-1">
               <p className="text-3xl font-black text-primary">{formatPrice(metrics.totalAdsRevenue, 'BRL')}</p>
               <p className="text-[10px] font-bold text-green-600 uppercase">Receita de Alto Impacto</p>
            </div>
         </Card>
         <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-4 hover:shadow-md transition-all">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
               <Receipt className="w-4 h-4 text-secondary" /> Taxas Ingressos
            </h3>
            <div className="space-y-1">
               <p className="text-3xl font-black text-primary">{formatPrice(metrics.netRevenue - metrics.totalAdsRevenue, 'BRL')}</p>
               <p className="text-[10px] font-bold text-muted-foreground uppercase">Revenue Share de Eventos</p>
            </div>
         </Card>
         <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-4 hover:shadow-md transition-all">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
               <ArrowDownRight className="w-4 h-4 text-red-500" /> Prejuízo (Estornos)
            </h3>
            <div className="space-y-1">
               <p className="text-3xl font-black text-red-500">{formatPrice(metrics.totalRefunds, 'BRL')}</p>
               <p className="text-[10px] font-bold text-muted-foreground uppercase">Valor Devolvido Normalizado</p>
            </div>
         </Card>
      </div>
    </div>
  );
}

function KPI({ kpiTitle, value, icon: Icon, color = "blue", formatPrice }: any) {
  const colors: any = {
    blue: "text-blue-500 bg-blue-50",
    green: "text-green-600 bg-green-50",
    orange: "text-orange-500 bg-orange-50",
    red: "text-red-500 bg-red-50"
  };
  return (
    <Card className="border-none shadow-sm rounded-3xl bg-white group hover:-translate-y-1 transition-all">
       <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className={cn("p-2.5 rounded-2xl transition-transform group-hover:scale-110", colors[color])}>
                <Icon className="w-5 h-5" />
             </div>
          </div>
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">{kpiTitle}</p>
          <p className="text-2xl font-black text-primary">{typeof value === 'number' ? formatPrice(value, 'BRL') : value}</p>
       </CardContent>
    </Card>
  );
}

function MetricLine({ label, value, formatPrice }: { label: string, value: number, formatPrice: (v: number, c: CurrencyCode) => string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-none">
       <span className="text-[10px] font-bold uppercase opacity-60">{label}</span>
       <span className="text-xs font-black">{formatPrice(value, 'BRL')}</span>
    </div>
  );
}
