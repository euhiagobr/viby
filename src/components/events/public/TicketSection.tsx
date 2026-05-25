
"use client"

import * as React from "react"
import { Ticket, Layers, Map as MapIcon, Armchair, Grid3X3, CheckCircle2, ChevronRight, X, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { useFirestore, useCollection } from "@/firebase"
import { collection, query, orderBy, getDocs } from "firebase/firestore"
import { formatCurrency } from "@/lib/financial-utils"

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
  
  const db = useFirestore()
  const [seats, setSeats] = React.useState<any[]>([])
  const [loadingSeats, setLoadingSeats] = React.useState(false)

  const hasMap = event.mapaConfigurado && setores && setores.length > 0;

  // Carrega assentos quando setor muda
  React.useEffect(() => {
    if (!db || !selectedSector || selectedSector.tipo === 'livre') {
      setSeats([])
      return
    }

    const fetchSeats = async () => {
      setLoadingSeats(true)
      try {
        const q = query(collection(db, "events", event.id, "setores", selectedSector.id, "assentos"), orderBy("codigo", "asc"))
        const snap = await getDocs(q)
        setSeats(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingSeats(false)
      }
    }

    fetchSeats()
  }, [db, event.id, selectedSector])

  // Lógica de Lote Ativo para um alvo (Evento ou Setor)
  const getActiveBatch = (target: any) => {
    if (!target) return null;
    const batches = target.batches || [];
    if (batches.length === 0) return null;
    
    const now = new Date();
    let carryOver = 0;
    
    const processed = batches.map((b: any) => {
      const start = b.startDate ? new Date(b.startDate) : null;
      const end = b.endDate ? new Date(b.endDate) : null;
      const isOpen = (!start || now >= start) && (!end || now <= end);
      const isPast = end && now > end;
      
      const currentCap = (b.capacidadeInicial || 0) + carryOver;
      const remaining = Math.max(0, currentCap - (b.vendidos || 0));
      if (isPast) carryOver = remaining; else carryOver = 0;

      return { ...b, isOpen, remaining };
    });

    return processed.find((b: any) => b.isOpen && b.remaining > 0) || null;
  }

  const activeBatch = React.useMemo(() => {
    if (event.ticketMode === 'sector_batches' || hasMap) {
       if (!selectedSector) return null;
       const target = (selectedSector.ticketLinkId === 'global' || selectedSector.ticketLinkId === 'global_batches') ? event : selectedSector;
       return getActiveBatch(target);
    }
    return getActiveBatch(event);
  }, [event, selectedSector, hasMap]);

  return (
    <section className="space-y-12">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-6 bg-secondary rounded-full" />
        <h2 className="text-2xl font-black uppercase italic tracking-tighter">Escolha seus Ingressos</h2>
      </div>

      {/* 1. PLANTA VISUAL (SE HOUVER) */}
      {hasMap && (
        <div className="space-y-6">
           <div className="flex items-center justify-between px-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2"><MapIcon className="w-3.5 h-3.5" /> Navegue pela planta</p>
              <Badge variant="outline" className="text-[8px] font-bold uppercase rounded-lg border-secondary/20 text-secondary">Interativo</Badge>
           </div>
           <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/50 backdrop-blur-md p-0 h-[400px] md:h-[600px] relative border border-white">
              <TransformWrapper initialScale={1} minScale={0.5} maxScale={3}>
                 <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                    <div className="relative min-w-[1200px] min-h-[800px] bg-white" style={{ backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 0)', backgroundSize: '30px 30px' }}>
                       {/* Palco */}
                       <div className="absolute left-[300px] top-[40px] w-[600px] h-[100px] bg-primary text-white flex items-center justify-center rounded-2xl shadow-xl border-4 border-white/10 select-none">
                          <span className="font-black italic uppercase tracking-[0.4em] text-sm">{event.palcoNome || "PALCO PRINCIPAL"}</span>
                       </div>

                       {/* Setores */}
                       {setores.map((s: any) => (
                         <div 
                           key={s.id}
                           className={cn(
                             "absolute flex flex-col items-center justify-center transition-all cursor-pointer hover:scale-105 rounded-[2.5rem] border-4",
                             selectedSector?.id === s.id ? "ring-4 ring-secondary ring-offset-4 shadow-2xl z-30" : "shadow-lg z-20 border-white/50"
                           )}
                           style={{ left: s.posX, top: s.posY, width: s.width, height: s.height, backgroundColor: `${s.cor}20`, borderColor: s.cor, color: s.cor }}
                           onClick={() => { setSelectedSector(s); setSelectedTicketType(null); setSelectedSeat(null); }}
                         >
                            <div className="text-center p-4">
                               <p className="font-black uppercase italic text-xs leading-tight mb-1">{s.nome}</p>
                               <Badge variant="outline" className="text-[7px] font-black h-3.5 border-current bg-white/80" style={{ color: s.cor }}>{s.tipo}</Badge>
                            </div>
                         </div>
                       ))}
                    </div>
                 </TransformComponent>
              </TransformWrapper>
              <div className="absolute bottom-6 right-6 p-4 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-border/50 flex flex-col gap-2">
                 <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest text-center">Legenda</p>
                 <div className="flex items-center gap-3 text-[9px] font-bold">
                    <div className="w-2.5 h-2.5 rounded-full bg-secondary" /> Selecionado
                    <div className="w-2.5 h-2.5 rounded-full bg-border" /> Livre
                 </div>
              </div>
           </Card>
        </div>
      )}

      {/* 2. GRADE DE ASSENTOS (SE APLICÁVEL) */}
      {selectedSector && ['assentos', 'mesas'].includes(selectedSector.tipo) && (
        <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                {selectedSector.tipo === 'mesas' ? <Grid3X3 className="w-4 h-4" /> : <Armchair className="w-4 h-4" />}
                Selecione seu lugar em: <span className="text-secondary">{selectedSector.nome}</span>
              </h3>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedSector(null); setSelectedSeat(null); }} className="h-6 text-[8px] uppercase font-black">X Fechar</Button>
           </div>

           <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-8 overflow-hidden">
              {loadingSeats ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
              ) : seats.length > 0 ? (
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-3">
                   {seats.map((seat) => {
                     const isTaken = ['vendido', 'bloqueado'].includes(seat.status);
                     const isSelected = selectedSeat?.id === seat.id;
                     return (
                       <button
                         key={seat.id}
                         disabled={isTaken}
                         onClick={() => setSelectedSeat(seat)}
                         className={cn(
                           "h-10 rounded-xl flex items-center justify-center font-black text-[10px] transition-all relative",
                           isTaken ? "bg-muted text-muted-foreground/20 cursor-not-allowed border-none" :
                           isSelected ? "bg-secondary text-white shadow-lg ring-2 ring-secondary ring-offset-2 scale-110" :
                           "bg-white border-2 border-border text-primary hover:border-secondary/40"
                         )}
                       >
                         {seat.codigo}
                         {isSelected && <div className="absolute -top-1.5 -right-1.5 bg-green-500 rounded-full p-0.5"><CheckCircle2 className="w-2.5 h-2.5 text-white" /></div>}
                       </button>
                     )
                   })}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground font-bold italic text-xs uppercase">Mapa de assentos não gerado.</div>
              )}
           </Card>
        </div>
      )}

      {/* 3. LISTA DE INGRESSOS (SELECIONÁVEL) */}
      <div className="space-y-6">
        {(event.ticketMode === 'sector_batches' || hasMap) && !selectedSector ? (
          <div className="py-20 text-center bg-muted/20 rounded-[3rem] border-2 border-dashed border-border flex flex-col items-center gap-4">
             <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm text-secondary">
                <Layers className="w-8 h-8" />
             </div>
             <div className="space-y-1">
               <p className="text-sm font-black uppercase italic tracking-tight text-primary">Selecione uma área do evento</p>
               <p className="text-[10px] font-bold text-muted-foreground uppercase">Clique no mapa ou nas opções de setores para ver os ingressos.</p>
             </div>
             <div className="flex flex-wrap justify-center gap-2 mt-4 px-4">
                {setores?.map((s: any) => (
                  <Button key={s.id} variant="outline" className="rounded-full font-bold h-10 px-6 uppercase text-[9px] gap-2" onClick={() => { setSelectedSector(s); setSelectedTicketType(null); setSelectedSeat(null); }}>
                    {s.nome} <ChevronRight className="w-3 h-3" />
                  </Button>
                ))}
             </div>
          </div>
        ) : !activeBatch ? (
          <div className="py-20 text-center bg-orange-50/50 rounded-[3rem] border-2 border-dashed border-orange-200">
             <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
             <p className="text-sm font-black uppercase text-orange-800 italic">Ingressos Indisponíveis</p>
             <p className="text-[10px] font-bold text-orange-600 uppercase mt-1">Este setor ou evento não possui vendas abertas no momento.</p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between px-2">
               <div className="flex items-center gap-3">
                  <Badge className="bg-secondary text-white font-black uppercase text-[10px] h-6 px-3 shadow-lg">{activeBatch.name}</Badge>
                  <p className="text-[10px] font-black uppercase text-muted-foreground/60">{activeBatch.remaining} UN. DISPONÍVEIS</p>
               </div>
               {selectedSector && (
                 <Badge variant="outline" className="rounded-lg h-6 px-3 font-black uppercase text-[10px] border-primary/10 bg-primary/5 text-primary">Setor: {selectedSector.nome}</Badge>
               )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeBatch.ticketTypes.map((type: any) => {
                const isSelected = selectedTicketType?.id === type.id;
                const isLockedBySeat = ['assentos', 'mesas'].includes(selectedSector?.tipo) && !selectedSeat;

                return (
                  <Card 
                    key={type.id} 
                    className={cn(
                      "group cursor-pointer border-2 transition-all rounded-[2rem] overflow-hidden bg-white",
                      isSelected ? "border-secondary shadow-2xl scale-[1.02]" : "border-border/40 shadow-sm hover:border-secondary/20",
                      isLockedBySeat && "opacity-40 grayscale pointer-events-none"
                    )}
                    onClick={() => { setSelectedTicketType({...type, _batch: activeBatch}); setQuantity(1); }}
                  >
                    <CardContent className="p-6 space-y-4">
                       <div className="flex justify-between items-start">
                          <div className="space-y-1">
                             <h4 className="text-lg font-black uppercase italic tracking-tighter text-primary group-hover:text-secondary transition-colors">{type.name}</h4>
                             {type.poolId && <Badge variant="secondary" className="text-[7px] h-4 uppercase gap-1 font-black"><Layers className="w-2.5 h-2.5" /> Lote Compartilhado</Badge>}
                          </div>
                          <div className="text-right">
                             <p className="text-xl font-black text-primary">{type.price === 0 ? "GRÁTIS" : formatCurrency(type.price)}</p>
                             <p className="text-[8px] font-bold text-muted-foreground uppercase">+ Taxas Plataforma</p>
                          </div>
                       </div>
                       
                       <div className="flex items-center justify-between pt-4 border-t border-dashed">
                          <div className="flex flex-col gap-1">
                             <p className="text-[9px] font-black text-muted-foreground uppercase">{type.requiresProof ? "Documento Obrigatório" : "Entrada Nominal"}</p>
                          </div>
                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                            isSelected ? "bg-secondary border-secondary text-white" : "border-muted text-transparent"
                          )}>
                             <CheckCircle2 className="w-4 h-4" />
                          </div>
                       </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {selectedSector && ['assentos', 'mesas'].includes(selectedSector.tipo) && !selectedSeat && (
              <div className="p-4 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/10 text-center animate-pulse">
                 <p className="text-[10px] font-black uppercase text-primary italic">Escolha um lugar no mapa acima para liberar a compra</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
