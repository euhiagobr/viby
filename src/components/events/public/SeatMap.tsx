"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, orderBy } from "firebase/firestore"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { cn } from "@/lib/utils"
import { 
  Maximize2, 
  Minus, 
  Plus, 
  RotateCcw, 
  Armchair, 
  Users2, 
  Info,
  CheckCircle2,
  XCircle,
  Layout
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface SeatMapProps {
  eventId: string
  sector: any
  selectedSeat: any
  onSelectSeat: (seat: any) => void
}

export function SeatMap({ eventId, sector, selectedSeat, onSelectSeat }: SeatMapProps) {
  const db = useFirestore()
  const seatsQuery = useMemoFirebase(() => {
    if (!db || !eventId || !sector?.id) return null
    return query(
      collection(db, "events", eventId, "setores", sector.id, "assentos"),
      orderBy("codigo", "asc")
    )
  }, [db, eventId, sector?.id])

  const { data: seats, loading } = useCollection<any>(seatsQuery)

  if (loading) {
    return (
      <div className="h-[400px] flex items-center justify-center bg-muted/20 rounded-3xl border-2 border-dashed">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    )
  }

  const isMarkedPlaces = sector.tipo === 'assentos' || sector.tipo === 'mesas'

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-2">
         <div className="space-y-1">
            <h3 className="font-black italic uppercase text-primary tracking-tighter">
              {sector.nome}
            </h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">
              {isMarkedPlaces ? "Selecione seu lugar no mapa abaixo" : "Entrada livre neste setor"}
            </p>
         </div>
         <Badge variant="outline" className="text-[10px] font-black uppercase border-secondary text-secondary">
           {sector.tipo === 'assentos' ? <Armchair className="w-3 h-3 mr-1.5" /> : <Users2 className="w-3 h-3 mr-1.5" />}
           {sector.tipo}
         </Badge>
      </div>

      {isMarkedPlaces ? (
        <div className="relative group">
           <Card className="border-none shadow-inner bg-muted/20 rounded-[2.5rem] overflow-hidden border-2 border-dashed border-border/40">
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={4}
                centerOnInit
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <React.Fragment>
                    <div className="absolute top-6 right-6 z-20 flex flex-col gap-2">
                       <Button size="icon" variant="secondary" onClick={() => zoomIn()} className="h-10 w-10 rounded-xl shadow-lg border border-white/50"><Plus className="w-4 h-4" /></Button>
                       <Button size="icon" variant="secondary" onClick={() => zoomOut()} className="h-10 w-10 rounded-xl shadow-lg border border-white/50"><Minus className="w-4 h-4" /></Button>
                       <Button size="icon" variant="secondary" onClick={() => resetTransform()} className="h-10 w-10 rounded-xl shadow-lg border border-white/50"><RotateCcw className="w-4 h-4" /></Button>
                    </div>

                    <TransformComponent wrapperClass="!w-full !h-[450px]">
                       <div className="p-20 min-w-[800px] flex flex-col items-center gap-12">
                          <div className="w-full max-w-md h-12 bg-primary text-white flex items-center justify-center rounded-xl shadow-2xl border-4 border-white/20">
                             <span className="font-black italic uppercase tracking-[0.4em] text-xs">PALCO / TELA</span>
                          </div>

                          <div className={cn(
                            "grid gap-3 p-10 bg-white/40 backdrop-blur-sm rounded-[3rem] border border-white/60 shadow-xl",
                            sector.tipo === 'assentos' ? "grid-cols-10" : "grid-cols-5"
                          )}>
                             {seats?.map((seat) => (
                               <SeatButton 
                                 key={seat.id} 
                                 seat={seat} 
                                 isSelected={selectedSeat?.id === seat.id}
                                 onSelect={() => onSelectSeat(seat)} 
                               />
                             ))}
                          </div>
                       </div>
                    </TransformComponent>
                  </React.Fragment>
                )}
              </TransformWrapper>
           </Card>

           <div className="mt-6 flex flex-wrap items-center justify-center gap-6 px-4">
              <LegendItem color="bg-white border-border" label="Disponível" />
              <LegendItem color="bg-secondary text-white" label="Selecionado" />
              <LegendItem color="bg-muted text-muted-foreground/30 opacity-50" label="Indisponível" />
           </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-muted/20 rounded-[2.5rem] border-2 border-dashed">
           <Layout className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
           <p className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest leading-relaxed">
             Este setor não possui lugares numerados.<br/>A ocupação é por ordem de chegada.
           </p>
        </div>
      )}
    </div>
  )
}

function SeatButton({ seat, isSelected, onSelect }: { seat: any, isSelected: boolean, onSelect: () => void }) {
  const isAvailable = seat.status === 'disponivel'
  
  return (
    <button
      disabled={!isAvailable}
      onClick={onSelect}
      className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black transition-all transform active:scale-90",
        isAvailable 
          ? isSelected 
            ? "bg-secondary text-white shadow-lg ring-4 ring-secondary/20 scale-110 z-10" 
            : "bg-white border-2 border-border hover:border-secondary hover:text-secondary shadow-sm"
          : "bg-muted text-muted-foreground/20 cursor-not-allowed opacity-50 border-none"
      )}
      title={`${seat.codigo} - ${seat.status}`}
    >
      {isSelected ? <CheckCircle2 className="w-5 h-5" /> : seat.codigo}
    </button>
  )
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-4 h-4 rounded-md shadow-sm border", color)} />
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  )
}

function Card({ className, children }: { className?: string, children: React.ReactNode }) {
  return <div className={cn("relative flex flex-col bg-card", className)}>{children}</div>
}

function Loader2({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("animate-spin", className)}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
