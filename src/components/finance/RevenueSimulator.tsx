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
  ArrowRight, 
  Info, 
  CheckCircle2, 
  Coins, 
  TrendingUp, 
  User, 
  Building2,
  Percent,
  Wallet,
  Zap,
  Ticket,
  Sparkles
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
  const [priceInput, setPriceInput] = React.useState("50.00")
  const [type, setType] = React.useState<ProductType>('event')

  const results = React.useMemo(() => {
    const facePrice = parseFloat(priceInput) || 0
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
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Simulador v2</DialogTitle>
          </div>
          <DialogDescription className="font-bold text-[10px] uppercase text-muted-foreground tracking-widest">
            Teste a rentabilidade com base no tipo de produto
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Preço de Face</Label>
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
                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Tipo de Venda</Label>
                <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-xl">
                   <Button variant={type === 'event' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[8px] font-black uppercase" onClick={() => setType('event')}><Ticket className="w-3 h-3 mr-1" /> Evento</Button>
                   <Button variant={type === 'experience' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[8px] font-black uppercase" onClick={() => setType('experience')}><Sparkles className="w-3 h-3 mr-1" /> Experiência</Button>
                </div>
             </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-bold">
                 <span className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-tight">
                    <User className="w-3.5 h-3.5" /> Cliente Paga
                 </span>
                 <span className="text-primary">{formatPrice(results.totalCharged, currency)}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-bold">
                 <span className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-tight">
                    <Percent className="w-3.5 h-3.5" /> Comissão Viby
                 </span>
                 <div className="flex flex-col items-end">
                    <span className={cn(results.organizerFee > 0 ? "text-red-500" : "text-green-600")}>
                      {results.organizerFee > 0 ? `-${formatPrice(results.organizerFee, currency)}` : "ISENTO"}
                    </span>
                 </div>
              </div>
            </div>

            <Separator className="border-dashed" />

            <div className="bg-green-50 p-6 rounded-[2rem] border-2 border-dashed border-green-200 flex flex-col items-center text-center gap-2">
               <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-green-700 tracking-widest">Seu Repasse Líquido</p>
                  <p className="text-4xl font-black text-green-600 italic tracking-tighter">{formatPrice(results.organizerNet, currency)}</p>
               </div>
               {isLowPriceRuleActive && (
                  <Badge className="h-5 text-[8px] font-black uppercase bg-green-500 text-white border-none animate-pulse">Low Price Protection Ativa</Badge>
               )}
            </div>
          </div>

          <div className="p-4 bg-muted/20 rounded-2xl border border-dashed flex items-start gap-3">
            <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
            <p className="text-[9px] text-muted-foreground font-bold uppercase leading-relaxed">
              O simulador v2 considera a hierarquia de overrides configurada para a marca e o productType selecionado.
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
