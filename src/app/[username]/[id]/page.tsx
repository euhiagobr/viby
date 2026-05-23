
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where, orderBy, getDocs, updateDoc, serverTimestamp, setDoc } from "firebase/firestore"
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
  ArrowLeft,
  ShoppingCart,
  Clock,
  Lock,
  CheckCircle2,
  AlertTriangle
} from "lucide-react"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import { useCart } from "@/contexts/CartContext"
import { reserveSeat } from "@/lib/ticketing-service"
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
    return query(collection(db, "events", eventId, "setores"), orderBy("zIndex", "asc"))
  }, [db, eventId])
  const { data: setores } = useCollection<any>(setoresQuery)

  const [selectedSector, setSelectedSector] = React.useState<any>(null)
  const [selectedSeat, setSelectedSeat] = React.useState<any>(null)
  const [selectedType, setSelectedType] = React.useState<'inteira' | 'meia'>('inteira')
  const [isReserving, setIsReserving] = React.useState(false)

  // Lógica de Lote Ativo com Migração Automática
  const saleStatus = React.useMemo(() => {
    if (!event || !event.batches || event.batches.length === 0) return { active: false, message: "Indisponível", batch: null };
    
    const now = new Date();
    
    // Processar migração de sobras e janelas
    let carryOver = 0;
    const processedBatches = event.batches.map((b: any) => {
      const start = b.salesStart ? new Date(b.salesStart) : null;
      const end = b.salesEnd ? new Date(b.salesEnd) : null;
      
      const isOpen = (!start || now >= start) && (!end || now <= end);
      const isPast = end && now > end;
      const isFuture = start && now < start;

      const currentCap = b.initialCapacity + carryOver;
      const sold = b.sold || 0;
      const remaining = currentCap - sold;
      
      if (isPast) carryOver = Math.max(0, remaining);
      else carryOver = 0;

      return { ...b, isOpen, isPast, isFuture, currentCap, remaining, sold };
    });

    const activeBatch = processedBatches.find((b: any) => b.isOpen && b.remaining > 0);

    if (activeBatch) {
      return { active: true, message: null, batch: activeBatch };
    }

    const nextBatch = processedBatches.find((b: any) => b.isFuture);
    if (nextBatch) {
      return { active: false, message: `Abre em ${new Date(nextBatch.salesStart).toLocaleString('pt-BR')}`, batch: null };
    }

    return { active: false, message: "Vendas encerradas", batch: null };
  }, [event]);

  const handleSeatClick = async (seat: any, sector: any) => {
    if (!user) { toast({ title: "Login necessário" }); router.push("/login"); return; }
    if (!db || isReserving || seat.status !== 'disponivel') return;
    if (!saleStatus.active) { toast({ variant: "destructive", title: "Bilheteria fechada" }); return; }

    setIsReserving(true);
    try {
      await reserveSeat(db, eventId, sector.id, seat.id, user.uid);
      setSelectedSector(sector);
      setSelectedSeat(seat);
      toast({ title: "Lugar reservado!", description: "Você tem 10 minutos para concluir." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsReserving(false);
    }
  }

  const handleAddToCart = () => {
    if (!event || !saleStatus.batch) return;
    
    const batch = saleStatus.batch;
    const finalPrice = selectedType === 'inteira' ? batch.price : batch.price / 2;

    addItem({
      id: `${event.id}_${batch.id}_${selectedSeat?.id || 'gen'}_${selectedType}`,
      eventId: event.id,
      eventTitle: event.title,
      eventImage: event.image || "",
      eventDate: event.date,
      eventCity: event.city || "",
      organizationId: event.organizationId,
      organizerId: event.organizerId,
      organizerUsername: params.username as string,
      ticketTypeId: selectedType,
      ticketTypeName: selectedType === 'inteira' ? "Inteira" : "Meia-Entrada (40%)",
      batchId: batch.id,
      batchName: batch.name,
      price: finalPrice,
      quantity: 1,
      requiresProof: selectedType === 'meia',
      seatId: selectedSeat?.id,
      sectorId: selectedSector?.id
    });
    
    toast({ title: "No carrinho!" });
    setSelectedSeat(null);
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-secondary" /></div>
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
                   <Badge className="bg-secondary mb-2 uppercase font-black text-[9px]">{event.categoryName}</Badge>
                   <h1 className="text-4xl font-black uppercase italic tracking-tighter">{event.title}</h1>
                </div>
              </div>

              {!saleStatus.active && (
                <div className="p-6 bg-orange-50 border-2 border-dashed border-orange-200 rounded-[2rem] flex items-center gap-4 text-orange-800">
                   <Lock className="w-8 h-8 opacity-40" />
                   <div>
                      <p className="font-black uppercase italic text-sm">Vendas Suspensas</p>
                      <p className="text-xs font-bold opacity-60 uppercase">{saleStatus.message}</p>
                   </div>
                </div>
              )}

              {event.hasMap && setores ? (
                <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
                   <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
                      <CardTitle className="text-lg font-bold flex items-center gap-2"><MapIcon className="w-5 h-5 text-secondary" /> Planta Visual</CardTitle>
                   </CardHeader>
                   <CardContent className="p-10 bg-[#fafafa] relative overflow-auto min-h-[400px]">
                      <div className="relative mx-auto w-full max-w-4xl h-[400px] border-2 border-dashed border-muted flex items-center justify-center">
                        <div className="absolute top-10 bg-primary text-white p-4 rounded-xl font-black uppercase italic tracking-widest text-xs">PALCO</div>
                        {setores.map((s: any) => (
                           <div 
                             key={s.id} 
                             onClick={() => saleStatus.active && setSelectedSector(s)}
                             className={cn(
                               "absolute p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center",
                               selectedSector?.id === s.id ? "border-secondary bg-secondary/5 ring-4 ring-secondary/10" : "border-muted hover:border-secondary/20 bg-white"
                             )}
                             style={{ left: s.posX || 0, top: s.posY || 0, width: s.width || 120, height: s.height || 120 }}
                           >
                              <span className="text-[8px] font-black uppercase text-muted-foreground">{s.nome}</span>
                              <Armchair className="w-6 h-6 text-secondary mt-1" />
                           </div>
                        ))}
                      </div>
                   </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {saleStatus.batch && (
                     <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-6">
                        <div className="space-y-1">
                           <Badge className="bg-secondary text-white uppercase text-[8px] font-black">{saleStatus.batch.name}</Badge>
                           <h4 className="text-2xl font-black uppercase italic tracking-tighter">Escolha seu tipo</h4>
                        </div>
                        <div className="space-y-3">
                           <button onClick={() => setSelectedType('inteira')} className={cn("w-full p-4 rounded-2xl border-2 transition-all flex justify-between items-center", selectedType === 'inteira' ? "border-secondary bg-secondary/5" : "border-muted")}>
                              <span className="font-bold text-sm uppercase">Inteira</span>
                              <span className="font-black text-primary">{formatCurrency(saleStatus.batch.price)}</span>
                           </button>
                           {event.autoHalfPrice && (
                             <button onClick={() => setSelectedType('meia')} className={cn("w-full p-4 rounded-2xl border-2 transition-all flex justify-between items-center", selectedType === 'meia' ? "border-secondary bg-secondary/5" : "border-muted")}>
                                <span className="font-bold text-sm uppercase">Meia-Entrada (40%)</span>
                                <span className="font-black text-primary">{formatCurrency(saleStatus.batch.price / 2)}</span>
                             </button>
                           )}
                        </div>
                        <Button onClick={handleAddToCart} className="w-full h-14 bg-primary text-white font-black rounded-xl uppercase italic">Comprar Agora</Button>
                     </Card>
                   )}
                </div>
              )}
           </div>

           <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-xl rounded-[2.5rem] border-t-8 border-secondary overflow-hidden bg-white sticky top-24">
                 <CardHeader><CardTitle className="text-xl font-black italic uppercase text-primary flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria</CardTitle></CardHeader>
                 <CardContent className="space-y-6">
                    {saleStatus.batch ? (
                      <div className="space-y-6 animate-in slide-in-from-right-4">
                         <div className="p-5 bg-muted/30 rounded-2xl space-y-4">
                            <div className="flex justify-between text-[10px] font-black uppercase opacity-40"><span>Fase Ativa</span><span className="text-secondary">{saleStatus.batch.name}</span></div>
                            <div className="flex justify-between text-[10px] font-black uppercase opacity-40"><span>Disponível</span><span>{saleStatus.batch.remaining} un.</span></div>
                            <Separator className="border-dashed" />
                            <div className="space-y-4">
                               <p className="text-[9px] font-black uppercase opacity-40">Selecione a Modalidade</p>
                               <div className="grid grid-cols-1 gap-2">
                                  <button onClick={() => setSelectedType('inteira')} className={cn("flex justify-between p-4 rounded-xl border-2 text-xs font-bold", selectedType === 'inteira' ? "border-secondary bg-secondary/5" : "border-muted")}>
                                     <span>INTEIRA</span>
                                     <span>{formatCurrency(saleStatus.batch.price)}</span>
                                  </button>
                                  {event.autoHalfPrice && (
                                    <button onClick={() => setSelectedType('meia')} className={cn("flex justify-between p-4 rounded-xl border-2 text-xs font-bold", selectedType === 'meia' ? "border-secondary bg-secondary/5" : "border-muted")}>
                                       <span>MEIA-ENTRADA</span>
                                       <span>{formatCurrency(saleStatus.batch.price / 2)}</span>
                                    </button>
                                  )}
                               </div>
                            </div>
                            <Separator className="border-dashed" />
                            <div className="flex justify-between items-center">
                               <span className="text-xs font-black uppercase italic">Total</span>
                               <span className="text-2xl font-black text-primary">{formatCurrency(selectedType === 'inteira' ? saleStatus.batch.price : saleStatus.batch.price / 2)}</span>
                            </div>
                         </div>
                         <Button onClick={handleAddToCart} disabled={isReserving} className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform">
                            {isReserving ? <Loader2 className="animate-spin" /> : "Adicionar ao Carrinho"}
                         </Button>
                      </div>
                    ) : (
                      <div className="py-20 text-center opacity-30 italic uppercase text-[10px] font-black">Bilheteria Indisponível</div>
                    )}
                 </CardContent>
              </Card>
           </div>
        </div>
      </div>
    </div>
  )
}
