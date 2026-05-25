
"use client"

import * as React from "react"
import { Ticket, Layers, Info, CheckCircle2, ChevronRight, Armchair, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/financial-utils"
import { cn } from "@/lib/utils"

export function TicketSection({ 
  event, 
  setores, 
  selectedSector, 
  setSelectedSector, 
  selectedSeat, 
  setSelectedSeat,
  selectedTicketType,
  setSelectedTicketType,
  quantity,
  setQuantity
}: any) {
  const isSectorMode = event.ticketMode === 'sector_batches';

  // Identifica o lote ativo para o setor/evento global
  const getActiveBatch = (sectorOrEvent: any) => {
    if (!sectorOrEvent?.batches) return null;
    const now = new Date();
    return sectorOrEvent.batches.find((b: any) => {
      const start = b.startDate ? new Date(b.startDate) : null;
      const end = b.endDate ? new Date(b.endDate) : null;
      return (!start || now >= start) && (!end || now <= end);
    }) || sectorOrEvent.batches[0];
  };

  const activeBatch = React.useMemo(() => {
    if (isSectorMode) return selectedSector ? getActiveBatch(selectedSector) : null;
    return getActiveBatch(event);
  }, [event, isSectorMode, selectedSector]);

  const handleSelectSector = (s: any) => {
    setSelectedSector(s);
    setSelectedSeat(null);
    setSelectedTicketType(null);
  };

  const handleSelectTicket = (t: any) => {
    setSelectedTicketType({ ...t, _batch: activeBatch });
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Bilheteria</h2>
        <div className="flex items-center gap-2">
           {event.mapMode !== 'none' && (
             <Badge className="bg-secondary/10 text-secondary border-none uppercase text-[8px] font-black h-5">Lugar Marcado</Badge>
           )}
           <Badge variant="outline" className="uppercase text-[8px] font-black h-5 opacity-40">Entrada Digital</Badge>
        </div>
      </div>

      {isSectorMode && (
        <div className="space-y-4">
           <p className="text-xs font-bold uppercase tracking-tight text-primary px-1">1. Escolha o Setor</p>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {event.sectors?.map((s: any) => (
               <Card 
                 key={s.id} 
                 onClick={() => handleSelectSector(s)}
                 className={cn(
                   "cursor-pointer transition-all rounded-2xl border-2 hover:shadow-md",
                   selectedSector?.id === s.id ? "border-secondary bg-secondary/5 ring-4 ring-secondary/5" : "border-border/40 bg-white"
                 )}
               >
                 <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="p-3 rounded-xl bg-muted group-hover:bg-secondary/10 transition-colors">
                          <Layers className={cn("w-5 h-5", selectedSector?.id === s.id ? "text-secondary" : "text-muted-foreground")} />
                       </div>
                       <div>
                          <h4 className="font-black uppercase italic tracking-tighter text-primary">{s.name}</h4>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">{s.capacity} Lugares Totais</p>
                       </div>
                    </div>
                    {selectedSector?.id === s.id ? <CheckCircle2 className="w-5 h-5 text-secondary" /> : <ChevronRight className="w-5 h-5 text-muted-foreground/20" />}
                 </CardContent>
               </Card>
             ))}
           </div>
        </div>
      )}

      {(activeBatch) && (
        <div className="space-y-6 pt-4 animate-in slide-in-from-top-4 duration-500">
           <p className="text-xs font-bold uppercase tracking-tight text-primary px-1">
             {isSectorMode ? `2. Selecione os ingressos em ${selectedSector.name}` : 'Escolha seu ingresso'}
           </p>

           <div className="grid grid-cols-1 gap-4">
             {activeBatch.ticketTypes?.map((t: any) => (
               <Card 
                 key={t.id} 
                 onClick={() => handleSelectTicket(t)}
                 className={cn(
                   "cursor-pointer transition-all rounded-3xl border-2 overflow-hidden",
                   selectedTicketType?.id === t.id ? "border-secondary bg-secondary/5 ring-4 ring-secondary/5" : "border-border/40 bg-white"
                 )}
               >
                 <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                       <div className={cn("p-4 rounded-2xl", selectedTicketType?.id === t.id ? "bg-secondary text-white" : "bg-muted text-primary/40")}>
                          <Ticket className="w-6 h-6" />
                       </div>
                       <div className="space-y-1">
                          <h4 className="font-black text-xl uppercase italic tracking-tighter text-primary leading-none">{t.name}</h4>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">{activeBatch.name}</p>
                          {t.requiresProof && (
                            <div className="flex items-center gap-1.5 text-[8px] font-black text-secondary uppercase bg-secondary/5 w-fit px-2 py-0.5 rounded">
                               <Info className="w-2.5 h-2.5" /> Exige Comprovação
                            </div>
                          )}
                       </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-10">
                       <div className="text-right">
                          <p className="text-2xl font-black text-primary">{t.price === 0 ? "Grátis" : formatCurrency(t.price)}</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">+ Taxas aplicáveis</p>
                       </div>
                       {selectedTicketType?.id === t.id ? (
                          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg"><CheckCircle2 className="w-5 h-5" /></div>
                       ) : (
                          <div className="w-8 h-8 rounded-full border-2 border-muted flex items-center justify-center"><ChevronRight className="w-4 h-4 text-muted-foreground" /></div>
                       )}
                    </div>
                 </CardContent>
               </Card>
             ))}
           </div>
        </div>
      )}

      {(!activeBatch && !isSectorMode) && (
        <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center gap-4">
           <AlertCircle className="w-12 h-12 text-muted-foreground opacity-10" />
           <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Vendas não iniciadas ou encerradas.</p>
        </div>
      )}
    </div>
  )
}
