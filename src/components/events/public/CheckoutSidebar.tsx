
"use client"

import * as React from "react"
import { ShoppingCart, Ticket, Calendar, MapPin, Layers, Armchair, ArrowRight, ShieldCheck, Clock, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, calculateFinancialBreakdown } from "@/lib/financial-utils"
import { useDoc, useFirestore } from "@/firebase"
import { doc } from "firebase/firestore"
import { cn } from "@/lib/utils"

export function CheckoutSidebar({ event, selectedTicketType, quantity, selectedSector, selectedSeat, onConfirm }: any) {
  const db = useFirestore()
  const feesRef = React.useMemo(() => db ? doc(db, 'settings', 'fees') : null, [db])
  const { data: globalFees } = useDoc<any>(feesRef)

  const breakdown = React.useMemo(() => {
    if (!selectedTicketType) return null;
    return calculateFinancialBreakdown(selectedTicketType.price, globalFees);
  }, [selectedTicketType, globalFees]);

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "A definir";
    const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const formatTime = (dateValue: any) => {
    if (!dateValue) return "";
    const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white border-t-8 border-secondary overflow-hidden">
      <CardHeader className="bg-primary/5 p-8 border-b pb-6">
        <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-2">
           <ShoppingCart className="w-5 h-5 text-secondary" /> Bilheteria
        </CardTitle>
        <CardDescription className="font-bold text-[10px] uppercase tracking-widest">Resumo da Seleção</CardDescription>
      </CardHeader>

      <CardContent className="p-8 space-y-8">
        {!selectedTicketType ? (
          <div className="py-12 text-center space-y-4">
             <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto opacity-20">
                <Ticket className="w-8 h-8" />
             </div>
             <p className="text-[10px] font-black uppercase text-muted-foreground/60 leading-tight">Escolha um ingresso na lista ao lado para continuar.</p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
             {/* DETALHES DO ITEM SELECIONADO */}
             <div className="space-y-4">
                <div className="flex justify-between items-start">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-muted-foreground/60">Evento</p>
                      <h4 className="font-bold text-sm uppercase leading-tight line-clamp-2">{event.title}</h4>
                   </div>
                   <Badge variant="outline" className="text-[9px] font-black uppercase h-5">{selectedTicketType.name}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 bg-muted/20 rounded-2xl border border-dashed px-4">
                   <div className="space-y-0.5">
                      <p className="text-[8px] font-black uppercase text-muted-foreground/60 flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> Data</p>
                      <p className="text-[10px] font-bold uppercase">{formatDate(event.date)} às {formatTime(event.date)}</p>
                   </div>
                   <div className="space-y-0.5 text-right">
                      <p className="text-[8px] font-black uppercase text-muted-foreground/60 flex items-center gap-1 justify-end"><MapPin className="w-2.5 h-2.5" /> Local</p>
                      <p className="text-[10px] font-bold uppercase truncate">{event.city}</p>
                   </div>
                </div>

                {(selectedSector || selectedSeat) && (
                   <div className="flex items-center gap-4 p-4 bg-secondary/5 rounded-2xl border border-secondary/10">
                      {selectedSector && (
                        <div className="flex-1 space-y-0.5">
                           <p className="text-[8px] font-black uppercase text-secondary/60 flex items-center gap-1"><Layers className="w-2.5 h-2.5" /> Setor</p>
                           <p className="text-[10px] font-black uppercase text-primary">{selectedSector.nome || selectedSector.name}</p>
                        </div>
                      )}
                      {selectedSeat && (
                        <div className="flex-1 space-y-0.5 text-right">
                           <p className="text-[8px] font-black uppercase text-secondary/60 flex items-center gap-1 justify-end"><Armchair className="w-2.5 h-2.5" /> Lugar</p>
                           <p className="text-sm font-black text-secondary uppercase italic">{selectedSeat.codigo}</p>
                        </div>
                      )}
                   </div>
                )}
             </div>

             <Separator className="border-dashed" />

             {/* TOTALIZAÇÃO */}
             <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold uppercase opacity-60">
                   <span>Ingresso (x{quantity})</span>
                   <span>{formatCurrency(selectedTicketType.price * quantity)}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold uppercase opacity-60">
                   <span>Taxa de Serviço</span>
                   <span>{formatCurrency(breakdown!.administrativeFeeAmount * quantity)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                   <span className="text-sm font-black uppercase italic tracking-widest text-primary">Total Final</span>
                   <span className="text-2xl font-black text-primary">{formatCurrency(breakdown!.customerFinalPrice * quantity)}</span>
                </div>
             </div>

             <div className="p-4 bg-muted/30 rounded-2xl flex gap-3">
                <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
                <p className="text-[10px] font-medium text-muted-foreground leading-tight uppercase">Pagamento processado em ambiente seguro via Stripe.</p>
             </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-8 pt-0">
        <Button 
          disabled={!selectedTicketType} 
          onClick={onConfirm}
          className={cn(
            "w-full h-16 rounded-2xl font-black uppercase italic text-lg shadow-2xl transition-all gap-3",
            selectedTicketType ? "bg-secondary text-white hover:scale-[1.02]" : "bg-muted text-muted-foreground/30"
          )}
        >
          {selectedTicketType ? <><ArrowRight className="w-6 h-6" /> Adicionar ao Carrinho</> : "Selecione um Ingresso"}
        </Button>
      </CardFooter>
    </Card>
  )
}
