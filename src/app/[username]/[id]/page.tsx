
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where, orderBy, addDoc, serverTimestamp, deleteDoc, writeBatch, getDocs, limit, setDoc } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { 
  Calendar, 
  MapPin, 
  Share2, 
  ArrowLeft, 
  Ticket, 
  Info,
  Loader2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Layers,
  ShoppingCart,
  Plus,
  Minus,
  Map as MapIcon,
  Navigation,
  Users,
  EyeOff,
  TicketX,
  MessageCircle,
  Send,
  Trash2,
  Heart,
  BadgeCheck,
  Armchair,
  Layout,
  Grid3X3,
  Circle,
  Square,
  Accessibility,
  UserCheck,
  ZoomIn,
  ZoomOut,
  Maximize,
  InfoIcon,
  Zap
} from "lucide-react"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import { useCart } from "@/contexts/CartContext"
import Footer from "@/components/layout/Footer"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { reserveSeat } from "@/lib/ticketing-service"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import Link from "next/link"

export default function EventoDetalhesPage() {
  const params = useParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { addItem, items: cartItems } = useCart()
  
  const eventId = params.id as string
  const usernameFromUrl = params.username as string

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile } = useDoc<any>(userDocRef)

  const eventRef = React.useMemo(() => db ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)
  
  const feesRef = React.useMemo(() => db ? doc(db, 'settings', 'fees') : null, [db])
  const { data: globalFees } = useDoc<any>(feesRef)

  const setoresQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(collection(db, "events", eventId, "setores"), where("ativo", "==", true), orderBy("zIndex", "asc"))
  }, [db, eventId])
  const { data: setores } = useCollection<any>(setoresQuery)

  const [selectedSector, setSelectedSector] = React.useState<any>(null)
  const [selectedSeat, setSelectedSeat] = React.useState<any>(null)
  const [selectedTicketType, setSelectedTicketType] = React.useState<any>(null)
  const [isReserving, setIsReserving] = React.useState(false)

  // Lógica Dinâmica de Lote Ativo com Migração Sequencial
  const getActiveBatchForTicket = React.useCallback((ticketName: string) => {
    if (!event || !event.batches || event.batches.length === 0) return null;
    
    const now = new Date();
    let carryOver = 0;

    for (let i = 0; i < event.batches.length; i++) {
      const b = event.batches[i];
      const start = b.startDate ? new Date(b.startDate) : null;
      const end = b.endDate ? new Date(b.endDate) : null;
      
      const capAtual = (b.capacidadeInicial || 0) + carryOver;
      const vendidos = b.vendidos || 0;
      const restantes = Math.max(0, capAtual - vendidos);

      const isDateValid = (!start || now >= start) && (!end || now <= end);
      
      // Se a data for válida e houver estoque (incluindo migrados)
      if (isDateValid && restantes > 0) {
        const option = b.ticketTypes.find((t: any) => t.name === ticketName);
        if (option) {
          return { ...option, batchId: b.id, batchName: b.name, batchRemaining: restantes };
        }
      }
      carryOver = restantes;
    }

    // Se nenhum lote estiver na data, tenta o último disponível com estoque
    const lastBatch = event.batches[event.batches.length - 1];
    const lastOption = lastBatch.ticketTypes.find((t: any) => t.name === ticketName);
    return lastOption ? { ...lastOption, batchId: lastBatch.id, batchName: lastBatch.name } : null;
  }, [event]);

  const availableOptionsForSector = React.useMemo(() => {
    if (!selectedSector || !event) return []
    
    // Se o setor está vinculado a um nome de ingresso (ex: "Cadeira Gold")
    if (selectedSector.linkedTicketName) {
      const option = getActiveBatchForTicket(selectedSector.linkedTicketName);
      return option ? [option] : [];
    }

    // Fallback para preço fixo manual do setor (se não houver vínculo)
    return [{
       id: selectedSector.id,
       name: selectedSector.nome,
       price: selectedSector.preco,
       batchId: "fixed",
       batchName: "Lote Único"
    }]
  }, [selectedSector, event, getActiveBatchForTicket])

  React.useEffect(() => {
     if (availableOptionsForSector.length > 0) setSelectedTicketType(availableOptionsForSector[0]); 
     else setSelectedTicketType(null)
  }, [availableOptionsForSector])

  const handleSeatClick = async (seat: any, sector: any) => {
    if (!user) { toast({ title: "Ação necessária", description: "Faça login para selecionar assentos." }); router.push("/login"); return; }
    if (!db || isReserving || seat.status !== 'disponivel') return;

    setIsReserving(true);
    try {
      await reserveSeat(db, eventId, sector.id, seat.id, user.uid);
      setSelectedSector(sector);
      setSelectedSeat(seat);
      toast({ title: "Lugar reservado!", description: "Você tem 10 minutos para concluir a compra." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsReserving(false);
    }
  }

  const handleAddToCart = () => {
    if (!selectedSector || !event || !selectedTicketType || !globalFees) return
    const isNumbered = selectedSector.tipo !== 'livre';
    if (isNumbered && !selectedSeat) { toast({ variant: "destructive", title: "Selecione um lugar" }); return; }

    addItem({
      id: isNumbered ? `${event.id}_${selectedTicketType.id}_${selectedSeat.id}` : `${event.id}_${selectedTicketType.id}`,
      eventId: event.id,
      eventTitle: event.title,
      eventImage: event.image || "",
      eventDate: event.date,
      eventCity: event.city || "",
      organizationId: event.organizationId,
      organizerId: event.organizerId,
      organizerUsername: usernameFromUrl,
      ticketTypeId: selectedTicketType.id,
      ticketTypeName: `${selectedTicketType.name}${selectedSeat ? ` (${selectedSeat.codigo})` : ''}`,
      batchId: selectedTicketType.batchId || "map",
      batchName: selectedTicketType.batchName || "Ingresso",
      price: selectedTicketType.price,
      quantity: 1,
      requiresProof: selectedTicketType.requiresProof || (selectedSeat?.categoria && selectedSeat.categoria !== 'comum'),
      seatId: selectedSeat?.id,
      seatCode: selectedSeat?.codigo,
      sectorId: selectedSector.id
    });

    toast({ title: "Adicionado ao carrinho!" });
    if (isNumbered) {
      setSelectedSeat(null);
      setSelectedSector(null);
    }
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  if (!event) return null

  const hasMap = event.possuiMapa || event.mapMode !== 'none';

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col text-foreground">
      <div className="max-w-7xl mx-auto px-4 pt-10 space-y-8 flex-1 w-full">
        <div className="flex items-center justify-between">
           <Button variant="ghost" onClick={() => router.back()} className="rounded-full font-bold text-xs uppercase gap-2">
              <ArrowLeft className="w-4 h-4" /> Voltar
           </Button>
           {event.ticketMode !== 'none' && (
             <Button variant="outline" size="icon" className="rounded-full h-10 w-10 relative" asChild>
               <Link href="/dashboard/carrinho">
                 <ShoppingCart className="w-4 h-4" />
                 {cartItems.length > 0 && <span className="absolute -top-1 -right-1 bg-secondary text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">{cartItems.length}</span>}
               </Link>
             </Button>
           )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
           <div className="lg:col-span-8 space-y-8">
              <div className="relative h-64 md:h-96 w-full rounded-[2.5rem] overflow-hidden shadow-xl border-4 border-white">
                <Image src={event.image || "https://picsum.photos/seed/event/1200/800"} alt={event.title} fill className="object-cover" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute bottom-8 left-8 text-white space-y-2">
                   <Badge className="bg-secondary px-4 py-1 rounded-full uppercase font-black tracking-widest">{event.categoryName || "Geral"}</Badge>
                   <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter leading-tight">{event.title}</h1>
                </div>
              </div>

              {event.ticketMode === 'none' ? (
                <div className="p-12 text-center bg-white rounded-[2.5rem] shadow-sm border border-dashed border-border/60 flex flex-col items-center gap-4">
                   <div className="p-4 bg-muted rounded-full text-muted-foreground opacity-30"><InfoIcon className="w-12 h-12" /></div>
                   <h3 className="text-xl font-bold uppercase italic tracking-tighter">Evento Informativo</h3>
                   <p className="text-sm text-muted-foreground font-medium max-w-md">Este evento não possui venda de ingressos através da plataforma. Compareça ao local na data indicada.</p>
                </div>
              ) : (
                <React.Fragment>
                  {/* MAPA VISUAL INTEGRADO */}
                  {hasMap && setores && (
                    <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
                       <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
                          <CardTitle className="text-lg font-bold flex items-center gap-2"><MapIcon className="w-5 h-5 text-secondary" /> Mapa do Evento</CardTitle>
                          <div className="flex gap-4">
                             <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-white border border-secondary rounded-sm" /> <span className="text-[8px] font-black uppercase">Livre</span></div>
                             <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-secondary rounded-sm" /> <span className="text-[8px] font-black uppercase">Selecionado</span></div>
                             <div className="flex items-center gap-1.5"><Accessibility className="w-3 h-3 text-secondary" /> <span className="text-[8px] font-black uppercase">PCD</span></div>
                          </div>
                       </CardHeader>
                       <CardContent className="p-0 bg-[#fafafa] relative h-[600px]">
                          <TransformWrapper initialScale={0.5} centerOnInit minScale={0.1} maxScale={2}>
                            {({ zoomIn, zoomOut, resetTransform }) => (
                              <>
                                <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
                                   <Button size="icon" variant="secondary" className="rounded-xl shadow-lg h-10 w-10" onClick={() => zoomIn()}><ZoomIn className="w-4 h-4" /></Button>
                                   <Button size="icon" variant="secondary" className="rounded-xl shadow-lg h-10 w-10" onClick={() => zoomOut()}><ZoomOut className="w-4 h-4" /></Button>
                                   <Button size="icon" variant="secondary" className="rounded-xl shadow-lg h-10 w-10" onClick={() => resetTransform()}><Maximize className="w-4 h-4" /></Button>
                                </div>
                                <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                                  <div className="relative min-w-[2000px] min-h-[1500px]">
                                     {/* Palco */}
                                     <div className="absolute bg-primary text-white flex flex-col items-center justify-center rounded-2xl shadow-2xl border-4 border-white/10" style={{ left: event.palcoPosX || 700, top: event.palcoPosY || 50, width: event.palcoWidth || 600, height: event.palcoHeight || 120 }}>
                                        <span className="font-black italic uppercase tracking-[0.4em] text-lg">{event.palcoNome || "PALCO"}</span>
                                     </div>
                                     
                                     {/* Setores Dinâmicos */}
                                     {setores.map((s: any) => (
                                       <div 
                                         key={s.id} 
                                         onClick={() => s.tipo === 'livre' ? setSelectedSector(s) : null} 
                                         className={cn(
                                           "absolute transition-all cursor-pointer flex flex-col items-center justify-center border-2 group", 
                                           selectedSector?.id === s.id ? "ring-4 ring-secondary/30" : "hover:scale-[1.01]"
                                         )} 
                                         style={{ 
                                           left: s.posX || 0, 
                                           top: s.posY || 0, 
                                           width: s.width || 200, 
                                           height: s.height || 120, 
                                           backgroundColor: selectedSector?.id === s.id ? `${s.cor}40` : `${s.cor}20`, 
                                           borderColor: s.cor, 
                                           borderRadius: s.formatoVisual === 'circulo' ? '100%' : '2rem' 
                                         }}
                                       >
                                          <div className="text-center p-4">
                                             <h4 className="font-black uppercase italic text-[10px]" style={{ color: s.cor }}>{s.nome}</h4>
                                             {s.tipo === 'livre' && (<p className="text-[9px] font-black opacity-60" style={{ color: s.cor }}>Selecionar Área</p>)}
                                          </div>
                                          
                                          {/* Seleção de Assentos/Mesas integrada no hover visual */}
                                          {s.tipo !== 'livre' && (
                                            <div className="absolute inset-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 flex flex-col items-center justify-center rounded-[inherit] overflow-hidden">
                                               <p className="text-[9px] font-black uppercase text-primary mb-3">Escolher {s.tipo === 'assentos' ? 'Lugar' : 'Mesa'}</p>
                                               <SectorPublicGrid setor={s} eventoId={eventId} onSelect={(seat) => handleSeatClick(seat, s)} selectedSeat={selectedSeat} />
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
                  )}

                  {/* Se não tiver mapa, mostra lista baseada nos lotes sequenciais */}
                  {!hasMap && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {event.batches?.[0]?.ticketTypes.map((type: any) => {
                         const currentOption = getActiveBatchForTicket(type.name);
                         if (!currentOption) return null;
                         return (
                           <Card key={type.id} className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl bg-white group border-l-4 border-secondary">
                              <CardContent className="p-6 flex items-center justify-between">
                                 <div>
                                    <h4 className="font-bold text-base uppercase">{currentOption.name}</h4>
                                    <p className="text-xs font-bold text-primary mt-1">{formatCurrency(currentOption.price)}</p>
                                    <p className="text-[8px] font-black uppercase text-muted-foreground mt-0.5">{currentOption.batchName}</p>
                                 </div>
                                 <Button 
                                   onClick={() => {
                                     setSelectedTicketType(currentOption);
                                     handleAddToCart();
                                   }}
                                   className="rounded-xl h-10 bg-secondary text-white font-black uppercase italic text-[10px]"
                                 >
                                    Comprar
                                 </Button>
                              </CardContent>
                           </Card>
                         );
                       })}
                    </div>
                  )}
                </React.Fragment>
              )}
           </div>
           
           {/* Sidebar de Bilheteria/Carrinho */}
           {event.ticketMode !== 'none' && (
             <div className="lg:col-span-4 space-y-6">
                <Card className="border-none shadow-xl rounded-[2.5rem] border-t-8 border-secondary overflow-hidden bg-white sticky top-24">
                   <CardHeader><CardTitle className="flex items-center gap-2 font-black italic uppercase tracking-tighter text-primary"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria</CardTitle></CardHeader>
                   <CardContent className="space-y-6">
                      {selectedSector ? (
                         <div className="space-y-6 animate-in slide-in-from-right-4">
                            <div className="p-5 bg-muted/30 rounded-2xl space-y-4">
                               <div className="flex justify-between"><span className="text-[10px] font-black uppercase opacity-40">Setor</span><span className="font-bold text-sm uppercase">{selectedSector.nome}</span></div>
                               {selectedSeat && (
                                 <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase opacity-40">Lugar</span><div className="flex flex-col items-end"><span className="font-black text-secondary uppercase italic">{selectedSeat.codigo}</span>{selectedSeat.categoria !== 'comum' && <Badge variant="outline" className="text-[8px] h-4 uppercase border-secondary text-secondary gap-1"><Accessibility className="w-2 h-2" /> {selectedSeat.categoria}</Badge>}</div></div>
                               )}
                               <Separator className="border-dashed" />
                               <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase opacity-40">Preço Vigente</Label>
                                  <div className="space-y-2">
                                     {availableOptionsForSector.map((option: any) => (
                                        <div key={option.id} onClick={() => setSelectedTicketType(option)} className={cn("p-4 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center", selectedTicketType?.id === option.id ? "border-secondary bg-secondary/5" : "border-transparent bg-white hover:bg-muted")}>
                                           <div className="flex flex-col">
                                              <span className="text-xs font-bold uppercase">{option.name}</span>
                                              <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">{option.batchName}</span>
                                           </div>
                                           <span className="font-black text-sm text-primary">{formatCurrency(option.price)}</span>
                                        </div>
                                     ))}
                                  </div>
                               </div>
                               <Separator className="border-dashed" />
                               <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase opacity-40">Valor Total</span><span className="text-xl font-black text-primary">{formatCurrency(selectedTicketType?.price || 0)}</span></div>
                            </div>

                            {selectedTicketType?.requiresProof && (
                              <div className="p-4 bg-orange-50 rounded-2xl flex gap-3">
                                 <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                                 <p className="text-[9px] text-orange-800 font-bold uppercase leading-tight">Este ingresso exige apresentação de documento comprobatório na portaria do evento.</p>
                              </div>
                            )}

                            <Button 
                              disabled={(selectedSector.tipo !== 'livre' && !selectedSeat) || !selectedTicketType || isReserving} 
                              onClick={handleAddToCart} 
                              className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform gap-3"
                            >
                               {isReserving ? <Loader2 className="w-6 h-6 animate-spin" /> : <><ShoppingCart className="w-6 h-6" /> {selectedSector.tipo !== 'livre' ? "Confirmar Lugar" : "Adicionar ao Carrinho"}</>}
                            </Button>
                         </div>
                      ) : (
                        <div className="p-10 text-center space-y-4 opacity-30">
                           {hasMap ? (
                             <><MapIcon className="w-8 h-8 mx-auto text-secondary" /><p className="text-[10px] font-black uppercase italic">Selecione uma área no mapa para ver ingressos</p></>
                           ) : (
                             <p className="text-[10px] font-black uppercase italic">Selecione uma opção na lista</p>
                           )}
                        </div>
                      )}
                   </CardContent>
                </Card>
             </div>
           )}
        </div>
      </div>
      <Footer />
    </div>
  )
}

function SectorPublicGrid({ setor, eventoId, onSelect, selectedSeat }: { setor: any, eventoId: string, onSelect: (seat: any) => void, selectedSeat: any }) {
  const db = useFirestore()
  const assentosQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "events", eventoId, "setores", setor.id, "assentos"), orderBy("codigo", "asc"))
  }, [db, setor.id])
  const { data: assentos, loading } = useCollection<any>(assentosQuery)
  
  if (loading) return <div className="py-2 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-primary" /></div>
  
  return (
    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1 overflow-auto max-h-full p-1 custom-scrollbar">
       {assentos?.map((a: any) => (
         <TooltipProvider key={a.id}>
           <Tooltip>
             <TooltipTrigger asChild>
               <button 
                 disabled={a.status !== 'disponivel'} 
                 onClick={(e) => { e.stopPropagation(); onSelect(a); }} 
                 className={cn(
                   "w-6 h-6 rounded-[2px] text-[6px] font-black border transition-all flex items-center justify-center relative", 
                   a.status === 'disponivel' ? "bg-white border-muted hover:border-secondary hover:scale-110" : "cursor-not-allowed", 
                   selectedSeat?.id === a.id ? "bg-secondary border-secondary text-white scale-125 z-10" : 
                   a.status === 'vendido' ? "bg-muted border-transparent opacity-30" : 
                   a.status === 'reservado' ? "bg-orange-400 border-orange-400 text-white" : ""
                 )}
               >
                 {a.categoria !== 'comum' && a.status === 'disponivel' && (
                    <Accessibility className="w-2.5 h-2.5 text-secondary absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm" />
                 )}
                 {a.codigo.slice(-2)}
               </button>
             </TooltipTrigger>
             <TooltipContent className="text-[9px] font-bold uppercase p-2 space-y-1">
                <p>{a.codigo}</p>
                {a.categoria !== 'comum' && <Badge variant="outline" className="text-[7px] h-3 uppercase border-white/20 text-white bg-secondary/50">Cota: {a.categoria}</Badge>}
             </TooltipContent>
           </Tooltip>
         </TooltipProvider>
       ))}
    </div>
  )
}
