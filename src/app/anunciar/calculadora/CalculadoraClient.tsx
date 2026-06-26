'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Calculator, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  TrendingUp, 
  Coins, 
  Ticket,
  Building2,
  Users,
  ShieldCheck,
  Search,
  Loader2,
  X
} from 'lucide-react';
import { formatCurrency } from '@/lib/financial-utils';
import { calculateSimulation, SimulationResult } from '@/lib/simulation-utils';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

const VIBY_DEFAULT_CONFIG = {
  orgPercent: 10,
  orgMin: 3.99,
  buyerPercent: 15
};

export default function CalculadoraClient() {
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Estados dos inputs
  const [qty, setQty] = React.useState(Number(searchParams.get('qtd')) || 100);
  const [value, setValue] = React.useState(Number(searchParams.get('valor')) || 50);
  const [competitionBuyer, setCompetitionBuyer] = React.useState(Number(searchParams.get('concorrencia')) || 15);
  const [promoCode, setPromoCode] = React.useState(searchParams.get('codigo') || "");
  
  // Estado da Campanha Aplicada
  const [activeConfig, setActiveConfig] = React.useState(VIBY_DEFAULT_CONFIG);
  const [appliedCode, setAppliedCode] = React.useState<string | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);

  // Resultado da Simulação
  const result = React.useMemo(() => {
    return calculateSimulation(qty, value, competitionBuyer, activeConfig);
  }, [qty, value, competitionBuyer, activeConfig]);

  // Sincronizar URL
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (appliedCode) params.set('codigo', appliedCode);
    params.set('qtd', qty.toString());
    params.set('valor', value.toString());
    params.set('concorrencia', competitionBuyer.toString());
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [qty, value, competitionBuyer, appliedCode]);

  // Validar código inicial da URL
  React.useEffect(() => {
    const code = searchParams.get('codigo');
    if (code && !appliedCode && db) {
       handleApplyCode(code);
    }
  }, [db, searchParams, appliedCode]);

  const handleApplyCode = async (codeToUse?: string) => {
    const code = codeToUse || promoCode;
    if (!code || !db) return;

    setIsValidating(true);
    try {
      const q = query(collection(db, "simulation_campaigns"), where("code", "==", code.toUpperCase()), where("active", "==", true), limit(1));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setActiveConfig({
          orgPercent: data.orgFeePercent,
          orgMin: data.orgMinFee,
          buyerPercent: data.buyerFeePercent
        });
        setAppliedCode(code.toUpperCase());
        toast({ title: "Campanha aplicada!", description: "As taxas da simulação foram atualizadas." });
      } else {
        toast({ variant: "destructive", title: "Código inválido", description: "Utilizando taxas padrão." });
        setAppliedCode(null);
        setActiveConfig(VIBY_DEFAULT_CONFIG);
      }
    } catch (e) {
      setAppliedCode(null);
    } finally {
      setIsValidating(false);
    }
  };

  const removeCode = () => {
    setAppliedCode(null);
    setPromoCode("");
    setActiveConfig(VIBY_DEFAULT_CONFIG);
  };

  return (
    <div className="space-y-16 animate-in fade-in duration-700">
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Lado Esquerdo: Inputs */}
        <div className="lg:col-span-5 space-y-8">
           <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden p-1">
              <div className="p-8 space-y-8">
                 <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-secondary ml-1">Configurações de Simulação</Label>
                    
                    <div className="space-y-2">
                       <Label className="text-xs font-bold uppercase opacity-60">Código Especial (Opcional)</Label>
                       <div className="flex gap-2">
                          <div className="relative flex-1">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                             <Input 
                                placeholder="EX: VIBYPROMO" 
                                value={promoCode} 
                                onChange={e => setPromoCode(e.target.value)}
                                disabled={!!appliedCode}
                                className="pl-10 h-12 rounded-xl border-dashed border-secondary/30 uppercase font-black" 
                             />
                             {appliedCode && (
                               <button onClick={removeCode} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-muted rounded-full hover:bg-red-50 text-red-500 transition-colors">
                                  <X className="w-3.5 h-3.5" />
                               </button>
                             )}
                          </div>
                          {!appliedCode && (
                            <Button onClick={() => handleApplyCode()} disabled={isValidating || !promoCode} className="h-12 px-6 rounded-xl bg-secondary text-white font-bold uppercase italic">
                               {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
                            </Button>
                          )}
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                       <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase opacity-60">Qtde Ingressos</Label>
                          <Input 
                            type="number" 
                            value={qty} 
                            onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 0))}
                            className="h-12 rounded-xl font-black text-primary" 
                          />
                       </div>
                       <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase opacity-60">Valor Ingresso (R$)</Label>
                          <div className="relative">
                             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black opacity-30">R$</span>
                             <Input 
                               type="number" 
                               value={value} 
                               onChange={e => setValue(Math.max(0, parseFloat(e.target.value) || 0))}
                               className="h-12 rounded-xl pl-9 font-black text-primary" 
                             />
                          </div>
                       </div>
                    </div>
                 </div>

                 <Separator className="border-dashed" />

                 <div className="space-y-6">
                    <div className="flex justify-between items-center">
                       <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Taxa Comprador Concorrência</Label>
                       <Badge className="bg-primary text-white font-black">{competitionBuyer}%</Badge>
                    </div>
                    <Slider 
                      value={[competitionBuyer]} 
                      onValueChange={v => setCompetitionBuyer(v[0])} 
                      min={15} 
                      max={40} 
                      step={5}
                      className="py-4"
                    />
                    <div className="flex justify-between text-[8px] font-black uppercase text-muted-foreground tracking-widest">
                       <span>Padrão 15%</span>
                       <span>Premium 40%</span>
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-muted/30 border-t flex items-center justify-center gap-2">
                 <ShieldCheck className="w-4 h-4 text-secondary" />
                 <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Simulação comercial baseada em médias de mercado</p>
              </div>
           </Card>

           <div className="p-8 bg-secondary/5 rounded-[3rem] border-2 border-dashed border-secondary/20 space-y-4">
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-primary">Por que a Viby é melhor?</h3>
              <ul className="space-y-3">
                 <li className="flex items-center gap-3 text-sm font-bold text-primary/80"><CheckCircle2 className="w-5 h-5 text-green-500" /> Taxas decrescentes por volume</li>
                 <li className="flex items-center gap-3 text-sm font-bold text-primary/80"><CheckCircle2 className="w-5 h-5 text-green-500" /> Dinheiro na mão em D+7</li>
                 <li className="flex items-center gap-3 text-sm font-bold text-primary/80"><CheckCircle2 className="w-5 h-5 text-green-500" /> Sem custos ocultos ou taxas de saque</li>
              </ul>
           </div>
        </div>

        {/* Lado Direito: Resultados */}
        <div className="lg:col-span-7 space-y-10">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-2">
                 <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Receita Bruta Total</p>
                 <p className="text-4xl font-black text-primary italic tracking-tighter">{formatCurrency(result.grossRevenue)}</p>
              </Card>
              <Card className="border-none shadow-xl rounded-[2rem] bg-secondary text-white p-8 space-y-2 relative overflow-hidden">
                 <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Sua Economia com Viby</p>
                 <p className="text-4xl font-black italic tracking-tighter animate-in zoom-in-95 duration-500">{formatCurrency(result.savings.absolute)}</p>
                 <Zap className="absolute -bottom-2 -right-2 w-16 h-16 opacity-10 rotate-12" />
              </Card>
           </div>

           <Card className="border-none shadow-sm rounded-[3rem] overflow-hidden bg-white">
              <div className="p-8 border-b bg-muted/20">
                 <h3 className="text-xl font-black italic uppercase tracking-tighter">Comparativo Detalhado</h3>
              </div>
              <CardContent className="p-0 overflow-x-auto">
                 <Table className="w-full">
                    <thead className="bg-muted/10">
                       <tr className="border-b">
                          <th className="font-black uppercase text-[10px] p-6 text-left">Descrição</th>
                          <th className="font-black uppercase text-[10px] text-right p-6">Outras Plataformas</th>
                          <th className="font-black uppercase text-[10px] text-right p-6 text-secondary italic">Viby</th>
                       </tr>
                    </thead>
                    <tbody className="text-sm font-bold divide-y">
                       <tr>
                          <td className="p-6">Taxa do Organizador</td>
                          <td className="text-right p-6 text-red-500">-{formatCurrency(result.competitor.orgFee)}</td>
                          <td className="text-right p-6 text-green-600">-{formatCurrency(result.viby.orgFee)}</td>
                       </tr>
                       <tr>
                          <td className="p-6">Taxa do Comprador</td>
                          <td className="text-right p-6">{formatCurrency(result.competitor.buyerFee)}</td>
                          <td className="text-right p-6">{formatCurrency(result.viby.buyerFee)}</td>
                       </tr>
                       <tr className="bg-muted/5 font-black">
                          <td className="p-6">Total Arrecadado (Bruto)</td>
                          <td className="text-right p-6">{formatCurrency(result.grossRevenue)}</td>
                          <td className="text-right p-6">{formatCurrency(result.grossRevenue)}</td>
                       </tr>
                       <tr className="bg-secondary/5">
                          <td className="p-6 text-lg italic text-primary">O ORGANIZADOR RECEBE</td>
                          <td className="text-right p-6 text-lg italic">{formatCurrency(result.competitor.netOrganizer)}</td>
                          <td className="text-right p-6 text-2xl font-black italic text-primary">{formatCurrency(result.viby.netOrganizer)}</td>
                       </tr>
                    </tbody>
                 </Table>
              </CardContent>
           </Card>

           {result.savings.absolute > 0 && (
             <div className="p-10 bg-green-50 rounded-[3rem] border-2 border-dashed border-green-200 text-center space-y-4">
                <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg">
                   <TrendingUp className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                   <h2 className="text-3xl font-black uppercase italic tracking-tighter text-green-800">
                     Sua margem é {Math.round(result.savings.percent)}% maior na Viby
                   </h2>
                   <p className="text-xs font-bold text-green-700 uppercase tracking-widest">Garantimos a melhor performance financeira para o seu evento</p>
                </div>
             </div>
           )}

           <div className="space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-2">Projeções de Escala</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 {[500, 1000, 2000].map(q => {
                   const r = calculateSimulation(q, value, competitionBuyer, activeConfig);
                   return (
                     <Card key={q} className="border-none shadow-sm rounded-3xl bg-white p-6 space-y-4 hover:shadow-md transition-all">
                        <div className="flex justify-between items-start">
                           <Badge variant="outline" className="text-[8px] font-black uppercase">{q} Ingressos</Badge>
                           <Users className="w-4 h-4 opacity-20" />
                        </div>
                        <div className="space-y-0.5">
                           <p className="text-[9px] font-bold text-muted-foreground uppercase">Economia Prevista</p>
                           <p className="text-xl font-black text-secondary">{formatCurrency(r.savings.absolute)}</p>
                        </div>
                     </Card>
                   );
                 })}
              </div>
           </div>

           <div className="flex justify-center pt-6">
              <Button asChild className="h-16 px-12 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-105 transition-all">
                 <Link href="/cadastro">Falar com um Consultor <ArrowRight className="ml-2 w-5 h-5" /></Link>
              </Button>
           </div>
        </div>
      </section>
    </div>
  );
}

function Table({ children, className }: { children: React.ReactNode, className?: string }) {
  return <table className={cn("w-full border-collapse", className)}>{children}</table>;
}

function TableHeader({ children, className }: { children: React.ReactNode, className?: string }) {
  return <thead className={className}>{children}</thead>;
}

function TableBody({ children, className }: { children: React.ReactNode, className?: string }) {
  return <tbody className={className}>{children}</tbody>;
}

function TableRow({ children, className }: { children: React.ReactNode, className?: string }) {
  return <tr className={className}>{children}</tr>;
}

function TableHead({ children, className }: { children: React.ReactNode, className?: string }) {
  return <th className={className}>{children}</th>;
}

function TableCell({ children, className }: { children: React.ReactNode, className?: string }) {
  return <td className={className}>{children}</td>;
}
