
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where, orderBy, getDocs } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { 
  Calendar, 
  MapPin, 
  Ticket, 
  Loader2, 
  Armchair, 
  ZoomIn, 
  ZoomOut, 
  Maximize,
  ArrowLeft,
  ShoppingCart,
  Accessibility
} from "lucide-react"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import { useCart } from "@/contexts/CartContext"
import { reserveSeat } from "@/lib/ticketing-service"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import Link from "next/link"

export default function EventoPublicoPage() {
  const params = useParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { addItem, items: cartItems } = useCart()
  
  const eventId = params.id as string
  const eventRef = React.useMemo(() => db ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const setoresQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(collection(db, "events", eventId, "setores"), where("ativo", "==", true), orderBy("zIndex", "asc"))
  }, [db, eventId])
  const { data: setores } = useCollection<any>(setoresQuery)

  const [selectedSector, setSelectedSector] = React.useState<any>(null)
  const [selectedSeat, setSelectedSeat] = React.useState<any>(null)
  const [isReserving, setIsReserving] = React.useState(false)

  const handleSeatClick = async (seat: any, sector: any) => {
    if (!user) { toast({ title: "Login necessário" }); router.push("/login"); return; }
    if (!db || isReserving || seat.status !== 'disponivel') return;

    setIsReserving(true);
    try {
      await reserveSeat(db, eventId, sector.id, seat.id, user.uid);
      setSelectedSector(sector);
      setSelectedSeat(seat);
      toast({ title: "Lugar reservado!", description: "Conclua a compra em 10 min." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsReserving(false);
    }
  }

  const handleAddToCart = () => {
    if (!event || !selectedSector) return;
    if (selectedSector.tipo !== 'livre' && !selectedSeat) {
      toast({ variant: "destructive", title: "Selecione um lugar no mapa" });
      return;
    }

    // Lógica de adição baseada no ticketMode
    // ... (simplificado para o protótipo)
    addItem({
      id: `${event.id}_${selectedSector.id}`,
      eventId: event.id,
      eventTitle: event.title,
      eventImage: event.image || "",
      eventDate: event.date,
      eventCity: event.city || "",
      organizationId: event.organizationId,
      organizerId: event.organizerId,
      organizerUsername: params.username as string,
      ticketTypeId: "std",
      ticketTypeName: selectedSector.nome,
      batchId: "active",
      batchName: "Vigente",
      price: selectedSector.preco || 0,
      quantity: 1,
      requiresProof: false,
      seatId: selectedSeat?.id,
      sectorId: selectedSector.id
    });
    toast({ title: "Adicionado ao carrinho!" });
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
  if (!event) return null

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <div className="max-w-7xl mx-auto px-4 pt-10 space-y-8 flex-1 w-full">
        <div className="flex items-center justify-between">
           <Button variant="ghost" onClick={() => router.back()} className="rounded-full font-bold text-xs uppercase gap-2">
              <ArrowLeft className="w-4 h-4" /> Voltar
           </Button>
           <Button variant="outline" size="icon" className="relative h-10 w-10" asChild>
             <Link href="/dashboard/carrinho">
               <ShoppingCart className="w-4 h-4" />
               {cartItems.length > 0 && <span className="absolute -top-1 -right-1 bg-secondary text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{cartItems.length}</span>}
             </Link>
           </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
           <div className="lg:col-span-8 space-y-8">
              <div className="relative h-64 md:h-80 w-full rounded-[2.5rem] overflow-hidden shadow-xl border-4 border-white">
                <Image src={event.image || "https://picsum.photos/seed/event/1200/800"} alt={event.title} fill className="object-cover" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-8 left-8 text-white">
                   <Badge className="bg-secondary mb-2">{event.categoryName}</Badge>
                   <h1 className="text-4xl font-black uppercase italic tracking-tighter">{event.title}</h1>
                </div>
              </div>

              {event.possuiMapa && setores ? (
                <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
                   <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
                      <CardTitle className="text-lg font-bold flex items-center gap-2"><MapIcon className="w-5 h-5 text-secondary" /> Mapa de Assentos</CardTitle>
                      <div className="flex gap-4">
                         <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-white border border-secondary" /> <span className="text-[8px] font-black uppercase">Livre</span></div>
                         <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-secondary" /> <span className="text-[8px] font-black uppercase">Selecionado</span></div>
                      </div>
                   </CardHeader>
                   <CardContent className="p-0 bg-[#fafafa] relative h-[500px]">
                      <TransformWrapper initialScale={0.5} centerOnInit>
                        {({ zoomIn, zoomOut, resetTransform }) => (
                          <>
                            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
                               <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => zoomIn()}><ZoomIn className="w-4 h-4" /></Button>
                               <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => zoomOut()}><ZoomOut className="w-4 h-4" /></Button>
                               <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => resetTransform()}><Maximize className="w-4 h-4" /></Button>
                            </div>
                            <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                              <div className="relative min-w-[2000px] min-h-[1500px]">
                                 <div className="absolute bg-primary text-white flex items-center justify-center rounded-2xl shadow-xl" style={{ left: event.palcoPosX || 700, top: event.palcoPosY || 50, width: event.palcoWidth || 600, height: event.palcoHeight || 120 }}>
                                    <span className="font-black italic uppercase tracking-[0.4em] text-lg">{event.palcoNome || "PALCO"}</span>
                                 </div>
                                 {setores.map((s: any) => (
                                   <div 
                                     key={s.id} 
                                     onClick={() => s.tipo === 'livre' ? setSelectedSector(s) : null} 
                                     className={cn("absolute transition-all cursor-pointer border-2 group flex flex-col items-center justify-center", selectedSector?.id === s.id && "ring-4 ring-secondary/30")} 
                                     style={{ left: s.posX || 0, top: s.posY || 0, width: s.width || 200, height: s.height || 120, backgroundColor: `${s.cor}20`, borderColor: s.cor, borderRadius: '1.5rem', transform: `rotate(${s.rotation || 0}deg)` }}
                                   >
                                      <h4 className="font-black uppercase italic text-[10px]" style={{ color: s.cor }}>{s.nome}</h4>
                                      {s.tipo !== 'livre' && (
                                         <div className="absolute inset-0 bg-white/95 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 rounded-[1.4rem]">
                                            <p className="text-[8px] font-black uppercase mb-2">Escolher Lugar</p>
                                            <PublicSectorGrid eventId={eventId} sector={s} onSelect={(seat) => handleSeatClick(seat, s)} selectedSeatId={selectedSeat?.id} />
                                         </div>
                                      )}
                                   </div>
                                 ))}
                              </div>
                            </TransformComponent>
                          </>
                        )}
                      </TransformWrapper>
                   </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {/* Fallback para lista de ingressos se não houver mapa */}
                </div>
              )}
           </div>

           <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-xl rounded-[2.5rem] border-t-8 border-secondary overflow-hidden bg-white sticky top-24">
                 <CardHeader><CardTitle className="text-xl font-black italic uppercase text-primary flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria</CardTitle></CardHeader>
                 <CardContent className="space-y-6">
                    {selectedSector ? (
                       <div className="space-y-6 animate-in slide-in-from-right-4">
                          <div className="p-5 bg-muted/30 rounded-2xl space-y-4">
                             <div className="flex justify-between text-[10px] font-black uppercase opacity-40"><span>Setor</span><span>{selectedSector.nome}</span></div>
                             {selectedSeat && (
                               <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-40"><span>Lugar</span><span className="text-secondary text-sm">{selectedSeat.codigo}</span></div>
                             )}
                             <Separator className="border-dashed" />
                             <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase opacity-40">Valor</span>
                                <span className="text-2xl font-black text-primary">{formatCurrency(selectedSector.preco || 0)}</span>
                             </div>
                          </div>
                          <Button onClick={handleAddToCart} disabled={isReserving} className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform">
                             {isReserving ? <Loader2 className="animate-spin" /> : "Adicionar ao Carrinho"}
                          </Button>
                       </div>
                    ) : (
                       <div className="py-20 text-center opacity-30">
                          <MapIcon className="w-10 h-10 mx-auto mb-2" />
                          <p className="text-[10px] font-black uppercase italic">Selecione uma área no mapa</p>
                       </div>
                    )}
                 </CardContent>
              </Card>
           </div>
        </div>
      </div>
    </div>
  )
}

function PublicSectorGrid({ eventId, sector, onSelect, selectedSeatId }: { eventId: string, sector: any, onSelect: (s: any) => void, selectedSeatId?: string }) {
  const db = useFirestore()
  const q = useMemoFirebase(() => db ? query(collection(db, "events", eventId, "setores", sector.id, "assentos"), orderBy("codigo", "asc")) : null, [db, sector.id])
  const { data: assentos } = useCollection<any>(q)

  return (
    <div className="grid grid-cols-6 gap-1 max-h-[100px] overflow-auto custom-scrollbar p-1">
       {assentos?.map(a => (
          <button 
            key={a.id} 
            disabled={a.status !== 'disponivel'} 
            onClick={(e) => { e.stopPropagation(); onSelect(a); }}
            className={cn(
              "w-5 h-5 rounded-sm text-[6px] font-black border transition-all flex items-center justify-center",
              a.status === 'disponivel' ? "bg-white border-muted hover:border-secondary" : "bg-muted text-muted-foreground/30",
              selectedSeatId === a.id ? "bg-secondary border-secondary text-white scale-110" : ""
            )}
          >
             {a.codigo.slice(-2)}
          </button>
       ))}
    </div>
  )
}
