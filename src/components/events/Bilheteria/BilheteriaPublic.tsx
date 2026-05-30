"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Ticket, 
  ShoppingCart, 
  Clock, 
  Plus, 
  Minus, 
  ShieldCheck,
  Calendar,
  AlertCircle,
  Zap,
  ArrowRight,
  ChevronDown,
  Lock,
  MapPin,
  CheckCircle2,
  XCircle,
  Armchair,
  Users
} from "lucide-react"
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { formatCurrency, calculateFinancialBreakdown } from "@/lib/financial-utils"
import { useCart } from "@/contexts/CartContext"
import { toast } from "@/hooks/use-toast"
import { useAuth, useUser } from "@/firebase"
import { useRouter, usePathname } from "next/navigation"

interface BilheteriaPublicProps {
  event: any
  globalFees: any
  promotions: any
  orgSettings: any
}

export function BilheteriaPublic({ event, globalFees, promotions, orgSettings }: BilheteriaPublicProps) {
  const { addItem, items } = useCart()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  const pathname = usePathname()

  const [quantities, setQuantities] = React.useState<Record<string, number>>({})

  const handleUpdateQty = (typeId: string, val: number) => {
    setQuantities(prev => ({ ...prev, [typeId]: Math.max(0, val) }))
  }

  const handleAddToCart = (batch: any, type: any) => {
    if (!user) {
      toast({ title: "Ação necessária", description: "Faça login para garantir seu ingresso." })
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`)
      return
    }

    // Trava Global de Capacidade (Recorrente)
    if (event.isRecurring && event.isSoldOut) {
      toast({ variant: "destructive", title: "Data Lotada", description: "Infelizmente não há mais vagas para esta data." });
      return;
    }

    const qty = quantities[type.id] || 1
    if (qty <= 0) return

    addItem({
      id: `${event.id}_${batch.id}_${type.id}${event.occurrenceId ? `_${event.occurrenceId}` : ''}`,
      eventId: event.id,
      eventTitle: event.title,
      eventImage: event.image || '',
      eventDate: event.date,
      eventCity: event.city || '',
      organizationId: event.organizationId,
      organizerId: event.organizerId,
      organizerUsername: event.organizer?.username || '',
      ticketTypeId: type.id,
      ticketTypeName: type.name,
      batchId: batch.id,
      batchName: batch.name,
      poolId: type.poolId || null,
      poolName: type.poolName || null,
      occurrenceId: event.occurrenceId || null, // Vínculo obrigatório para recorrentes
      price: type.price,
      quantity: qty,
      requiresProof: type.requiresProof || false,
      ageRating: event.ageRating?.code
    })

    toast({ title: "Adicionado ao carrinho!" })
    setQuantities(prev => ({ ...prev, [type.id]: 0 }))
  }

  const getBatchStatus = (batch: any) => {
    if (event.isSoldOut) return 'esgotado';
    const now = new Date()
    const start = batch.startDate ? new Date(batch.startDate) : null
    const end = batch.endDate ? new Date(batch.endDate) : null
    
    const isFuture = start && now < start
    const isEnded = end && now > end
    const isActive = (!start || now >= start) && (!end || now <= end)
    
    const isSoldOut = batch.ticketTypes.every((t: any) => t.quantity <= 0)

    if (isSoldOut) return 'esgotado'
    if (isEnded) return 'encerrado'
    if (isFuture) return 'futuro'
    return 'ativo'
  }

  const getStatusText = (status: string, batch: any) => {
    if (status === 'esgotado' && event.isRecurring) return "Capacidade Máxima Atingida";
    const start = batch.startDate ? new Date(batch.startDate) : null
    const end = batch.endDate ? new Date(batch.endDate) : null

    switch (status) {
      case 'esgotado': return "Esgotado"
      case 'encerrado': return `Vendas encerradas dia ${end?.toLocaleDateString('pt-BR')} às ${end?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      case 'futuro': return `Abre as vendas dia ${start?.toLocaleDateString('pt-BR')} às ${start?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      case 'ativo': return end ? `Vendas abertas até ${end.toLocaleDateString('pt-BR')} às ${end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : "Vendas Abertas"
      default: return ""
    }
  }

  if (event.ticketMode === 'none' || !event.ticketMode) return null

  // Ordenar lotes por data
  const sortedBatches = React.useMemo(() => {
    if (!event.batches) return []
    return [...event.batches].sort((a, b) => {
      const dateA = a.startDate ? new Date(a.startDate).getTime() : 0
      const dateB = b.startDate ? new Date(b.startDate).getTime() : 0
      return dateA - dateB
    })
  }, [event.batches])

  const activeBatchId = sortedBatches.find(b => getBatchStatus(b) === 'ativo')?.id

  const renderSingleTicket = (batch: any) => {
    const status = getBatchStatus(batch)
    const canBuy = status === 'ativo'

    return (
      <div className="space-y-4">
        {batch.ticketTypes.map((type: any) => {
          const breakdown = calculateFinancialBreakdown(type.price, globalFees, promotions, orgSettings)
          const qty = quantities[type.id] || 0
          const isFree = type.price <= 0
          const isLastTickets = type.quantity > 0 && type.quantity <= 10

          return (
            <Card key={type.id} className={cn(
              "border-none shadow-sm rounded-[2rem] bg-white overflow-hidden transition-all",
              qty > 0 && "ring-2 ring-secondary shadow-xl",
              !canBuy && "opacity-60 grayscale-[0.5]"
            )}>
              <CardContent className="p-8">
                 <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="space-y-3 flex-1">
                       <div className="flex items-center gap-3">
                          <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">{type.name}</h3>
                          {isLastTickets && canBuy && <Badge className="bg-orange-500 text-white border-none animate-pulse text-[8px] font-black uppercase">Últimos Ingressos</Badge>}
                          {status === 'esgotado' && <Badge variant="destructive" className="text-[8px] font-black uppercase">Esgotado</Badge>}
                       </div>
                       <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
                          {getStatusText(status, batch)}
                       </p>
                       {type.requiresProof && (
                         <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-xl border border-orange-100 w-fit">
                            <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
                            <p className="text-[9px] text-orange-700 font-bold uppercase">{type.proofDescription || "Documento obrigatório no check-in."}</p>
                         </div>
                       )}
                    </div>
                    <div className="flex items-center gap-6">
                       <div className="text-right">
                          <p className="text-3xl font-black text-primary italic tracking-tighter">
                             {isFree ? "GRÁTIS" : formatCurrency(type.price)}
                          </p>
                          {!isFree && <p className="text-[8px] font-black text-muted-foreground uppercase opacity-50">+ {formatCurrency(breakdown.administrativeFeeAmount)} taxa</p>}
                       </div>
                       <div className="flex items-center gap-3 bg-muted/40 p-2 rounded-2xl border">
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white" onClick={() => handleUpdateQty(type.id, qty - 1)} disabled={qty <= 0 || !canBuy}><Minus className="w-3.5 h-3.5" /></Button>
                          <span className="font-black text-base w-6 text-center">{qty}</span>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white" onClick={() => handleUpdateQty(type.id, qty + 1)} disabled={!canBuy}><Plus className="w-3.5 h-3.5" /></Button>
                       </div>
                       <Button onClick={() => handleAddToCart(batch, type)} disabled={qty <= 0 || !canBuy} className={cn("h-14 px-8 rounded-2xl font-black uppercase italic shadow-lg transition-all", qty > 0 ? "bg-secondary text-white scale-105" : "bg-muted text-muted-foreground")}>
                          <ShoppingCart className="w-5 h-5 mr-2" /> {status === 'futuro' ? "Em Breve" : "Garantir"}
                       </Button>
                    </div>
                 </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <section id="bilheteria" className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
         <h2 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Bilheteria</h2>
         <p className="text-muted-foreground font-medium">Escolha seu acesso e garanta seu lugar.</p>
      </div>

      {event.isSoldOut && (
         <div className="p-6 bg-red-50 rounded-[2.5rem] border-2 border-dashed border-red-200 flex items-center justify-center gap-4 animate-in zoom-in-95">
            <Users className="w-8 h-8 text-red-600 animate-bounce" />
            <p className="text-sm font-black uppercase italic text-red-800 tracking-tight">Capacidade Máxima atingida para esta data!</p>
         </div>
      )}

      {(event.ticketMode === 'batches') ? (
        <Accordion type="multiple" defaultValue={activeBatchId ? [activeBatchId] : []} className="space-y-4">
          {sortedBatches.map((batch: any) => {
            const status = getBatchStatus(batch)
            const canBuy = status === 'ativo'
            
            return (
              <AccordionItem key={batch.id} value={batch.id} className="border-none">
                <Card className={cn(
                  "overflow-hidden rounded-[2.5rem] bg-white transition-all shadow-sm",
                  status === 'ativo' ? "ring-2 ring-secondary/20 shadow-md" : "opacity-75 grayscale-[0.3]"
                )}>
                  <AccordionTrigger className="hover:no-underline px-8 py-6 group">
                     <div className="flex flex-1 items-center justify-between gap-4">
                        <div className="flex items-center gap-4 text-left">
                           <div className={cn(
                             "p-3 rounded-2xl",
                             status === 'ativo' ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"
                           )}>
                              {status === 'ativo' ? <Zap className="w-5 h-5 fill-current" /> : <Clock className="w-5 h-5" />}
                           </div>
                           <div>
                              <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">{batch.name}</h3>
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                                 {getStatusText(status, batch)}
                              </p>
                           </div>
                        </div>
                        <div className="flex items-center gap-4">
                           {status === 'ativo' && <Badge className="bg-green-500 text-white border-none font-black text-[9px] uppercase px-3 h-6 animate-pulse">Em Venda</Badge>}
                           {status === 'esgotado' && <Badge variant="destructive" className="font-black text-[9px] uppercase px-3 h-6">Esgotado</Badge>}
                           {status === 'encerrado' && <Badge variant="secondary" className="font-black text-[9px] uppercase px-3 h-6">Encerrado</Badge>}
                           <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180" />
                        </div>
                     </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-8 pb-8 pt-2">
                     <div className="space-y-4">
                        {batch.ticketTypes.map((type: any) => {
                           const breakdown = calculateFinancialBreakdown(type.price, globalFees, promotions, orgSettings)
                           const qty = quantities[type.id] || 0
                           const isFree = type.price <= 0
                           const isLastTickets = type.quantity > 0 && type.quantity <= 10

                           return (
                             <div key={type.id} className={cn(
                               "p-6 rounded-3xl border border-border/60 transition-all flex flex-col md:flex-row items-center justify-between gap-6",
                               qty > 0 ? "bg-secondary/[0.03] border-secondary/30" : "bg-muted/10"
                             )}>
                                <div className="space-y-1.5 text-center md:text-left flex-1">
                                   <div className="flex items-center justify-center md:justify-start gap-3">
                                      <span className="font-black text-base uppercase italic tracking-tight">{type.name}</span>
                                      {type.poolId && <Badge className="h-4 text-[7px] font-black uppercase bg-secondary/10 text-secondary border-none">Pool</Badge>}
                                   </div>
                                   <p className="text-[9px] font-bold text-muted-foreground uppercase">{type.description || "Acesso individual oficial."}</p>
                                   {isLastTickets && canBuy && <p className="text-[8px] font-black text-orange-600 uppercase flex items-center justify-center md:justify-start gap-1"><AlertCircle className="w-3 h-3" /> Apenas {type.quantity} restantes</p>}
                                   {type.requiresProof && (
                                     <div className="flex items-center gap-2 text-orange-700 bg-orange-50 px-2 py-1 rounded-lg w-fit mx-auto md:mx-0">
                                        <ShieldCheck className="w-3 h-3" />
                                        <span className="text-[8px] font-black uppercase">{type.proofDescription || "Necessário Documento"}</span>
                                     </div>
                                   )}
                                </div>
                                <div className="flex items-center gap-6">
                                   <div className="text-right">
                                      <p className="text-2xl font-black text-primary italic tracking-tighter">{isFree ? "GRÁTIS" : formatCurrency(type.price)}</p>
                                      {!isFree && <p className="text-[7px] font-black text-muted-foreground uppercase opacity-40">+ {formatCurrency(breakdown.administrativeFeeAmount)} taxa</p>}
                                   </div>
                                   <div className="flex items-center gap-2 bg-white rounded-xl border p-1 shadow-inner">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleUpdateQty(type.id, qty - 1)} disabled={qty <= 0 || !canBuy}><Minus className="w-3 h-3" /></Button>
                                      <span className="font-black text-sm w-5 text-center">{qty}</span>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleUpdateQty(type.id, qty + 1)} disabled={!canBuy}><Plus className="w-3 h-3" /></Button>
                                   </div>
                                   <Button onClick={() => handleAddToCart(batch, type)} disabled={qty <= 0 || !canBuy} className={cn("h-12 px-6 rounded-xl font-black uppercase italic text-[10px] shadow-lg", qty > 0 ? "bg-secondary text-white" : "bg-muted text-muted-foreground")}>
                                      {event.mapMode !== 'none' ? <><Armchair className="w-4 h-4 mr-2" /> Lugar</> : <><ShoppingCart className="w-4 h-4 mr-2" /> Comprar</>}
                                   </Button>
                                </div>
                             </div>
                           )
                        })}
                     </div>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            )
          })}
        </Accordion>
      ) : (
        <div className="space-y-4">
           {sortedBatches.map(batch => renderSingleTicket(batch))}
        </div>
      )}

      {event.ticketMode !== 'none' && (
        <div className="p-6 bg-secondary/5 rounded-[2.5rem] border border-secondary/10 flex items-start gap-4">
           <ShieldCheck className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
           <div className="space-y-1">
              <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary italic">Compra 100% Segura</h4>
              <p className="text-[10px] text-muted-foreground font-medium uppercase leading-relaxed">
                 Seus ingressos são nominais e protegidos por QR Code dinâmico. O Viby processa pagamentos com criptografia de ponta a ponta via Stripe.
              </p>
           </div>
        </div>
      )}
    </section>
  )
}
