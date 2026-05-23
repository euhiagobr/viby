
"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
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
  Maximize
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

  // Lógica Dinâmica de Lote Ativo com Migração de Capacidade
  const activeBatchInfo = React.useMemo(() => {
    if (!event?.batches || event.batches.length === 0) return null;
    
    const now = new Date();
    const sortedBatches = [...event.batches];
    let carryOver = 0;

    for (let i = 0; i < sortedBatches.length; i++) {
      const b = sortedBatches[i];
      const start = b.startDate ? new Date(b.startDate) : null;
      const end = b.endDate ? new Date(b.endDate) : null;
      
      const capAtual = (b.capacidadeInicial || 0) + carryOver;
      const vendidos = b.vendidos || 0;
      const restantes = Math.max(0, capAtual - vendidos);

      // Verificamos se este é o lote que deve estar vendendo agora
      const isDateValid = (!start || now >= start) && (!end || now <= end);
      
      if (isDateValid && restantes > 0) {
        return { ...b, capacidadeAtual: capAtual, restantes };
      }

      // Se o lote expirou ou acabou, a sobra migra
      carryOver = restantes;
    }

    // Se nenhum lote estiver na data ou com estoque, retorna o último como fallback
    const last = sortedBatches[sortedBatches.length - 1];
    return { ...last, capacidadeAtual: (last.capacidadeInicial || 0) + carryOver, restantes: Math.max(0, (last.capacidadeInicial || 0) + carryOver - (last.vendidos || 0)) };
  }, [event?.batches]);

  // Determina os tipos de ingresso disponíveis para o setor selecionado no lote calculado
  const availableOptionsForSector = React.useMemo(() => {
    if (!selectedSector || !activeBatchInfo) return []
    
    // Se o setor estiver vinculado dinamicamente, buscamos todas as variações desse nome no lote ativo
    if (selectedSector.linkedTicketName) {
      return activeBatchInfo.ticketTypes.filter((t: any) => t.name === selectedSector.linkedTicketName)
    }

    // Fallback: se não houver vínculo dinâmico, mostramos o que foi configurado manualmente no setor
    return [{
       id: selectedSector.id,
       name: selectedSector.nome,
       price: selectedSector.preco,
       batchId: activeBatchInfo.id,
       batchName: activeBatchInfo.name
    }]
  }, [selectedSector, activeBatchInfo])

  // Seleciona automaticamente o primeiro tipo (Inteira) ao escolher um setor
  React.useEffect(() => {
     if (availableOptionsForSector.length > 0) {
        setSelectedTicketType(availableOptionsForSector[0])
     } else {
        setSelectedTicketType(null)
     }
  }, [availableOptionsForSector])

  const handleSeatClick = async (seat: any, sector: any) => {
    if (!user) { toast({ title: "Ação necessária", description: "Faça login para selecionar assentos." }); router.push("/login"); return; }
    if (!db || isReserving || seat.status !== 'disponivel') return;

    setIsReserving(true);
    try {
      await reserveSeat(db, eventId, sector.id, seat.id, user.uid);
      setSelectedSector(sector);
      setSelectedSeat(seat);
      toast({ title: "Lugar selecionado!", description: "Você tem 10 minutos para concluir a compra." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsReserving(false);
    }
  }

  const handleAddToCart = () => {
    if (!selectedSector || !event || !selectedTicketType || !globalFees) return
    
    const isNumbered = selectedSector.tipo !== 'livre';
    if (isNumbered && !selectedSeat) {
      toast({ variant: "destructive", title: "Selecione um lugar", description: "Escolha um lugar no mapa." });
      return;
    }

    // Verificação de estoque final
    if (activeBatchInfo && activeBatchInfo.restantes <= 0) {
      toast({ variant: "destructive", title: "Lote Esgotado", description: "Infelizmente este lote não possui mais ingressos disponíveis." });
      return;
    }

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
      batchId: activeBatchInfo?.id || "map",
      batchName: activeBatchInfo?.name || "Lote Atual",
      price: selectedTicketType.price,
      quantity: 1,
      requiresProof: selectedTicketType.requiresProof || (selectedSeat?.categoria && selectedSeat.categoria !== 'comum'),
      seatId: selectedSeat?.id,
      seatCode: selectedSeat?.codigo,
      sectorId: selectedSector.id
    });

    toast({ title: "Adicionado ao carrinho!" });
    if (isNumbered) setSelectedSeat(null);
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  if (!event) return null

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <div className="max-w-7xl mx-auto px-4 pt-10 space-y-8 flex-1 w-full">
        <div className="flex items-center justify-between">
           <Button variant="ghost" onClick={() => router.back()} className="rounded-full font-bold text-xs uppercase gap-2">
              <ArrowLeft className="w-4 h-4" /> Voltar
           </Button>
           <Button variant="outline" size="icon" className="rounded-full h-10 w-10 relative" asChild>
             <Link href="/dashboard/carrinho">
               <ShoppingCart className="w-4 h-4" />
               {cartItems.length > 0 && <span className="absolute -top-1 -right-1 bg-secondary text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">{cartItems.length}</span>}
             </Link>
           </Button>
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

              {activeBatchInfo && (
                <div className="flex items-center justify-between p-6 bg-white rounded-[2rem] shadow-sm border border-border/50">
                  <div className="flex items-center gap-4">
                     <div className="p-3 bg-secondary/10 rounded-2xl text-secondary">
                        <Ticket className="w-6 h-6" />
                     </div>
                     <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Janela de Venda Ativa</p>
                        <h3 className="text-xl font-black italic uppercase text-primary tracking-tighter">{activeBatchInfo.name}</h3>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Disponibilidade</p>
                     <p className="text-sm font-bold text-secondary">{activeBatchInfo.restantes} Ingressos Restantes</p>
                  </div>
                </div>
              )}

              {event.possuiMapa && setores && (
                <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
                   <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
                      <CardTitle className="text-lg font-bold flex items-center gap-2"><MapIcon className="w-5 h-5 text-secondary" /> Mapa de Ingressos</CardTitle>
                      <div className="flex gap-2">
                         <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-white border border-secondary rounded-sm" /> <span className="text-[8px] font-black uppercase">Livre</span></div>
                         <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-secondary rounded-sm" /> <span className="text-[8px] font-black uppercase">Selecionado</span></div>
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
                                 <div 
                                   className="absolute bg-primary text-white flex flex-col items-center justify-center rounded-2xl shadow-2xl border-4 border-white/10"
                                   style={{ 
                                     left: event.palcoPosX || 700, 
                                     top: event.palcoPosY || 50, 
                                     width: event.palcoWidth || 600, 
                                     height: event.palcoHeight || 120 
                                   }}
                                 >
                                    <span className="font-black italic uppercase tracking-[0.4em] text-lg">{event.palcoNome || "PALCO"}</span>
                                 </div>

                                 {/* Setores Interativos */}
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
                                         {s.tipo === 'livre' && (
                                            <p className="text-[9px] font-black opacity-60" style={{ color: s.cor }}>A partir de {formatCurrency(s.preco)}</p>
                                         )}
                                      </div>
                                      {s.tipo !== 'livre' && (
                                         <div className="absolute inset-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 flex flex-col items-center justify-center rounded-[inherit] overflow-hidden">
                                            <p className="text-[9px] font-black uppercase text-primary mb-3">Escolher Lugar</p>
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
           </div>
           
           <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-xl rounded-[2.5rem] border-t-8 border-secondary overflow-hidden bg-white sticky top-24">
                 <CardHeader><CardTitle className="flex items-center gap-2 font-black italic uppercase tracking-tighter"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria</CardTitle></CardHeader>
                 <CardContent className="space-y-6">
                    {selectedSector ? (
                       <div className="space-y-6 animate-in slide-in-from-right-4">
                          <div className="p-5 bg-muted/30 rounded-2xl space-y-4">
                             <div className="flex justify-between"><span className="text-[10px] font-black uppercase opacity-40">Setor</span><span className="font-bold text-sm uppercase">{selectedSector.nome}</span></div>
                             {selectedSeat && (
                               <div className="flex justify-between items-center">
                                 <span className="text-[10px] font-black uppercase opacity-40">Lugar</span>
                                 <div className="flex flex-col items-end">
                                    <span className="font-black text-secondary uppercase italic">{selectedSeat.codigo}</span>
                                    {selectedSeat.categoria !== 'comum' && <Badge variant="outline" className="text-[8px] h-4 uppercase border-secondary text-secondary">{selectedSeat.categoria}</Badge>}
                                 </div>
                               </div>
                             )}
                             
                             <Separator className="border-dashed" />
                             
                             <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase opacity-40">Escolha o Tipo de Ingresso</Label>
                                <div className="space-y-2">
                                   {availableOptionsForSector.map((option: any) => (
                                      <div 
                                        key={option.id}
                                        onClick={() => setSelectedTicketType(option)}
                                        className={cn(
                                          "p-3 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center",
                                          selectedTicketType?.id === option.id ? "border-secondary bg-secondary/5" : "border-transparent bg-white hover:bg-muted"
                                        )}
                                      >
                                         <div className="flex flex-col">
                                            <span className="text-xs font-bold uppercase">{option.name}</span>
                                            <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">{activeBatchInfo?.name || "Lote Atual"}</span>
                                         </div>
                                         <span className="font-black text-sm text-primary">{formatCurrency(option.price)}</span>
                                      </div>
                                   ))}
                                </div>
                             </div>

                             <Separator className="border-dashed" />
                             <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase opacity-40">Valor Total</span><span className="text-xl font-black text-primary">{formatCurrency(selectedTicketType?.price || 0)}</span></div>
                          </div>

                          <Button 
                            disabled={(selectedSector.tipo !== 'livre' && !selectedSeat) || !selectedTicketType || (activeBatchInfo && activeBatchInfo.restantes <= 0)}
                            onClick={handleAddToCart} 
                            className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform gap-3"
                          >
                             <ShoppingCart className="w-6 h-6" /> {activeBatchInfo?.restantes === 0 ? "Esgotado" : (selectedSector.tipo !== 'livre' ? "Garantir Lugar" : "Adicionar ao Carrinho")}
                          </Button>
                       </div>
                    ) : (
                      <div className="p-10 text-center space-y-4 opacity-30">
                         <MapIcon className="w-8 h-8 mx-auto" />
                         <p className="text-[10px] font-black uppercase italic">Clique em um setor no mapa para prosseguir</p>
                      </div>
                    )}
                 </CardContent>
              </Card>
           </div>
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
                     "w-6 h-6 rounded-[2px] text-[6px] font-black border transition-all",
                     a.status === 'disponivel' ? "bg-white border-muted hover:border-secondary hover:scale-110" : "cursor-not-allowed",
                     selectedSeat?.id === a.id ? "bg-secondary border-secondary text-white scale-125 z-10" :
                     a.status === 'vendido' ? "bg-muted border-transparent opacity-30" :
                     a.status === 'reservado' ? "bg-orange-400 border-orange-400 text-white" : ""
                   )}
                 >
                    {a.codigo.slice(-2)}
                 </button>
              </TooltipTrigger>
              <TooltipContent className="text-[9px] font-bold uppercase">{a.codigo} • {formatCurrency(setor.preco)}</TooltipContent>
           </Tooltip>
         </TooltipProvider>
       ))}
    </div>
  )
}
