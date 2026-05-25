
'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  BarChart3, 
  FileSpreadsheet, 
  FileText, 
  Download, 
  Loader2, 
  Calendar,
  CheckCircle2,
  TrendingUp,
  Scale,
  PieChart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/financial-utils';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';

export default function AdminReportsPage() {
  const db = useFirestore();
  const [isExporting, setIsExporting] = React.useState<string | null>(null);

  const ticketsQuery = useMemoFirebase(() => db ? collection(db, "tax_tickets") : null, [db]);
  const adsQuery = useMemoFirebase(() => db ? collection(db, "tax_ads") : null, [db]);
  const expensesQuery = useMemoFirebase(() => db ? collection(db, "internal_expenses") : null, [db]);

  const { data: tickets } = useCollection<any>(ticketsQuery);
  const { data: ads } = useCollection<any>(adsQuery);
  const { data: expenses } = useCollection<any>(expensesQuery);

  const handleExportFull = async (format: 'xlsx' | 'csv') => {
    setIsExporting(format);
    try {
      const data = [
        ...(tickets || []).map(t => ({ Data: t.timestamp?.toDate?.()?.toLocaleString() || '', Tipo: 'Ingresso', Titulo: t.eventTitle, Bruto: t.totalFacePrice, NetViby: t.vibyNetProfit, Imposto: t.taxAmount, Stripe: t.stripeFeeAmount, Repasse: t.payoutToProducer })),
        ...(ads || []).map(ad => ({ Data: ad.monthKey, Tipo: 'Anuncio', Titulo: ad.adTitle, Bruto: ad.grossValue, NetViby: ad.netValue, Imposto: ad.taxValue, Stripe: 0, Repasse: 0 })),
        ...(expenses || []).map(ex => ({ Data: ex.date?.toDate?.()?.toLocaleString() || '', Tipo: 'Despesa Interna', Titulo: ex.title, Bruto: -ex.amount, NetViby: -ex.amount, Imposto: 0, Stripe: 0, Repasse: 0 }))
      ];

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Consolidado Viby");
      
      if (format === 'xlsx') {
        XLSX.writeFile(wb, `viby_relatorio_financeiro_${new Date().toISOString().split('T')[0]}.xlsx`);
      } else {
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `viby_relatorio_financeiro_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
      }
      toast({ title: "Relatório gerado!" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na exportação" });
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-secondary" /> Relatórios Consolidados
        </h1>
        <p className="text-muted-foreground font-medium">Extração de dados fiscais e contábeis para fechamentos mensais.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
         <ReportCard 
           title="Relatório Geral de Vendas" 
           desc="Consolida todos os ingressos pagos, taxas recolhidas e impostos devidos por período."
           icon={FileSpreadsheet}
           onExport={() => handleExportFull('xlsx')}
           loading={isExporting === 'xlsx'}
         />
         <ReportCard 
           title="DRE Operacional (Profit & Loss)" 
           desc="Demonstrativo de lucros e perdas considerando despesas operacionais e custos Stripe."
           icon={Scale}
           onExport={() => handleExportFull('csv')}
           loading={isExporting === 'csv'}
         />
         <ReportCard 
           title="Métricas de ROI e Ads" 
           desc="Desempenho financeiro das campanhas de impulsionamento e saldo de marcas."
           icon={TrendingUp}
           onExport={() => handleExportFull('xlsx')}
           loading={isExporting === 'xlsx'}
         />
      </div>

      <Card className="border-none shadow-sm rounded-[2.5rem] bg-primary text-white overflow-hidden">
        <CardContent className="p-10 flex flex-col md:flex-row items-center gap-10">
           <div className="flex-1 space-y-4">
              <h3 className="text-2xl font-black italic uppercase tracking-tighter">Conciliação Automática</h3>
              <p className="text-sm opacity-80 leading-relaxed font-medium">
                O sistema processa as vendas em D+0 para fins fiscais e D+30 para repasses. O relatório consolidado utiliza o timezone de Brasília (GMT-3) e arredondamento padrão para conformidade com o Stripe.
              </p>
              <div className="flex gap-4 pt-2">
                 <div className="flex items-center gap-2 text-[10px] font-black uppercase bg-white/10 px-3 py-1.5 rounded-full"><CheckCircle2 className="w-3.5 h-3.5 text-secondary" /> Prê-Fiscais Gerados</div>
                 <div className="flex items-center gap-2 text-[10px] font-black uppercase bg-white/10 px-3 py-1.5 rounded-full"><CheckCircle2 className="w-3.5 h-3.5 text-secondary" /> Auditoria de Repasses</div>
              </div>
           </div>
           <div className="shrink-0">
              <div className="w-32 h-32 bg-secondary rounded-3xl flex items-center justify-center rotate-12 shadow-2xl">
                 <PieChart className="w-16 h-16 text-white" />
              </div>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportCard({ title, desc, icon: Icon, onExport, loading }: any) {
  return (
    <Card className="border-none shadow-sm rounded-[2rem] bg-white group hover:shadow-md transition-all">
       <CardHeader className="p-8 pb-4">
          <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
             <Icon className="w-6 h-6 text-secondary" />
          </div>
          <CardTitle className="text-xl font-black italic uppercase tracking-tighter">{title}</CardTitle>
          <CardDescription className="text-xs font-medium leading-relaxed">{desc}</CardDescription>
       </CardHeader>
       <CardContent className="p-8 pt-4">
          <Button 
            onClick={onExport} 
            disabled={loading}
            className="w-full bg-muted text-primary hover:bg-secondary hover:text-white font-black h-12 rounded-xl uppercase text-[10px] tracking-widest gap-2 shadow-sm transition-all"
          >
             {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
             Gerar Relatório
          </Button>
       </CardContent>
    </Card>
  );
}
