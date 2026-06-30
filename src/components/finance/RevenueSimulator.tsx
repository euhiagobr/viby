"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Calculator, 
  Info, 
  CheckCircle2, 
  User, 
  Percent,
  Zap,
  Ticket,
  Sparkles,
  TrendingUp,
  Coins,
  ArrowUpRight
} from "lucide-react"
import { calculateVibyOfficialSplit, ProductType } from "@/lib/financial-utils"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"
import { cn } from "@/lib/utils"

interface RevenueSimulatorProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  customFees?: any;
}

export function RevenueSimulator({ isOpen, onOpenChange, customFees }: RevenueSimulatorProps) {
  const { formatPrice, currency, rates } = useCurrency()
  const [priceInput, setPriceInput] = React.useState("100.00")
  const [type, setType] = React.useState<ProductType>('event')

  const results = React.useMemo(() => {
    const facePrice = parseFloat(priceInput) || 0
    // Auditoria: Garantir resolução de productType antes da chamada
    return calculateVibyOfficialSplit(facePrice, currency as CurrencyCode, rates, customFees, null, null, type)
  }, [priceInput, currency, rates, customFees, type])

  const facePriceNum = parseFloat(priceInput || "0");
  const isLowPriceRuleActive = facePriceNum > 0 && results.organizerFee === 0 && results.organizerNet === facePriceNum;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden p-0">
        <DialogHeader className="p-8 bg-muted/30 border-b">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
              <Calculator className="w-5 h-5" />
            </div>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Simulador de Repasse</DialogTitle>
          </div>
          <DialogDescription className="font-bold text-[10px] uppercase text-muted-foreground tracking-widest">
            Auditoria de taxas com base única (Double Fee Model)
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Preço Base (P)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black opacity-30">{currency === 'BRL' ? 'R$' : '$'}</span>
                  <Input 
                    type="number" 
                    value={priceInput} 
                    onChange={(e) => setPriceInput(e.target.value)}
                    className="h-11 rounded-xl pl-8 font-black text-secondary" 
                  />
                </div>
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Produto</Label>
                <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-xl">
                   <Button variant={type === 'event' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[8px] font-black uppercase" onClick={() => setType('event')}><Ticket className="w-3 h-3 mr-1" /> Evento</Button>
                   <Button variant={type === 'experience' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[8px] font-black uppercase" onClick={() => setType('experience')}><Sparkles className="w-3 h-3 mr-1" /> Exp.</Button>
                </div>
             </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-bold">
                 <span className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-tight">
                    <User className="w-3.5 h-3.5" /> Cliente Paga (P + Markup)
                 </span>
                 <span className="text-primary font-black">{formatPrice(results.totalCharged, currency)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold">
                 <span className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-tight">
                    <TrendingUp className="w-3.5 h-3.5 text-secondary" /> Receita Viby (Líquida)
                 </span>
                 <span className="text-secondary font-black">+{formatPrice(results.vibyApplicationFee, currency)}</span>
              </div>
            </div>
            
            <Separator className="border-dashed" />

            <div className="bg-green-50 p-8 rounded-[2rem] border-2 border-dashed border-green-200 flex flex-col items-center text-center gap-2">
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-green-700 tracking-widest">Repasse Organizador (P - Comis.)</p>
                  <p className="text-5xl font-black text-green-600 italic tracking-tighter">{formatPrice(results.organizerNet, currency)}</p>
               </div>
               {isLowPriceRuleActive && (
                  <Badge className="h-5 text-[8px] font-black uppercase bg-green-500 text-white border-none animate-pulse">Low Price Protection Ativa</Badge>
               )}
            </div>
          </div>

          <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
            <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
            <p className="text-[9px] font-black uppercase leading-relaxed">
              As taxas incidem individualmente sobre o <strong>Preço Base (P)</strong>. Não há composição de taxas sobre taxas.
            </p>
          </div>
        </div>

        <DialogFooter className="p-6 bg-muted/30 border-t">
          <Button onClick={() => onOpenChange(false)} className="w-full bg-primary text-white font-black h-12 rounded-xl uppercase italic">Fechar Simulador</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
