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
  AlertTriangle,
  Layers,
  ChevronRight,
  Map as MapIcon
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

  const [selectedSector, setSelectedSector] = React.useState<any>(null)
  const [selectedType, setSelectedType] = React.useState<string | null>(null)
  const [isReserving, setIsReserving] = React.useState(false)

  // Lógica de Lote Ativo com Migração Automática por Setor
  const getSectorSaleStatus = (sector: any) => {
    if (!sector || !sector.batches || sector.batches.length === 0) return { active: false, message: "Indisponível", batch: null };
    
    const now = new Date();
    let carryOver = 0;
    
    const processedBatches = sector.batches.map((b: any) => {
      const start = b.startDate ? new Date(b.startDate) : null;
      const end = b.endDate ? new Date(b.endDate) : null;
      
      const isOpen = (!start || now >= start) && (!end || now <= end);
      const isPast = end && now > end;
      const isFuture = start && now < start;

      const currentCap = b.capacidadeInicial + carryOver;
      const sold = b.vendidos || 0;
      const remaining = currentCap - sold;
      
      if (isPast) carryOver = Math.max(0, remaining);
      else carryOver = 0;

      return { ...b, isOpen, isPast, isFuture, currentCap, remaining, sold };
    });

    const activeBatch = processedBatches.find((b: any) => b.isOpen && b.remaining > 0);
    if (activeBatch) return { active: true, message: null, batch: activeBatch };

    const nextBatch = processedBatches.find((b: any) => b.isFuture);
    if (nextBatch) return { active: false, message: `Abre em ${new Date(nextBatch.startDate).toLocaleString('pt-BR')}`, batch: null };

    return { active: false, message: "Encerrado", batch: null };
  };

  const globalSaleStatus = React.useMemo(() => {
    if (!event) return { active: false, message: "Indisponível", batch: null };
    if (event.ticketMode === 'sector_batches') return { active: true, message: "Selecione um setor", isSectorMode: true };
    
    // Reutiliza lógica para modo batches global (sem setor)
    const mockSector = { batches: event.batches || [] };
    return getSectorSaleStatus(mockSector);
  }, [event]);

  const handleAddToCart = (type: any, batch: any, sector?: any) => {
    if (!event) return;
    
    addItem({
      id: `${event.id}_${batch.id}_${type.id}_${sector?.id || 'gen'}`,
      eventId: event.id,
      eventTitle: event.title,
      eventImage: event.image || "",
      eventDate: event.date,
      eventCity: event.city || "",
      organizationId: event.organizationId,
      organizerId: event.organizerId,
      organizerUsername: params.username as string,
      ticketTypeId: type.id,
      ticketTypeName: type.name,
      batchId: batch.id,
      batchName: batch.name,
      price: type.price,
      quantity: 1,
      requiresProof: type.requiresProof || false,
      sectorId: sector?.id,
      sectorName: sector?.name,
      poolId: type.poolId,
      poolName: type.poolName
    });
    
    toast({ title: "No carrinho!" });
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

              {event.ticketMode === 'sector_batches' && (
                <div className="space-y-6">
                   <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary flex items-center gap-2">
                      <Layers className="w-5 h-5 text-secondary" /> Escolha o Setor
                   </h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {event.sectors?.map((sector: any) => {
                        const status = getSectorSaleStatus(sector);
                        return (
                          <Card 
                            key={sector.id} 
                            className={cn(
                              "border-none shadow-sm rounded-3xl cursor-pointer transition-all hover:scale-[1.02]",
                              selectedSector?.id === sector.id ? "ring-4 ring-secondary/20 bg-secondary/5" : "bg-white"
                            )}
                            onClick={() => setSelectedSector(sector)}
                          >
                             <CardContent className="p-6 flex items-center justify-between">
                                <div>
                                   <p className="text-lg font-black uppercase italic">{sector.name}</p>
                                   <p className="text-[10px] font-bold text-muted-foreground uppercase">{sector.capacity} lugares totais</p>
                                </div>
                                <div className="text-right">
                                   {status.active ? (
                                     <p className="text-[10px] font-black text-green-600 uppercase">Disponível</p>
                                   ) : (
                                     <p className="text-[10px] font-black text-orange-500 uppercase">{status.message}</p>
                                   )}
                                   <ChevronRight className="w-5 h-5 ml-auto opacity-20" />
                                </div>
                             </CardContent>
                          </Card>
                        )
                      })}
                   </div>
                </div>
              )}

              {/* Detalhes do Setor Selecionado */}
              {selectedSector && (
                <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                   <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden">
                      <CardHeader className="bg-primary text-white flex flex-row items-center justify-between">
                         <div>
                            <CardTitle className="text-xl font-black uppercase italic">{selectedSector.name}</CardTitle>
                            <CardDescription className="text-white/60 font-bold uppercase text-[10px]">Bilheteria do Setor</CardDescription>
                         </div>
                         <Button variant="ghost" size="icon" onClick={() => setSelectedSector(null)} className="text-white hover:bg-white/10"><X className="w-4 h-4" /></Button>
                      </CardHeader>
                      <CardContent className="p-8">
                         {(() => {
                           const status = getSectorSaleStatus(selectedSector);
                           if (!status.active) return <div className="py-12 text-center text-muted-foreground font-bold italic">{status.message}</div>;
                           
                           return (
                             <div className="space-y-6">
                                <div className="flex justify-between items-center px-2">
                                   <Badge variant="outline" className="text-[10px] font-black uppercase">{status.batch.name}</Badge>
                                   <p className="text-[10px] font-bold text-muted-foreground uppercase">{status.batch.remaining} un. restantes</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   {status.batch.ticketTypes.map((type: any) => (
                                     <div key={type.id} className="p-5 rounded-2xl border-2 border-muted hover:border-secondary transition-all bg-white flex flex-col gap-4">
                                        <div className="flex justify-between items-start">
                                           <div className="space-y-1">
                                              <p className="font-bold text-sm uppercase">{type.name}</p>
                                              {type.poolName && <p className="text-[8px] font-black text-secondary uppercase flex items-center gap-1"><Layers className="w-2.5 h-2.5" /> {type.poolName}</p>}
                                           </div>
                                           <p className="font-black text-primary">{formatCurrency(type.price)}</p>
                                        </div>
                                        <Button className="w-full rounded-xl font-black uppercase italic text-[10px] h-10" onClick={() => handleAddToCart(type, status.batch, selectedSector)}>Comprar</Button>
                                     </div>
                                   ))}
                                </div>
                             </div>
                           )
                         })()}
                      </CardContent>
                   </Card>
                </div>
              )}
           </div>

           <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-xl rounded-[2.5rem] border-t-8 border-secondary overflow-hidden bg-white sticky top-24">
                 <CardHeader><CardTitle className="text-xl font-black italic uppercase text-primary flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria Geral</CardTitle></CardHeader>
                 <CardContent className="space-y-6">
                    {globalSaleStatus.isSectorMode ? (
                      <div className="py-10 text-center space-y-4">
                         <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto"><MapIcon className="w-6 h-6 text-muted-foreground opacity-30" /></div>
                         <p className="text-[10px] font-black text-muted-foreground uppercase leading-tight">Selecione um setor no mapa ou na lista ao lado para ver os preços.</p>
                      </div>
                    ) : globalSaleStatus.batch ? (
                      <div className="space-y-6 animate-in slide-in-from-right-4">
                         <div className="p-5 bg-muted/30 rounded-2xl space-y-6">
                            <div className="flex justify-between text-[10px] font-black uppercase opacity-40"><span>Fase Ativa</span><span className="text-secondary">{globalSaleStatus.batch.name}</span></div>
                            
                            <div className="space-y-3">
                               {globalSaleStatus.batch.ticketTypes.map((type: any) => (
                                 <div key={type.id} className="flex justify-between items-center p-4 bg-white rounded-xl border shadow-sm">
                                    <div className="space-y-0.5">
                                       <p className="font-bold text-xs uppercase">{type.name}</p>
                                       <p className="text-[10px] font-black text-primary">{formatCurrency(type.price)}</p>
                                    </div>
                                    <Button size="sm" variant="secondary" className="h-8 rounded-lg font-black uppercase text-[10px]" onClick={() => handleAddToCart(type, globalSaleStatus.batch)}>Comprar</Button>
                                 </div>
                               ))}
                            </div>
                         </div>
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
