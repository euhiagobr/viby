"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
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
  Wallet
} from "lucide-react"
import { calculateVibyOfficialSplit } from "@/lib/financial-utils"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"
import { cn } from "@/lib/utils"

interface RevenueSimulatorProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  customFees?: {
    customBuyerMarkup?: number | null
    customOrganizerPercent?: number | null
    customOrganizerMinFee?: number | null
  }
}

export function RevenueSimulator({ isOpen, onOpenChange, customFees }: RevenueSimulatorProps) {
  const { formatPrice, currency, rates } = useCurrency()
  const [priceInput, setPriceInput] = React.useState("50.00")

  const results = React.useMemo(() => {
    const facePrice = parseFloat(priceInput) || 0
    return calculateVibyOfficialSplit(facePrice, currency as CurrencyCode, rates, customFees)
  }, [priceInput, currency, rates, customFees])

  const isMinFeeApplied = results.organizerFee > (parseFloat(priceInput || "0") * (customFees?.customOrganizerPercent ? customFees.customOrganizerPercent / 100 : 0.10))

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
            Calcule seus ganhos com base no preço do ingresso
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-8">
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Preço de Face (O que você define)</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-secondary">{currency === 'BRL' ? 'R$' : currency === 'USD' ? '$' : '€'}</span>
              <Input 
                type="number" 
                value={priceInput} 
                onChange={(e) => setPriceInput(e.target.value)}
                className="h-16 text-3xl font-black rounded-2xl pl-12 border-secondary/20 shadow-inner" 
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm font-bold">
               <span className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-tight">
                  <User className="w-3.5 h-3.5" /> Pago pelo Cliente (c/ Taxa)
               </span>
               <span className="text-primary">{formatPrice(results.totalCharged, currency)}</span>
            </div>
            
            <div className="flex justify-between items-center text-sm font-bold">
               <span className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] tracking-tight">
                  <Percent className="w-3.5 h-3.5" /> Comissão Retida pela Viby
               </span>
               <div className="flex flex-col items-end">
                  <span className="text-red-500">-{formatPrice(results.organizerFee, currency)}</span>
                  {isMinFeeApplied && (
                    <Badge className="h-4 text-[7px] font-black uppercase bg-orange-500 text-white border-none mt-1">Trava de Mínimo Ativa</Badge>
                  )}
               </div>
            </div>

            <Separator className="border-dashed" />

            <div className="bg-green-50 p-6 rounded-[2rem] border-2 border-dashed border-green-200 flex flex-col items-center text-center gap-2 relative overflow-hidden">
               <div className="relative z-10 space-y-1">
                  <p className="text-[9px] font-black uppercase text-green-700 tracking-widest">Seu Repasse Líquido</p>
                  <p className="text-4xl font-black text-green-600 italic tracking-tighter">{formatPrice(results.organizerNet, currency)}</p>
                  <p className="text-[8px] font-bold text-green-800/40 uppercase">Valor disponível após a realização do evento</p>
               </div>
               <Wallet className="absolute -bottom-4 -right-4 w-20 h-20 text-green-600/5 rotate-12" />
            </div>
          </div>

          <div className="p-4 bg-secondary/5 rounded-2xl flex gap-3 border border-secondary/10">
            <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
            <p className="text-[10px] text-secondary font-bold uppercase leading-relaxed">
              O Viby retém a porcentagem da comissão OU o valor mínimo fixo, prevalecendo sempre o que for maior para garantir a operação.
            </p>
          </div>
        </div>

        <DialogFooter className="p-6 bg-muted/30 border-t">
          <Button onClick={() => onOpenChange(false)} className="w-full bg-primary text-white font-black h-12 rounded-xl uppercase italic">Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
