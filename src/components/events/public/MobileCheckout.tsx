
"use client"

import * as React from "react"
import { ShoppingCart, ArrowRight, Ticket, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrency, calculateFinancialBreakdown } from "@/lib/financial-utils"
import { useDoc, useFirestore } from "@/firebase"
import { doc } from "firebase/firestore"
import { cn } from "@/lib/utils"

export function MobileCheckout({ event, selectedTicketType, quantity, onConfirm }: any) {
  const db = useFirestore()
  const feesRef = React.useMemo(() => db ? doc(db, 'settings', 'fees') : null, [db])
  const { data: globalFees } = useDoc<any>(feesRef)

  if (!selectedTicketType) return null;

  const breakdown = calculateFinancialBreakdown(selectedTicketType.price, globalFees);
  const total = breakdown.customerFinalPrice * quantity;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[60] p-4 animate-in slide-in-from-bottom-full duration-500">
       <div className="bg-primary text-white p-6 rounded-[2.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.2)] flex items-center justify-between gap-4 border border-white/10">
          <div className="flex flex-col gap-1">
             <div className="flex items-center gap-1.5 opacity-60">
                <Ticket className="w-3 h-3" />
                <span className="text-[9px] font-black uppercase tracking-widest">{selectedTicketType.name} (x{quantity})</span>
             </div>
             <p className="text-xl font-black italic tracking-tighter">{formatCurrency(total)}</p>
          </div>
          
          <Button 
            onClick={onConfirm}
            className="bg-secondary text-white font-black rounded-2xl h-14 px-8 shadow-xl shadow-secondary/20 uppercase italic text-sm gap-2 active:scale-95 transition-transform"
          >
             Comprar <ArrowRight className="w-5 h-5" />
          </Button>
       </div>
    </div>
  )
}
