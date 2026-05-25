"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Ticket, 
  Map as MapIcon, 
  ChevronRight, 
  Layers, 
  CheckCircle2, 
  Info,
  Clock,
  Plus,
  Minus
} from "lucide-react"
import { formatCurrency } from "@/lib/financial-utils"
import { SeatMap } from "./SeatMap"

interface TicketSectionProps {
  event: any
  setores: any[]
  selectedSector: any
  setSelectedSector: (s: any) => void
  selectedSeat: any
  setSelectedSeat: (s: any) => void
  selectedTicketType: any
  setSelectedTicketType: (t: any) => void
  quantity: number
  setQuantity: (q: number) => void
}

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
}: TicketSectionProps) {
  const [activeTab, setActiveTab] = React.useState<'setores' | 'ingressos'>('setores')

  const availableTickets = React.useMemo(() => {
    if (!selectedSector || !event.batches) return []
    
    // Se for setor e lote, busca lotes específicos do setor
    const batchesToScan = event.ticketMode === 'sector_batches' 
      ? selectedSector.batches 
      : event.batches

    const now = new Date()
    const activeBatch = (batchesToScan || []).find((b: any) => {
      const start = b.startDate ? new Date(b.startDate) : null
      const end = b.endDate ? new Date(b.endDate) : null
      return (!start || now >= start) && (!end || now <= end)
    })

    return activeBatch ? activeBatch.ticketTypes.map((t: any) => ({ ...t, _batch: activeBatch })) : []
  }, [selectedSector, event.batches, event.ticketMode])

  const handleSelectSector = (s: any) => {
    setSelectedSector(s)
    setSelectedSeat(null)
    setSelectedTicketType(null)
    setActiveTab('ingressos')
  }

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-primary">
          Bilheteria
        </h2>
        {event.mapMode !== 'none' && (
          <Badge variant="outline" className="rounded-full border-secondary text-secondary font-black uppercase text-[10px] gap-1.5 px-3 py-1">
             <MapIcon className="w-3 h-3" /> Lugar Marcado
          </Badge>
        )}
      </div>

      <div className="space-y-10">
        {/* Passos da Seleção */}
        <div className="flex items-center gap-4 overflow-x-auto pb-4 custom-scrollbar">
           <StepButton 
             active={activeTab === 'setores'} 
             done={!!selectedSector} 
             onClick={() => setActiveTab('setores')}
             label="1. Escolha o Setor"
           />
           <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
           <StepButton 
             active={activeTab === 'ingressos'} 
             disabled={!selectedSector}
             done={!!selectedTicketType && (!selectedSector?.tipo?.includes('assentos') || !!selectedSeat)}
             onClick={() => setActiveTab('ingressos')}
             label="2. Escolha o Ingresso"
           />
        </div>

        {activeTab === 'setores' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-left-4 duration-500">
             {setores?.map((s) => (
               <button
                 key={s.id}
                 onClick={() => handleSelectSector(s)}
                 className={cn(
                   "flex items-center justify-between p-6 rounded-[2rem] border-2 transition-all text-left group",
                   selectedSector?.id === s.id 
                    ? "border-secondary bg-secondary/5 shadow-lg shadow-secondary/10" 
                    : "border-border/60 bg-white hover:border-secondary/40"
                 )}
               >
                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 group-hover:text-secondary transition-colors">Setor</p>
                    <h4 className="text-xl font-black uppercase italic tracking-tighter text-primary">{s.nome}</h4>
                    <div className="flex items-center gap-2">
                       <Badge variant="outline" className="text-[8px] font-black uppercase py-0 px-2 h-4">{s.tipo}</Badge>
                       {s.tipo !== 'livre' && <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Vários Lugares</span>}
                    </div>
                 </div>
                 <div className={cn(
                   "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                   selectedSector?.id === s.id ? "bg-secondary text-white rotate-90" : "bg-muted text-muted-foreground group-hover:bg-secondary group-hover:text-white"
                 )}>
                   <ChevronRight className="w-5 h-5" />
                 </div>
               </button>
             ))}
          </div>
        )}

        {activeTab === 'ingressos' && selectedSector && (
          <div className="space-y-12 animate-in slide-in-from-right-4 duration-500">
            {/* Mapa de Assentos se aplicável */}
            {(selectedSector.tipo === 'assentos' || selectedSector.tipo === 'mesas') && (
              <div className="pt-4 border-t border-dashed border-border/60">
                 <SeatMap 
                   eventId={event.id} 
                   sector={selectedSector} 
                   selectedSeat={selectedSeat}
                   onSelectSeat={setSelectedSeat}
                 />
              </div>
            )}

            {/* Listagem de Tipos de Ingresso */}
            <div className="space-y-6">
               <div className="flex items-center gap-2 px-2">
                  <Ticket className="w-5 h-5 text-secondary" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                    Tipos de Ingresso Disponíveis
                  </h3>
               </div>

               {availableTickets.length > 0 ? (
                 <div className="grid grid-cols-1 gap-4">
                    {availableTickets.map((type: any) => (
                      <button
                        key={type.id}
                        onClick={() => setSelectedTicketType(type)}
                        className={cn(
                          "w-full p-6 rounded-[2.5rem] border-2 transition-all text-left flex flex-col sm:flex-row sm:items-center justify-between gap-6 group",
                          selectedTicketType?.id === type.id 
                            ? "border-primary bg-primary/[0.02] shadow-xl" 
                            : "border-border/40 bg-white hover:border-primary/20"
                        )}
                      >
                         <div className="space-y-3">
                            <div className="flex items-center gap-2">
                               <h4 className="text-lg font-black uppercase italic tracking-tighter">{type.name}</h4>
                               {type.requiresProof && (
                                 <Badge variant="outline" className="text-[8px] font-black uppercase border-orange-200 text-orange-600 bg-orange-50">Documento Obrigatório</Badge>
                               )}
                            </div>
                            <div className="flex flex-wrap gap-4 items-center">
                               <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase">
                                  <span className="opacity-40">Valor:</span> {formatCurrency(type.price)}
                               </div>
                               <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                                  <Clock className="w-3 h-3 text-secondary" /> Lote: {type._batch.name}
                               </div>
                            </div>
                         </div>

                         <div className="flex items-center justify-between sm:justify-end gap-6 pt-4 sm:pt-0 border-t sm:border-none border-dashed border-border/60">
                            {selectedTicketType?.id === type.id ? (
                               <div className="flex items-center gap-4 bg-primary text-white p-2 px-6 rounded-full shadow-lg animate-in zoom-in-95 duration-200">
                                  <button onClick={(e) => { e.stopPropagation(); setQuantity(Math.max(1, quantity - 1)) }} className="p-1 hover:scale-125 transition-transform"><Minus className="w-4 h-4" /></button>
                                  <span className="font-black text-lg min-w-[1ch] text-center">{quantity}</span>
                                  <button onClick={(e) => { e.stopPropagation(); setQuantity(quantity + 1) }} className="p-1 hover:scale-125 transition-transform"><Plus className="w-4 h-4" /></button>
                               </div>
                            ) : (
                               <div className="h-12 px-8 flex items-center justify-center rounded-full bg-muted text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all">
                                  Selecionar
                               </div>
                            )}
                         </div>
                      </button>
                    ))}
                 </div>
               ) : (
                 <div className="p-12 text-center bg-muted/20 rounded-[2.5rem] border-2 border-dashed">
                    <Info className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-xs font-black uppercase text-muted-foreground/60">Não há ingressos ativos para este setor no momento.</p>
                 </div>
               )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StepButton({ active, done, disabled, onClick, label }: any) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all whitespace-nowrap",
        active ? "border-primary bg-primary text-white font-black" : 
        done ? "border-green-500 bg-green-50 text-green-600 font-bold" :
        "border-border bg-muted/30 text-muted-foreground opacity-60 font-bold grayscale"
      )}
    >
      <div className={cn(
        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black",
        active ? "bg-white text-primary" : 
        done ? "bg-green-500 text-white" : "bg-muted-foreground/20 text-muted-foreground"
      )}>
        {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : active ? <div className="w-1.5 h-1.5 bg-primary rounded-full" /> : "?"}
      </div>
      <span className="text-[10px] uppercase tracking-widest">{label}</span>
    </button>
  )
}
