
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where, getDocs } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
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
  EyeOff
} from "lucide-react"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import { useCart } from "@/contexts/CartContext"
import Footer from "@/components/layout/Footer"

export default function EventoDetalhesPage() {
  const params = useParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { addItem, items: cartItems } = useCart()
  
  const eventId = params.id as string
  const usernameFromUrl = params.username as string

  const eventRef = React.useMemo(() => db ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)
  
  const organizationRef = React.useMemo(() => (db && event?.organizationId) ? doc(db, "organizations", event.organizationId) : null, [db, event?.organizationId])
  const { data: organizationProfile } = useDoc<any>(organizationRef)

  const mapsSettingsRef = React.useMemo(() => db ? doc(db, 'settings', 'maps') : null, [db])
  const { data: mapsSettings } = useDoc<any>(mapsSettingsRef)

  // Outros Organizadores (Aceitos)
  const partnersQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(collection(db, "events", eventId, "partners"), where("status", "==", "accepted"))
  }, [db, eventId])
  const { data: acceptedPartners } = useCollection<any>(partnersQuery)

  const availabilityQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(collection(db, "registrations"), where("eventId", "==", eventId))
  }, [db, eventId])
  const { data: allRegistrations } = useCollection<any>(availabilityQuery)

  const [activeBatch, setActiveBatch] = React.useState<any>(null)
  const [selectedTicketType, setSelectedTicketType] = React.useState<any>(null)
  const [saleStatus, setSaleStatus] = React.useState<'open' | 'pending' | 'ended' | 'soldout' | 'suspended'>('pending')
  const [quantity, setQuantity] = React.useState(1)

  React.useEffect(() => {
    if (!event) return

    // Se a organização não estiver ativa, suspende as vendas
    if (organizationProfile && organizationProfile.status !== 'Ativo') {
      setSaleStatus('suspended')
      return
    }

    const checkAvailability = () => {
      const now = new Date()
      const batches = event.batches || []
      
      const salesPerType = (allRegistrations || []).reduce((acc: any, reg: any) => {
        if (['Pago', 'Disponível'].includes(reg.paymentStatus)) {
          const tKey = `${reg.batchId}_${reg.ticketTypeId}`
          acc.types[tKey] = (acc.types[tKey] || 0) + 1
          
          if (reg.poolId) {
            const pKey = `${reg.batchId}_${reg.poolId}`
            acc.pools[pKey] = (acc.pools[pKey] || 0) + 1
          }
        }
        return acc
      }, { types: {}, pools: {} })

      let foundActiveBatch = null
      let status: 'open' | 'pending' | 'ended' | 'soldout' = 'ended'
      let hasUpcoming = false

      for (const batch of batches) {
        const start = batch.startDate ? new Date(batch.startDate) : null
        const end = batch.endDate ? new Date(batch.endDate) : null
        const isStarted = !start || now >= start
        const isNotEnded = !end || now <= end

        if (!isStarted) {
          hasUpcoming = true
          continue
        }

        if (isStarted && isNotEnded) {
          const typesWithStock = batch.ticketTypes.map((t: any) => {
            const sold = t.poolId ? (salesPerType.pools[`${batch.id}_${t.poolId}`] || 0) : (salesPerType.types[`${batch.id}_${t.id}`] || 0)
            const remaining = Math.max(0, (t.quantity || 0) - sold)
            return { ...t, remaining }
          }).filter((t: any) => t.remaining > 0)

          if (typesWithStock.length > 0) {
            foundActiveBatch = { ...batch, ticketTypes: typesWithStock }
            status = 'open'
            break
          } else {
            status = 'soldout'
            continue
          }
        }
      }

      setActiveBatch(foundActiveBatch)
      setSaleStatus(status === 'ended' && hasUpcoming ? 'pending' : status)
    }

    checkAvailability()
  }, [event, allRegistrations, organizationProfile])

  const handleAddToCart = () => {
    if (!selectedTicketType || !event || !activeBatch) return

    addItem({
      id: `${event.id}_${selectedTicketType.id}`,
      eventId: event.id,
      eventTitle: event.title,
      eventImage: event.image || "",
      eventDate: event.date,
      eventCity: event.city || "",
      organizationId: event.organizationId,
      organizerId: event.organizerId,
      organizerUsername: usernameFromUrl,
      ticketTypeId: selectedTicketType.id,
      ticketTypeName: selectedTicketType.name,
      batchId: activeBatch.id,
      batchName: activeBatch.name,
      poolId: selectedTicketType.poolId,
      poolName: selectedTicketType.poolName,
      price: selectedTicketType.price,
      quantity: quantity,
      requiresProof: selectedTicketType.requiresProof
    });

    toast({ 
      title: "Carrinho atualizado!", 
      description: `${quantity}x ${selectedTicketType.name} adicionado.`,
      action: <Button variant="secondary" size="sm" asChild><Link href="/dashboard/carrinho">Ver Carrinho</Link></Button>
    });
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  if (!event) return <div className="flex flex-col items-center py-20"><h2 className="text-2xl font-bold">Evento não encontrado</h2></div>

  const orgName = organizationProfile?.name || event.organizer?.name || "Organizador";
  const orgAvatar = organizationProfile?.avatar || event.organizer?.avatar;
  const isVerified = organizationProfile?.verified ?? event.organizer?.isVerified;

  const fullAddress = event.address ? 
    `${event.address.street}, ${event.address.number}${event.address.complement ? ` - ${event.address.complement}` : ''} - ${event.address.neighborhood}, ${event.address.city} - ${event.address.state}` : 
    event.location;

  const mapQuery = encodeURIComponent(fullAddress);
  
  const mapsApiKey = mapsSettings?.apiKey;
  const mapUrl = mapsApiKey 
    ? `https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${mapQuery}`
    : `https://maps.google.com/maps?q=${mapQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <div className="max-w-6xl mx-auto px-4 pt-10 space-y-8 flex-1 w-full">
        <div className="flex items-center justify-between">
           <Button variant="ghost" onClick={() => router.back()} className="rounded-full font-bold text-xs uppercase gap-2">
              <ArrowLeft className="w-4 h-4" /> Voltar
           </Button>
           <div className="flex gap-2">
              <Button variant="outline" size="icon" className="rounded-full h-10 w-10"><Share2 className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" className="rounded-full h-10 w-10 relative" asChild>
                <Link href="/dashboard/carrinho">
                  <ShoppingCart className="w-4 h-4" />
                  {cartItems.length > 0 && <span className="absolute -top-1 -right-1 bg-secondary text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">{cartItems.length}</span>}
                </Link>
              </Button>
           </div>
        </div>

        <div className="relative h-[300px] md:h-[450px] w-full rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white">
          <Image src={event.image || "https://picsum.photos/seed/event/1200/800"} alt={event.title} fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          <div className="absolute bottom-10 left-10 text-white space-y-4 pr-10">
             <div className="flex flex-wrap gap-2">
                <Badge className="bg-secondary px-4 py-1 rounded-full uppercase font-black tracking-widest">{event.categoryName || "Geral"}</Badge>
             </div>
             <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-[0.9]">{event.title}</h1>
             <div className="flex flex-wrap items-center gap-6 text-sm font-bold opacity-80">
                <span className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full"><MapPin className="w-4 h-4 text-secondary" /> {event.city}</span>
                <span className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full"><Calendar className="w-4 h-4 text-secondary" /> {new Date(event.date).toLocaleDateString('pt-BR')}</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
           <div className="lg:col-span-8 space-y-8">
              <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
                 <CardHeader className="bg-muted/30 pb-4"><CardTitle className="flex items-center gap-2 text-xl font-bold"><Info className="w-5 h-5 text-secondary" /> Sobre o Evento</CardTitle></CardHeader>
                 <CardContent className="pt-6">
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-lg font-medium">{event.description}</p>
                 </CardContent>
              </Card>

              <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
                 <CardHeader className="bg-muted/30 pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <CardTitle className="flex items-center gap-2 text-xl font-bold">
                        <MapIcon className="w-5 h-5 text-secondary" /> Localização
                      </CardTitle>
                      <div className="flex gap-2">
                         <Button variant="outline" size="sm" className="rounded-xl font-bold gap-2 h-10 border-secondary text-secondary hover:bg-secondary/5" asChild>
                           <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer">
                             <MapIcon className="w-4 h-4" />
                             Google Maps
                           </a>
                         </Button>
                         <Button variant="outline" size="sm" className="rounded-xl font-bold gap-2 h-10 border-[#33ccff] text-[#33ccff] hover:bg-[#33ccff]/5" asChild>
                           <a href={`https://waze.com/ul?q=${mapQuery}&navigate=yes`} target="_blank" rel="noopener noreferrer">
                             <Navigation className="w-4 h-4 fill-current" />
                             Waze
                           </a>
                         </Button>
                      </div>
                    </div>
                 </CardHeader>
                 <CardContent className="pt-6 space-y-6">
                    <div className="flex items-start gap-3">
                       <div className="p-2 bg-secondary/10 rounded-xl shrink-0">
                          <MapPin className="w-5 h-5 text-secondary" />
                       </div>
                       <div className="space-y-1">
                          <p className="font-bold text-lg leading-tight">{fullAddress}</p>
                          <p className="text-sm text-muted-foreground uppercase font-black tracking-widest opacity-60">Endereço do Evento</p>
                       </div>
                    </div>

                    <div className="h-[350px] w-full rounded-2xl overflow-hidden border bg-muted shadow-inner">
                       <iframe 
                         width="100%" 
                         height="100%" 
                         style={{ border: 0 }} 
                         loading="lazy" 
                         allowFullScreen 
                         referrerPolicy="no-referrer-when-downgrade"
                         src={mapUrl}
                       ></iframe>
                    </div>
                 </CardContent>
              </Card>
           </div>
           
           <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-xl rounded-[2rem] border-t-8 border-secondary overflow-hidden bg-white">
                 <CardHeader><CardTitle className="flex items-center gap-2 font-black italic uppercase tracking-tighter"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria</CardTitle></CardHeader>
                 <CardContent className="space-y-6">
                    {saleStatus === 'open' && activeBatch ? (
                       <div className="space-y-6">
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase opacity-60">Escolha o seu Ingresso ({activeBatch.name})</Label>
                             <div className="space-y-3">
                                {activeBatch.ticketTypes.map((type: any) => (
                                  <div 
                                    key={type.id} 
                                    onClick={() => setSelectedTicketType(type)}
                                    className={cn(
                                      "p-4 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center",
                                      selectedTicketType?.id === type.id ? "border-secondary bg-secondary/5 shadow-inner" : "border-muted hover:border-secondary/20"
                                    )}
                                  >
                                     <div className="space-y-1">
                                        <p className="font-bold text-sm uppercase">{type.name}</p>
                                        <div className="flex flex-wrap gap-2">
                                          {type.poolId && <Badge variant="outline" className="text-[7px] h-4 font-black uppercase border-secondary/20 text-secondary gap-1"><Layers className="w-2.5 h-2.5" /> {type.poolName || 'Pool'}</Badge>}
                                          {type.remaining <= 10 && <span className="text-[8px] font-black text-red-500 uppercase">Restam {type.remaining}</span>}
                                          {type.requiresProof && <Badge variant="outline" className="text-[7px] h-4 font-black uppercase border-orange-200 text-orange-600">Doc. Obrigatório</Badge>}
                                        </div>
                                     </div>
                                     <p className="font-black text-primary">{type.price === 0 ? 'GRÁTIS' : formatCurrency(type.price)}</p>
                                  </div>
                                ))}
                             </div>
                          </div>

                          {selectedTicketType && (
                             <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-dashed border-border">
                                <span className="text-[10px] font-black uppercase opacity-60">Quantidade</span>
                                <div className="flex items-center gap-4">
                                   <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus className="w-3 h-3" /></Button>
                                   <span className="font-black text-lg">{quantity}</span>
                                   <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setQuantity(Math.min(10, quantity + 1))}><Plus className="w-3 h-3" /></Button>
                                </div>
                             </div>
                          )}

                          <Button 
                            disabled={!selectedTicketType} 
                            onClick={handleAddToCart}
                            className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform gap-3"
                          >
                             <ShoppingCart className="w-6 h-6" /> Adicionar ao Carrinho
                          </Button>
                       </div>
                    ) : (
                      <div className="p-10 text-center space-y-2 bg-muted/20 rounded-2xl">
                         {saleStatus === 'suspended' ? (
                           <>
                              <EyeOff className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                              <p className="font-black uppercase italic">Vendas Suspensas</p>
                              <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase">O organizador ocultou esta página temporariamente.</p>
                           </>
                         ) : (
                           <>
                              <AlertTriangle className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                              <p className="font-black uppercase italic">{saleStatus === 'soldout' ? 'Esgotado' : saleStatus === 'pending' ? 'Vendas em Breve' : 'Vendas Encerradas'}</p>
                           </>
                         )}
                      </div>
                    )}
                 </CardContent>
              </Card>

              {/* ORGANIZADOR PRINCIPAL */}
              <Card className="border-none shadow-sm bg-white rounded-[2rem]">
                 <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-black text-muted-foreground tracking-widest">Realização</CardTitle></CardHeader>
                 <CardContent className="space-y-6">
                    <div className="flex items-center gap-4">
                       <Avatar className="h-14 w-14 border-2 border-secondary/20 p-0.5">
                          <AvatarImage src={orgAvatar} className="rounded-full object-cover" />
                          <AvatarFallback className="font-bold">{orgName.charAt(0)}</AvatarFallback>
                       </Avatar>
                       <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                             <h4 className="font-bold text-base leading-none">{orgName}</h4>
                             {isVerified && <ShieldCheck className="w-4 h-4 text-secondary" />}
                          </div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">{organizationProfile?.type || "Organizador"}</p>
                       </div>
                       <Button variant="ghost" size="icon" className="ml-auto rounded-full" asChild>
                          <Link href={`/${usernameFromUrl}`}><ExternalLink className="w-4 h-4 text-muted-foreground" /></Link>
                       </Button>
                    </div>
                 </CardContent>
              </Card>

              {/* OUTROS ORGANIZADORES (PARCEIROS ACEITOS) */}
              {acceptedPartners && acceptedPartners.length > 0 && (
                <Card className="border-none shadow-sm bg-white rounded-[2rem]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2">
                      <Users className="w-4 h-4 text-secondary" /> Outros Organizadores
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {acceptedPartners.map((partner: any) => (
                      <div key={partner.id} className="flex items-center gap-3 p-3 bg-muted/20 rounded-2xl border border-transparent hover:border-secondary/20 transition-all group">
                         <Avatar className="h-10 w-10 border border-muted">
                            <AvatarImage src={partner.orgAvatar} className="object-cover" />
                            <AvatarFallback className="font-bold">{partner.orgName.charAt(0)}</AvatarFallback>
                         </Avatar>
                         <div className="space-y-0.5 flex-1">
                            <div className="flex items-center gap-1.5">
                               <span className="font-bold text-sm leading-none">{partner.orgName}</span>
                               {partner.orgVerified && <ShieldCheck className="w-3 h-3 text-secondary" />}
                            </div>
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter">{partner.orgType}</p>
                         </div>
                         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-40 group-hover:opacity-100" asChild>
                            <Link href={`/${partner.orgUsername}`}><ExternalLink className="w-3.5 h-3.5" /></Link>
                         </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
           </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
