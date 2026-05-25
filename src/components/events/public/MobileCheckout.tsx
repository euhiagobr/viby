
"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { ShoppingCart, ArrowRight } from "lucide-react"
import { formatCurrency } from "@/lib/financial-utils"

export function MobileCheckout({ event, selectedTicketType, quantity, onConfirm }: any) {
  if (!selectedTicketType) return null;

  const total = (selectedTicketType.price * 1.15) * quantity;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[60] p-4 bg-background/80 backdrop-blur-2xl border-t border-border/40 animate-in slide-in-from-bottom-full duration-500">
      <div className="max-w-md mx-auto flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Total</p>
          <p className="text-xl font-black text-primary leading-none">{formatCurrency(total)}</p>
          <p className="text-[8px] font-bold text-secondary uppercase">Taxas inclusas</p>
        </div>
        
        <Button 
          onClick={onConfirm}
          className="flex-1 h-14 bg-secondary text-white font-black rounded-xl shadow-lg uppercase italic text-xs gap-2"
        >
          Finalizar Compra <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
