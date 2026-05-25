
"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Ticket, ArrowRight, Layers, Armchair, Wallet, CheckCircle2 } from "lucide-react"
import { formatCurrency } from "@/lib/financial-utils"
import { Badge } from "@/components/ui/badge"

export function CheckoutSidebar({ event, selectedTicketType, quantity, selectedSector, selectedSeat, onConfirm }: any) {
  const hasSelection = !!selectedTicketType;

  return (
    <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white border-t-8 border-secondary overflow-hidden">
      <CardHeader className="p-8 pb-4">
        <CardTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-2">
           <Wallet className="w-6 h-6 text-secondary" /> Bilheteria
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-8 space-y-8">
         {hasSelection ? (
           <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <div className="p-6 bg-muted/30 rounded-[1.5rem] border border-border/40 space-y-4">
                 <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                       <h4 className="font-black text-lg uppercase italic tracking-tighter text-primary leading-tight">{selectedTicketType.name}</h4>
                       <Badge variant="secondary" className="text-[8px] font-black uppercase">{selectedTicketType._batch?.name}</Badge>
                    </div>
                    <span className="font-black text-primary">{formatCurrency(selectedTicketType.price)}</span>
                 </div>
                 
                 {(selectedSector || selectedSeat) && (
                   <div className="pt-4 border-t border-dashed border-border/60 space-y-2">
                      {selectedSector && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                           <Layers className="w-3.5 h-3.5 text-secondary" /> {selectedSector.name}
                        </div>
                      )}
                      {selectedSeat && (
                        <div className="flex items-center gap-2 text-[10px] font-black text-secondary uppercase">
                           <Armchair className="w-3.5 h-3.5" /> Lugar: {selectedSeat.codigo}
                        </div>
                      )}
                   </div>
                 )}
              </div>

              <div className="space-y-4">
                 <div className="flex justify-between text-[11px] font-bold uppercase opacity-50">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedTicketType.price * quantity)}</span>
                 </div>
                 <div className="flex justify-between text-[11px] font-bold uppercase opacity-50">
                    <span>Taxas Administrativas</span>
                    <span className="text-secondary">+ {formatCurrency((selectedTicketType.price * 0.15) * quantity)}</span>
                 </div>
                 <div className="flex justify-between items-center pt-2 border-t border-dashed">
                    <span className="text-lg font-black uppercase italic text-primary">Total</span>
                    <span className="text-3xl font-black text-secondary">{formatCurrency((selectedTicketType.price * 1.15) * quantity)}</span>
                 </div>
              </div>
           </div>
         ) : (
           <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                 <Ticket className="w-8 h-8 text-muted-foreground opacity-20" />
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase leading-relaxed max-w-[180px] mx-auto">Selecione um setor e ingresso para continuar.</p>
           </div>
         )}
      </CardContent>

      <CardFooter className="p-8 pt-0">
         <Button 
           onClick={onConfirm} 
           disabled={!hasSelection}
           className="w-full h-16 bg-secondary text-white font-black text-lg rounded-2xl shadow-xl uppercase italic group transition-all hover:scale-[1.02]"
         >
           Comprar agora
           <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
         </Button>
      </CardFooter>
    </Card>
  )
}
