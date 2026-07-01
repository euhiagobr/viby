'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calculator, 
  Info, 
  CheckCircle2, 
  Coins, 
  Zap,
  ShoppingBag,
  User,
  Building2,
  TrendingUp,
  Percent
} from 'lucide-react';
import { calculateVibyOfficialSplit, isTemporalActive } from '@/lib/financial-utils';
import { useCurrency, CurrencyCode } from '@/contexts/CurrencyContext';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

interface ExperienceRevenueSimulatorProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  organization: any;
}

export function ExperienceRevenueSimulator({ isOpen, onOpenChange, organization }: ExperienceRevenueSimulatorProps) {
  const { formatPrice, currency, rates } = useCurrency();
  const db = useFirestore();
  
  const [priceInput, setPriceInput] = React.useState("100.00");
  const [qtyInput, setQtyInput] = React.useState("1");

  const feesRef = React.useMemo(() => (db ? doc(db, 'settings', 'fees') : null), [db]);
  const { data: globalFees } = useDoc<any>(feesRef);

  const promosRef = React.useMemo(() => (db ? doc(db, 'settings', 'promotions') : null), [db]);
  const { data: promotions } = useDoc<any>(promosRef);

  const results = React.useMemo(() => {
    const facePrice = parseFloat(priceInput) || 0;
    const qty = Math.max(1, parseInt(qtyInput) || 1);
    
    // Consome a mesma função de cálculo do Checkout e do Motor Fiscal
    const split = calculateVibyOfficialSplit(
      facePrice, 
      currency as CurrencyCode, 
      rates, 
      organization, 
      globalFees, 
      promotions, 
      'experience'
    );

    return {
      ...split,
      qty,
      totalGross: Number((split.facePrice * qty).toFixed(2)),
      totalNet: Number((split.organizerNet * qty).toFixed(2)),
      totalFees: Number((split.vibyApplicationFee * qty).toFixed(2)),
      totalBuyerPays: Number((split.totalCharged * qty).toFixed(2))
    };
  }, [priceInput, qtyInput, currency, rates, organization, globalFees, promotions]);

  const configOrigin = React.useMemo(() => {
    const v2Override = organization?.financialOverrides?.experience;
    if (isTemporalActive(v2Override?.validFrom, v2Override?.validTo) && v2Override?.commissionPercent != null) {
      return "Página de Taxas da Experiência (Override)";
    }
    return "Configuração Global da Plataforma";
  }, [organization]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden p-0">
        <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
              <Calculator className="w-5 h-5" />
            </div>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Simular Ganhos</DialogTitle>
          </div>
          <DialogDescription className="font-bold text-[10px] uppercase text-muted-foreground tracking-widest">
            Entenda como suas taxas de experiência são aplicadas
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-8 overflow-y-auto max-h-[60vh]">
          {/* ORIGEM E REGRAS ATIVAS */}
          <div className="space-y-4">
             <div className="flex items-center justify-between px-1">
                <Label className="text-[10px] font-black uppercase opacity-60">Origem da Regra</Label>
                <Badge variant="secondary" className="bg-secondary/10 text-secondary border-none text-[8px] font-black uppercase px-2 h-5">
                   {configOrigin}
                </Badge>
             </div>
             
             <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-muted/20 rounded-2xl border border-dashed flex flex-col gap-1">
                   <span className="text-[8px] font-black uppercase opacity-40">Sua Comissão (Retida)</span>
                   <span className="text-sm font-black text-primary italic">
                      {((results.organizerFee / (results.facePrice || 1)) * 100).toFixed(1)}%
                   </span>
                </div>
                <div className="p-4 bg-muted/20 rounded-2xl border border-dashed flex flex-col gap-1">
                   <span className="text-[8px] font-black uppercase opacity-40">Taxa do Cliente (Markup)</span>
                   <span className="text-sm font-black text-primary italic">
                      {((results.buyerFee / (results.facePrice || 1)) * 100).toFixed(1)}%
                   </span>
                </div>
             </div>
          </div>

          <Separator className="border-dashed" />

          {/* CALCULADORA */}
          <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Preço do Ingresso (P)</Label>
                   <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black opacity-30">
                        {currency === 'BRL' ? 'R$' : '$'}
                      </span>
                      <Input 
                        type="number" 
                        value={priceInput} 
                        onChange={(e) => setPriceInput(e.target.value)}
                        className="h-11 rounded-xl pl-8 font-black text-secondary border-secondary/20" 
                      />
                   </div>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Quantidade</Label>
                   <Input 
                     type="number" 
                     value={qtyInput} 
                     onChange={(e) => setQtyInput(e.target.value)}
                     className="h-11 rounded-xl font-bold" 
                   />
                </div>
             </div>

             <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center text-xs font-bold uppercase opacity-60">
                   <span className="flex items-center gap-2"><User className="w-3 h-3" /> Cliente paga (Final)</span>
                   <span className="text-primary">{formatPrice(results.totalBuyerPays, currency as CurrencyCode)}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold uppercase text-red-500">
                   <span className="flex items-center gap-1.5"><TrendingUp className="w-3 h-3" /> Total Taxas (Viby)</span>
                   <span className="font-black">-{formatPrice(results.totalFees, currency as CurrencyCode)}</span>
                </div>
             </div>

             <div className="bg-green-50 p-8 rounded-[2rem] border-2 border-dashed border-green-200 flex flex-col items-center text-center gap-2 animate-in zoom-in-95">
                <p className="text-[10px] font-black uppercase text-green-700 tracking-widest flex items-center gap-2">
                   <CheckCircle2 className="w-3.5 h-3.5" /> Você recebe
                </p>
                <p className="text-5xl font-black text-green-600 italic tracking-tighter">
                   {formatPrice(results.totalNet, currency as CurrencyCode)}
                </p>
                <p className="text-[8px] font-bold text-green-800/40 uppercase">Líquido de comissões por {results.qty} un.</p>
             </div>
          </div>

          <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
            <Zap className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
            <p className="text-[9px] text-secondary font-bold leading-relaxed uppercase italic">
              A Viby utiliza o modelo de Taxa Dupla: o comprador paga um markup sobre o preço, e o organizador paga uma comissão sobre a venda. Ambos os valores compõem a receita da plataforma.
            </p>
          </div>
        </div>

        <DialogFooter className="p-6 bg-muted/30 border-t shrink-0">
          <Button onClick={() => onOpenChange(false)} className="w-full bg-primary text-white font-black h-12 rounded-xl uppercase italic">
             Voltar à Gestão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}