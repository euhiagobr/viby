
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
  Accessibility,
  Clock,
  AlertCircle,
  Lock
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
  const [selectedTicketType, setSelectedTicketType] = React.useState<any>(null)
  const [isReserving, setIsReserving] = React.useState(false)

  // Lógica de Lote Vigente e Status de Venda
  const saleStatus = React.useMemo(() => {
    if (!event || !event.batches || event.batches.length === 0) return { active: false, message: "Ingressos indisponíveis", batch: null };
    
    const now = new Date();
    
    // Filtrar lotes que estão dentro do período de venda
    const activeBatches = event.batches.filter((b: any) => {
      const start = b.startDate ? new Date(b.startDate) : null;
      const end = b.endDate ? new Date(b.endDate) : null;
      return (!start || now >= start) && (!end || now <= end);
    });

    if (activeBatches.length > 0) {
      // Pega o primeiro lote ativo (ordem cronológica)
      return { active: true, message: null, batch: activeBatches[0] };
    }

    // Se não há ativo, verifica se algum ainda vai começar
    const futureBatches = event.batches.filter((b: any) => {
      const start = b.startDate ? new Date(b.startDate) : null;
      return start && now < start;
    }).sort((a:any, b:any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    if (futureBatches.length > 0) {
      return { 
        active: false, 
        message: `Vendas começam em ${new Date(futureBatches[0].startDate).toLocaleString('pt-BR')}`,
        batch: null 
      };
    }

    return { active: false, message: "Vendas encerradas", batch: null };
  }, [event]);

  const handleSeatClick = async (seat: any, sector: any) => {
    if (!user) { toast({ title: "Login necessário" }); router.push("/login"); return; }
    if (!db || isReserving || seat.status !== 'disponivel') return;
    if (!saleStatus.active) { toast({ variant: "destructive", title: "Vendas suspensas", description: saleStatus.message }); return; }

    setIsReserving(true);
    try {
      await reserveSeat(db, eventId, sector.id, seat.id, user.uid);
      setSelectedSector(sector);
      setSelectedSeat(seat);
      setSelectedTicketType(null); // Reseta tipo ao mudar lugar
      toast({ title: "Lugar reservado!", description: "Conclua a compra em 10 min." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsReserving(false);
    }
  }

  const handleAddToCart = () => {
    if (!event || !selectedSector || !saleStatus.batch) return;
    if (selectedSector.tipo !== 'livre' && !selectedSeat) {
      toast({ variant: "destructive", title: "Selecione um lugar no mapa" });
      return;
    }
    if (!selectedTicketType) {
      toast({ variant: "destructive", title: "Selecione o tipo de ingresso" });
      return;
    }

    addItem({
      id: `${event.id}_${selectedSector.id}_${selectedTicketType.id}_${selectedSeat?.id || 'gen'}`,
      eventId: event.id,
      eventTitle: event.title,
      eventImage: event.image || "",
      eventDate: event.date,
      eventCity: event.city || "",
      organizationId: event.organizationId,
      organizerId: event.organizerId,
      organizerUsername: params.username as string,
      ticketTypeId: selectedTicketType.id,
      ticketTypeName: selectedTicketType.name,
      batchId: saleStatus.batch.id,
      batchName: saleStatus.batch.name,
      price: selectedTicketType.price,
      quantity: 1,
      requiresProof: selectedTicketType.requiresProof || false,
      seatId: selectedSeat?.id,
      sectorId: selectedSector.id
    });
    
    toast({ title: "Adicionado ao carrinho!" });
    setSelectedSeat(null);
    setSelectedTicketType(null);
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

              {!saleStatus.active && (
                <div className="p-6 bg-orange-50 border-2 border-dashed border-orange-200 rounded-[2rem] flex items-center gap-4 text-orange-800">
                   <Lock className="w-8 h-8 opacity-40" />
                   <div>
                      <p className="font-black uppercase italic text-sm">Bilheteria Suspensa</p>
                      <p className="text-xs font-bold opacity-60 uppercase">{saleStatus.message}</p>
                   </div>
                </div>
              )}

              {event.possuiMapa && setores ? (
                <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
                   <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
                      <CardTitle className="text-lg font-bold flex items-center gap-2"><MapIcon className="w-5 h-5 text-secondary" /> Planta Visual</CardTitle>
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
                                     onClick={() => { if(saleStatus.active) setSelectedSector(s) }} 
                                     className={cn(
                                       "absolute transition-all border-2 group flex flex-col items-center justify-center", 
                                       selectedSector?.id === s.id && "ring-4 ring-secondary/30",
                                       !saleStatus.active ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                                      )} 
                                     style={{ left: s.posX || 0, top: s.posY || 0, width: s.width || 200, height: s.height || 120, backgroundColor: `${s.cor}20`, borderColor: s.cor, borderRadius: '1.5rem' }}
                                   >
                                      <h4 className="font-black uppercase italic text-[10px]" style={{ color: s.cor }}>{s.nome}</h4>
                                      {s.tipo !== 'livre' && saleStatus.active && (
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* Modo Lista Simples */}
                   {saleStatus.batch?.ticketTypes.map((t: any) => (
                     <Card key={t.id} className="border-none shadow-sm rounded-3xl bg-white p-6 flex flex-col justify-between gap-4">
                        <div>
                          <div className="flex justify-between items-start">
                             <h4 className="font-black uppercase italic text-primary">{t.name}</h4>
                             <Badge variant="outline" className="text-[8px]">{saleStatus.batch.name}</Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-2">{t.description || "Ingresso individual para o evento."}</p>
                        </div>
                        <div className="flex items-center justify-between">
                           <span className="text-xl font-black text-secondary">{t.price === 0 ? 'GRÁTIS' : formatCurrency(t.price)}</span>
                           <Button 
                             size="sm" 
                             disabled={!saleStatus.active}
                             className="rounded-xl font-bold uppercase text-[10px] bg-primary text-white"
                             onClick={() => { setSelectedSector({id: 'none', nome: 'Geral', tipo: 'livre'}); setSelectedTicketType(t); handleAddToCart(); }}
                           >
                              Selecionar
                           </Button>
                        </div>
                     </Card>
                   ))}
                </div>
              )}
           </div>

           <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-xl rounded-[2.5rem] border-t-8 border-secondary overflow-hidden bg-white sticky top-24">
                 <CardHeader><CardTitle className="text-xl font-black italic uppercase text-primary flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria</CardTitle></CardHeader>
                 <CardContent className="space-y-6">
                    {selectedSector && saleStatus.batch ? (
                       <div className="space-y-6 animate-in slide-in-from-right-4">
                          <div className="p-5 bg-muted/30 rounded-2xl space-y-4">
                             <div className="flex justify-between text-[10px] font-black uppercase opacity-40"><span>Setor</span><span>{selectedSector.nome}</span></div>
                             {selectedSeat && (
                               <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-40"><span>Lugar</span><span className="text-secondary text-sm">{selectedSeat.codigo}</span></div>
                             )}
                             <Separator className="border-dashed" />
                             
                             <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase opacity-40">Tipo de Ingresso</Label>
                                <div className="grid grid-cols-1 gap-2">
                                   {saleStatus.batch.ticketTypes.map((t: any) => (
                                      <button 
                                        key={t.id} 
                                        onClick={() => setSelectedTicketType(t)}
                                        className={cn(
                                          "flex items-center justify-between p-3 rounded-xl border-2 transition-all",
                                          selectedTicketType?.id === t.id ? "border-secondary bg-secondary/5" : "border-transparent bg-white hover:bg-muted/10"
                                        )}
                                      >
                                         <span className="text-xs font-bold uppercase">{t.name}</span>
                                         <span className="text-xs font-black">{t.price === 0 ? 'Grátis' : formatCurrency(t.price)}</span>
                                      </button>
                                   ))}
                                </div>
                             </div>
                             
                             <Separator className="border-dashed" />
                             <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase opacity-40">Valor Total</span>
                                <span className="text-2xl font-black text-primary">{formatCurrency(selectedTicketType?.price || 0)}</span>
                             </div>
                          </div>
                          <Button 
                            onClick={handleAddToCart} 
                            disabled={isReserving || !selectedTicketType} 
                            className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform"
                          >
                             {isReserving ? <Loader2 className="animate-spin" /> : "Adicionar ao Carrinho"}
                          </Button>
                       </div>
                    ) : (
                       <div className="py-20 text-center opacity-30">
                          <MapIcon className="w-10 h-10 mx-auto mb-2" />
                          <p className="text-[10px] font-black uppercase italic">
                            {event.possuiMapa ? "Selecione uma área no mapa" : "Escolha um ingresso ao lado"}
                          </p>
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
