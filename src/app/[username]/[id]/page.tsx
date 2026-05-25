
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser } from "@/firebase"
import { doc } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { 
  Calendar, 
  MapPin, 
  Ticket, 
  Loader2, 
  ArrowLeft,
  ShoppingCart,
  Layers,
  ChevronRight,
  Map as MapIcon,
  X,
  Clock,
  Info,
  BadgeCheck
} from "lucide-react"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import { useCart } from "@/contexts/CartContext"
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

  // Lógica de Venda Ativa considerando data/hora e migração de lotes
  const getSaleStatus = (target: any) => {
    if (!target || !target.batches || target.batches.length === 0) {
      return { active: false, message: "Indisponível", batch: null };
    }
    
    const now = new Date();
    let carryOver = 0;
    
    const processedBatches = target.batches.map((b: any) => {
      const start = b.startDate ? new Date(b.startDate) : null;
      const end = b.endDate ? new Date(b.endDate) : null;
      
      const isOpen = (!start || now >= start) && (!end || now <= end);
      const isPast = end && now > end;
      const isFuture = start && now < start;

      const currentCap = (b.capacidadeInicial || b.quantity || 0) + carryOver;
      const sold = b.vendidos || 0;
      const remaining = Math.max(0, currentCap - sold);
      
      if (isPast) carryOver = remaining;
      else carryOver = 0;

      return { ...b, isOpen, isPast, isFuture, currentCap, remaining, sold };
    });

    const activeBatch = processedBatches.find((b: any) => b.isOpen && b.remaining > 0);
    if (activeBatch) return { active: true, message: null, batch: activeBatch };

    const nextBatch = processedBatches.find((b: any) => b.isFuture);
    if (nextBatch) return { active: false, message: `Abre em ${new Date(nextBatch.startDate).toLocaleString('pt-BR')}`, batch: null };

    return { active: false, message: "Esgotado", batch: null };
  };

  const globalSaleStatus = React.useMemo(() => {
    if (!event) return { active: false, message: "Indisponível", batch: null };
    if (event.ticketMode === 'sector_batches') return { active: true, message: "Selecione um setor", isSectorMode: true };
    
    return getSaleStatus(event);
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
      organizerId: event.organizerId || event.createdBy,
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
    
    toast({ title: "Adicionado ao carrinho!" });
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-secondary" /></div>
  if (!event) return null

  const address = event.address || {};
  const isVerified = event.organizer?.isVerified || false;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <div className="max-w-7xl mx-auto px-4 pt-10 space-y-8 flex-1 w-full">
        <div className="flex items-center justify-between">
           <Button variant="ghost" onClick={() => router.back()} className="rounded-full font-bold text-xs uppercase gap-2">
              <ArrowLeft className="w-4 h-4" /> Voltar
           </Button>
           <Button variant="outline" size="icon" className="relative h-10 w-10 bg-white" asChild>
             <Link href="/dashboard/carrinho">
               <ShoppingCart className="w-4 h-4" />
               {cartItems.length > 0 && <span className="absolute -top-1 -right-1 bg-secondary text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{cartItems.length}</span>}
             </Link>
           </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pb-20">
           <div className="lg:col-span-8 space-y-8">
              <div className="relative h-64 md:h-96 w-full rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white">
                <Image src={event.image || "https://picsum.photos/seed/event/1200/800"} alt={event.title} fill className="object-cover" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-10 left-10 text-white">
                   <Badge className="bg-secondary mb-3 uppercase font-black text-[10px] h-6 px-4">{event.categoryName || "Geral"}</Badge>
                   <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-none">{event.title}</h1>
                   <div className="flex items-center gap-4 mt-4 text-white/80 font-bold text-xs uppercase">
                      <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {new Date(event.date).toLocaleDateString('pt-BR')}</span>
                      <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {event.city || address.city}</span>
                   </div>
                </div>
              </div>

              <div className="p-8 bg-white rounded-[2.5rem] shadow-sm space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border-2 border-secondary/20">
                    <AvatarImage src={event.organizer?.avatar} className="object-cover" />
                    <AvatarFallback className="font-bold">{event.organizer?.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-black uppercase italic tracking-tighter text-lg">{event.organizer?.name}</p>
                      {isVerified && <BadgeCheck className="w-4 h-4 fill-blue-500 text-white" />}
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Organizador Oficial</p>
                  </div>
                </div>
                <Separator className="border-dashed" />
                <div className="prose prose-sm max-w-none text-muted-foreground font-medium leading-relaxed">
                  {event.description}
                </div>
              </div>

              {event.ticketMode === 'sector_batches' && (
                <div className="space-y-6">
                   <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary flex items-center gap-2">
                      <Layers className="w-5 h-5 text-secondary" /> Escolha o Setor
                   </h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {event.sectors?.map((sector: any) => {
                        const status = getSaleStatus(sector);
                        return (
                          <Card 
                            key={sector.id} 
                            className={cn(
                              "border-none shadow-sm rounded-[2rem] cursor-pointer transition-all hover:scale-[1.02]",
                              selectedSector?.id === sector.id ? "ring-4 ring-secondary/20 bg-secondary/5" : "bg-white"
                            )}
                            onClick={() => setSelectedSector(sector)}
                          >
                             <CardContent className="p-6 flex items-center justify-between">
                                <div>
                                   <p className="text-lg font-black uppercase italic text-primary">{sector.name}</p>
                                   <p className="text-[10px] font-bold text-muted-foreground uppercase">{sector.capacity} lugares totais</p>
                                </div>
                                <div className="text-right">
                                   {status.active ? (
                                     <p className="text-[10px] font-black text-green-600 uppercase bg-green-50 px-2 py-1 rounded-full border border-green-200">Disponível</p>
                                   ) : (
                                     <p className="text-[10px] font-black text-orange-500 uppercase">{status.message}</p>
                                   )}
                                   <ChevronRight className="w-5 h-5 ml-auto opacity-20 mt-1" />
                                </div>
                             </CardContent>
                          </Card>
                        )
                      })}
                   </div>
                </div>
              )}

              {selectedSector && (
                <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                   <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden border-t-8 border-secondary">
                      <CardHeader className="bg-primary/5 p-8 flex flex-row items-center justify-between">
                         <div className="space-y-1">
                            <div className="flex items-center gap-2">
                               <Layers className="w-4 h-4 text-secondary" />
                               <CardTitle className="text-2xl font-black uppercase italic tracking-tighter">{selectedSector.name}</CardTitle>
                            </div>
                            <CardDescription className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Bilheteria do Setor Selecionado</CardDescription>
                         </div>
                         <Button variant="ghost" size="icon" onClick={() => setSelectedSector(null)} className="rounded-full hover:bg-muted"><X className="w-4 h-4" /></Button>
                      </CardHeader>
                      <CardContent className="p-8">
                         {(() => {
                           const status = getSaleStatus(selectedSector);
                           if (!status.active) return <div className="py-20 text-center text-muted-foreground font-bold italic uppercase">{status.message}</div>;
                           
                           return (
                             <div className="space-y-8">
                                <div className="flex justify-between items-center px-2 bg-muted/20 p-4 rounded-2xl">
                                   <div className="space-y-0.5">
                                      <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Etapa de Venda</p>
                                      <Badge className="bg-secondary text-white font-black uppercase text-[10px] h-6 px-3">{status.batch.name}</Badge>
                                   </div>
                                   <div className="text-right">
                                      <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Saldo Restante</p>
                                      <p className="text-xs font-black text-primary uppercase">{status.batch.remaining} un.</p>
                                   </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   {status.batch.ticketTypes.map((type: any) => (
                                     <div key={type.id} className="p-6 rounded-[1.5rem] border-2 border-muted hover:border-secondary transition-all bg-white flex flex-col gap-4 shadow-sm">
                                        <div className="flex justify-between items-start">
                                           <div className="space-y-1">
                                              <p className="font-black text-sm uppercase italic text-primary">{type.name}</p>
                                              {type.poolId && <Badge variant="secondary" className="text-[7px] h-4 uppercase gap-1"><Layers className="w-2.5 h-2.5" /> Pool: {type.poolName || 'Geral'}</Badge>}
                                           </div>
                                           <p className="font-black text-secondary text-lg">{type.price === 0 ? "GRÁTIS" : formatCurrency(type.price)}</p>
                                        </div>
                                        {type.requiresProof && (
                                           <div className="flex gap-2 p-2 bg-muted/30 rounded-lg">
                                              <Info className="w-3 h-3 text-secondary shrink-0 mt-0.5" />
                                              <p className="text-[8px] font-bold text-muted-foreground uppercase leading-tight">Documento de comprovação obrigatório no acesso.</p>
                                           </div>
                                        )}
                                        <Button className="w-full rounded-xl font-black uppercase italic text-xs h-12 shadow-lg" onClick={() => handleAddToCart(type, status.batch, selectedSector)}>Comprar</Button>
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
              <Card className="border-none shadow-xl rounded-[2.5rem] border-t-8 border-primary overflow-hidden bg-white sticky top-24">
                 <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-2">
                       <Ticket className="w-5 h-5 text-secondary" /> Bilheteria Geral
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-8 pt-0 space-y-6">
                    {globalSaleStatus.isSectorMode ? (
                      <div className="py-12 text-center space-y-4 bg-muted/10 rounded-[2rem] border-2 border-dashed border-border/50">
                         <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm"><MapIcon className="w-8 h-8 text-muted-foreground opacity-20" /></div>
                         <p className="text-[10px] font-black text-muted-foreground uppercase leading-tight px-6">Para continuar, escolha uma área do evento ao lado.</p>
                      </div>
                    ) : globalSaleStatus.batch ? (
                      <div className="space-y-6 animate-in slide-in-from-right-4">
                         <div className="flex items-center justify-between px-2">
                            <Badge className="bg-secondary text-white font-black uppercase text-[9px] h-6 px-3">{globalSaleStatus.batch.name}</Badge>
                            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{globalSaleStatus.batch.remaining} UN. RESTANTES</p>
                         </div>
                         
                         <div className="space-y-3">
                            {globalSaleStatus.batch.ticketTypes.map((type: any) => (
                              <div key={type.id} className="flex justify-between items-center p-5 bg-white rounded-2xl border-2 border-muted hover:border-secondary/20 transition-all shadow-sm">
                                 <div className="space-y-0.5">
                                    <p className="font-black text-sm uppercase italic text-primary">{type.name}</p>
                                    <p className="text-xs font-black text-secondary">{type.price === 0 ? "Grátis" : formatCurrency(type.price)}</p>
                                 </div>
                                 <Button size="sm" variant="secondary" className="h-10 rounded-xl font-black uppercase italic text-[10px] px-6 shadow-md" onClick={() => handleAddToCart(type, globalSaleStatus.batch)}>Comprar</Button>
                              </div>
                            ))}
                         </div>

                         <div className="p-4 bg-muted/20 rounded-2xl flex gap-3">
                            <Clock className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                            <p className="text-[9px] font-bold text-muted-foreground uppercase leading-tight">Vendas abertas até {new Date(globalSaleStatus.batch.endDate || event.date).toLocaleDateString('pt-BR')} às {new Date(globalSaleStatus.batch.endDate || event.date).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}.</p>
                         </div>
                      </div>
                    ) : (
                      <div className="py-24 text-center bg-muted/20 rounded-[2rem] border-2 border-dashed border-border/50">
                         <X className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-10" />
                         <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{globalSaleStatus.message}</p>
                      </div>
                    )}
                 </CardContent>
              </Card>

              <Card className="border-none shadow-sm rounded-[2rem] bg-white">
                <CardHeader>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-secondary" /> Local do Evento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs font-bold text-foreground">
                    {address.street}, {address.number}
                    {address.complement && ` - ${address.complement}`}
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    {address.neighborhood}, {address.city} - {address.state}
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    CEP: {address.cep}
                  </p>
                </CardContent>
              </Card>
           </div>
        </div>
      </div>
    </div>
  )
}
