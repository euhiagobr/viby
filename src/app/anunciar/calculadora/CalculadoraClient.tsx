'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Coins, 
  Ticket,
  Building2, 
  ShieldCheck,
  Search,
  Loader2,
  X,
  ShoppingBag,
  Info,
  MousePointer2
} from 'lucide-react';
import { formatCurrency } from '@/lib/financial-utils';
import { calculateSimulation } from '@/lib/simulation-utils';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { validateSimulationCodeAction } from '@/app/actions/simulation';

const VIBY_DEFAULT_CONFIG = {
  orgPercent: 10,
  orgMin: 3.99,
  buyerPercent: 15
};

export default function CalculadoraClient() {
  const searchParams = useSearchParams();

  const [qty, setQty] = React.useState(Number(searchParams.get('qtd')) || 100);
  const [value, setValue] = React.useState(Number(searchParams.get('valor')) || 50);
  const [competitionBuyer, setCompetitionBuyer] = React.useState(Number(searchParams.get('concorrencia')) || 20);
  const [promoCode, setPromoCode] = React.useState(searchParams.get('codigo') || "");
  
  const [activeConfig, setActiveConfig] = React.useState(VIBY_DEFAULT_CONFIG);
  const [appliedCode, setAppliedCode] = React.useState<string | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);

  const result = React.useMemo(() => {
    return calculateSimulation(qty, value, competitionBuyer, activeConfig);
  }, [qty, value, competitionBuyer, activeConfig]);

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (appliedCode) params.set('codigo', appliedCode);
    params.set('qtd', qty.toString());
    params.set('valor', value.toString());
    params.set('concorrencia', competitionBuyer.toString());
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [qty, value, competitionBuyer, appliedCode]);

  const handleApplyCode = async (codeToUse?: string) => {
    const code = codeToUse || promoCode;
    if (!code) return;

    setIsValidating(true);
    try {
      const res = await validateSimulationCodeAction(code);
      
      if (res.success && res.data) {
        setActiveConfig(res.data);
        setAppliedCode(code.toUpperCase());
        toast({ title: "Campanha aplicada!", description: "As taxas da simulação foram atualizadas via servidor." });
      } else {
        toast({ variant: "destructive", title: "Atenção", description: res.error || "Utilizando taxas padrão." });
        setAppliedCode(null);
        setActiveConfig(VIBY_DEFAULT_CONFIG);
      }
    } catch (e) {
      setAppliedCode(null);
    } finally {
      setIsValidating(false);
    }
  };

  React.useEffect(() => {
    const code = searchParams.get('codigo');
    if (code && !appliedCode) {
       handleApplyCode(code);
    }
  }, [searchParams, appliedCode]);

  const removeCode = () => {
    setAppliedCode(null);
    setPromoCode("");
    setActiveConfig(VIBY_DEFAULT_CONFIG);
  };

  return (
    <div className="space-y-16 animate-in fade-in duration-700">
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Lado Esquerdo: Configurações */}
        <div className="lg:col-span-5 space-y-8">
           <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden p-1">
              <div className="p-8 space-y-8">
                 <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-secondary ml-1">Configurações de Simulação</Label>
                    
                    <div className="space-y-2">
                       <Label className="text-xs font-bold uppercase opacity-60">Código Especial (Opcional)</Label>
                       <div className="flex gap-2">
                          <div className="relative flex-1">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-30" />
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
                             <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black opacity-30">R$</span>
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

                 <div className="space-y-8">
                    <div className="space-y-4">
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
                    </div>

                    <div className="space-y-2 p-4 bg-muted/20 rounded-2xl border border-dashed">
                       <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-secondary">Taxa Comprador Viby</Label>
                          <Badge className="bg-secondary text-white font-black">{activeConfig.buyerPercent}%</Badge>
                       </div>
                       <p className="text-[9px] text-muted-foreground font-medium uppercase italic leading-tight mt-1">
                          {appliedCode ? "Valor reduzido via código promocional" : "Taxa padrão da plataforma aplicada ao comprador."}
                       </p>
                       {appliedCode && (
                        <div className="mt-3 pt-3 border-t border-dashed border-secondary/20 flex gap-2 items-start animate-in fade-in slide-in-from-top-1">
                           <Info className="w-3.5 h-3.5 text-secondary shrink-0" />
                           <p className="text-[8px] font-bold text-secondary uppercase leading-tight">
                              A taxa é válida pelos primeiros 30 dias de evento cadastrado na plataforma. A taxa é válida para uma organização.
                           </p>
                        </div>
                       )}
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-muted/30 border-t flex flex-col items-center justify-center gap-1">
                 <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-secondary opacity-40" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Simulação comercial baseada em médias de mercado</p>
                 </div>
                 <p className="text-[8px] font-bold uppercase text-muted-foreground opacity-30 italic">Aplicamos uma taxa média de 12% aos outros concorrentes</p>
              </div>
           </Card>

           <div className="p-8 bg-secondary/5 rounded-[3rem] border-2 border-dashed border-secondary/20 space-y-4">
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-primary">Por que a Viby é melhor?</h3>
              <ul className="space-y-3">
                 <li className="flex items-center gap-3 text-sm font-bold text-primary/80"><CheckCircle2 className="w-5 h-5 text-green-500" /> Infraestrutura global via Stripe Connect</li>
                 <li className="flex items-center gap-3 text-sm font-bold text-primary/80"><CheckCircle2 className="w-5 h-5 text-green-500" /> Sem custos ocultos ou taxas de saque</li>
                 <li className="flex items-center gap-3 text-sm font-bold text-primary/80"><CheckCircle2 className="w-5 h-5 text-green-500" /> Tecnologia de ponta inclusa</li>
              </ul>
           </div>
        </div>

        {/* Lado Direito: Resultados */}
        <div className="lg:col-span-7 space-y-16">
           
           {/* SEÇÃO 1: ORGANIZADOR */}
           <div className="space-y-6">
              <div className="flex items-center gap-3 px-2">
                 <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><Coins className="w-5 h-5" /></div>
                 <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">💰 Quanto você recebe</h2>
              </div>

              <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
                <CardContent className="p-0 overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-muted/10">
                         <tr className="border-b">
                            <th className="font-black uppercase text-[10px] p-6 text-left">Descrição</th>
                            <th className="font-black uppercase text-[10px] text-right p-6">Concorrência</th>
                            <th className="font-black uppercase text-[10px] text-right p-6 text-secondary italic">Viby</th>
                         </tr>
                      </thead>
                      <tbody className="text-sm font-bold divide-y">
                         <tr>
                            <td className="p-6">Receita Bruta</td>
                            <td className="text-right p-6">{formatCurrency(result.grossRevenue)}</td>
                            <td className="text-right p-6">{formatCurrency(result.grossRevenue)}</td>
                         </tr>
                         <tr>
                            <td className="p-6">Taxa do Organizador</td>
                            <td className="text-right p-6 text-red-500">-{formatCurrency(result.competitor.orgFee)}</td>
                            <td className="text-right p-6 text-green-600">-{formatCurrency(result.viby.orgFee)}</td>
                         </tr>
                         <tr className="bg-secondary/5">
                            <td className="p-6 text-lg italic text-primary font-black uppercase">VOCÊ RECEBE</td>
                            <td className="text-right p-6 text-lg italic">{formatCurrency(result.competitor.netOrganizer)}</td>
                            <td className="text-right p-6 text-3xl font-black italic text-primary">{formatCurrency(result.viby.netOrganizer)}</td>
                         </tr>
                      </tbody>
                   </table>
                </CardContent>
              </Card>

              {result.savings.absolute > 0 && (
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-secondary text-white p-10 space-y-2 relative overflow-hidden text-center group transition-transform hover:scale-[1.01]">
                   <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Resultado do Período</p>
                   <h3 className="text-3xl md:text-5xl font-black italic tracking-tighter">
                      Você recebe {formatCurrency(result.savings.absolute)} a mais utilizando a Viby.
                   </h3>
                   <Zap className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 rotate-12 group-hover:scale-110 transition-transform" />
                </Card>
              )}
           </div>

           <Separator className="border-dashed" />

           {/* SEÇÃO 2: COMPRADOR */}
           <div className="space-y-6">
              <div className="flex items-center gap-3 px-2">
                 <div className="p-2 bg-primary/5 rounded-lg text-primary"><ShoppingBag className="w-5 h-5" /></div>
                 <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">🎟️ Seu cliente também paga menos</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <BuyerCard 
                    label="Concorrência" 
                    value={value} 
                    feePercent={competitionBuyer} 
                    feeValue={result.competitor.unitBuyerFee}
                    total={result.competitor.unitTotalPaid}
                    variant="neutral"
                 />
                 <BuyerCard 
                    label="Viby" 
                    value={value} 
                    feePercent={activeConfig.buyerPercent} 
                    feeValue={result.viby.unitBuyerFee}
                    total={result.viby.unitTotalPaid}
                    variant="highlight"
                 />
              </div>

              <Card className="border-none shadow-sm rounded-3xl bg-green-50 p-8 text-center border-2 border-dashed border-green-200">
                 <h3 className="text-2xl font-black text-green-700 italic uppercase tracking-tighter leading-tight">
                    Cada cliente economiza {formatCurrency(result.savings.perTicket)} por ingresso.
                 </h3>
                 <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mt-2">Menos taxa = Mais vendas convertidas</p>
              </Card>
           </div>

           <div className="flex flex-col items-center justify-center pt-6 gap-6">
              <Button asChild className="h-20 px-16 bg-primary text-white font-black rounded-[2rem] shadow-2xl uppercase italic text-2xl hover:scale-105 transition-all">
                 <Link href="/cadastro">Criar meu Evento agora <ArrowRight className="ml-2 w-8 h-8" /></Link>
              </Button>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase opacity-30">
                 <ShieldCheck className="w-4 h-4" />
                 Viby Ecosystem Commercial Simulator 2026
              </div>
           </div>
        </div>
      </section>
    </div>
  );
}

function BuyerCard({ label, value, feePercent, feeValue, total, variant }: any) {
   const isHighlight = variant === 'highlight';
   return (
      <Card className={cn(
        "border-none shadow-sm rounded-[2rem] overflow-hidden",
        isHighlight ? "ring-2 ring-secondary bg-white" : "bg-muted/30"
      )}>
         <CardHeader className={cn("p-6 border-b", isHighlight ? "bg-secondary/5" : "bg-muted/20")}>
            <CardTitle className={cn("text-[10px] font-black uppercase tracking-widest", isHighlight ? "text-secondary" : "text-muted-foreground")}>{label}</CardTitle>
         </CardHeader>
         <CardContent className="p-8 space-y-4">
            <div className="flex justify-between items-center text-sm font-bold opacity-60 uppercase">
               <span>Ingresso</span>
               <span>{formatCurrency(value)}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold opacity-60 uppercase">
               <span>Taxa ({feePercent}%)</span>
               <span>{formatCurrency(feeValue)}</span>
            </div>
            <Separator className="border-dashed" />
            <div className="flex justify-between items-center">
               <span className="text-xs font-black uppercase opacity-40">Cliente Paga</span>
               <span className={cn("text-2xl font-black italic tracking-tighter", isHighlight ? "text-primary" : "text-muted-foreground")}>{formatCurrency(total)}</span>
            </div>
         </CardContent>
      </Card>
   )
}

function TableHeader({ children, className }: any) { return <thead className={className}>{children}</thead> }
function TableBody({ children, className }: any) { return <tbody className={className}>{children}</tbody> }
function TableRow({ children, className }: any) { return <tr className={className}>{children}</tr> }
function TableHead({ children, className }: any) { return <th className={className}>{children}</th> }
function TableCell({ children, className }: any) { return <td className={className}>{children}</td> }
