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
  ArrowRight
} from "lucide-react"
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

  // Lógica de Lote Ativo com ordenação e detecção de status
  const activeBatch = React.useMemo(() => {
    if (!event.batches || event.batches.length === 0) return null
    const now = new Date()
    
    // Ordenar lotes por data de início
    const sortedBatches = [...event.batches].sort((a, b) => {
      const dateA = a.startDate ? new Date(a.startDate).getTime() : 0
      const dateB = b.startDate ? new Date(b.startDate).getTime() : 0
      return dateA - dateB
    })
    
    // 1. Tenta encontrar o lote que está ocorrendo agora
    const current = sortedBatches.find((b: any) => {
      const start = b.startDate ? new Date(b.startDate) : null
      const end = b.endDate ? new Date(b.endDate) : null
      return (!start || now >= start) && (!end || now <= end)
    })

    if (current) return current

    // 2. Se nenhum está ocorrendo, procura o PRÓXIMO a iniciar
    const upcoming = sortedBatches.find((b: any) => {
       const start = b.startDate ? new Date(b.startDate) : null
       return start && now < start
    })

    if (upcoming) return upcoming

    // 3. Fallback para o último se todos já passaram ou primeiro se não houver datas
    return sortedBatches[sortedBatches.length - 1]
  }, [event.batches])

  const handleUpdateQty = (typeId: string, val: number) => {
    setQuantities(prev => ({ ...prev, [typeId]: Math.max(0, val) }))
  }

  const handleAddToCart = (type: any) => {
    if (!user) {
      toast({ title: "Ação necessária", description: "Faça login para garantir seu ingresso." })
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`)
      return
    }

    const qty = quantities[type.id] || 1
    if (qty <= 0) return

    addItem({
      id: `${event.id}_${activeBatch.id}_${type.id}`,
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
      batchId: activeBatch.id,
      batchName: activeBatch.name,
      poolId: type.poolId || null,
      poolName: type.poolName || null,
      price: type.price,
      quantity: qty,
      requiresProof: type.requiresProof || false,
      ageRating: event.ageRating?.code
    })

    toast({ title: "Adicionado ao carrinho!" })
    setQuantities(prev => ({ ...prev, [type.id]: 0 }))
  }

  if (event.ticketMode === 'none' || !event.ticketMode) return null

  const now = new Date()
  const startDate = activeBatch?.startDate ? new Date(activeBatch.startDate) : null
  const endDate = activeBatch?.endDate ? new Date(activeBatch.endDate) : null
  
  const isStarted = !startDate || now >= startDate
  const isFinished = endDate && now > endDate
  const isWaiting = startDate && now < startDate

  return (
    <section id="bilheteria" className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
         <h2 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Bilheteria</h2>
         <p className="text-muted-foreground font-medium">Escolha sua categoria e viva a experiência.</p>
      </div>

      {activeBatch ? (
        <div className="space-y-6">
           <div className={cn(
             "flex items-center justify-between px-4 py-3 rounded-2xl border transition-all",
             isWaiting ? "bg-orange-50 border-orange-100" : "bg-secondary/5 border-secondary/10"
           )}>
              <div className="flex items-center gap-3">
                 <div className={cn(
                   "p-2 rounded-lg",
                   isWaiting ? "bg-orange-100 text-orange-600" : "bg-secondary/10 text-secondary"
                 )}>
                    {isWaiting ? <Clock className="w-4 h-4" /> : <Zap className="w-4 h-4 fill-current" />}
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                      {isWaiting ? "Vendas em Breve" : `Vendas Abertas: ${activeBatch.name}`}
                    </span>
                    {isWaiting && startDate && (
                       <span className="text-[9px] font-bold text-orange-700 uppercase">
                          Inicia em {startDate.toLocaleDateString('pt-BR')} às {startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                       </span>
                    )}
                 </div>
              </div>
              
              {isWaiting ? (
                <Badge variant="outline" className="text-[8px] font-black uppercase border-orange-200 text-orange-600 bg-white">Aguarde</Badge>
              ) : isFinished ? (
                <Badge variant="outline" className="text-[8px] font-black uppercase border-red-200 text-red-600 bg-red-50">Lote Encerrado</Badge>
              ) : (
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                   <span className="text-[9px] font-black uppercase text-green-600">Disponível</span>
                </div>
              )}
           </div>

           <div className="space-y-4">
              {activeBatch.ticketTypes.map((type: any) => {
                const breakdown = calculateFinancialBreakdown(type.price, globalFees, promotions, orgSettings)
                const qty = quantities[type.id] || 0
                const isFree = type.price <= 0
                const canBuy = isStarted && !isFinished

                return (
                  <Card key={type.id} className={cn(
                    "border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group transition-all",
                    qty > 0 ? "ring-2 ring-secondary shadow-xl -translate-y-1" : "hover:shadow-md",
                    isWaiting && "opacity-80 grayscale-[0.5]"
                  )}>
                    <CardContent className="p-8">
                       <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                          <div className="space-y-3 flex-1">
                             <div className="flex items-center gap-3">
                                <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary leading-none">{type.name}</h3>
                                {type.poolId && <Badge variant="outline" className="text-[7px] font-black uppercase border-secondary/20 text-secondary bg-secondary/5">Estoque Compartilhado</Badge>}
                             </div>
                             
                             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
                                {type.description || (isFree ? "Acesso gratuito para o evento." : "Ingresso individual oficial.")}
                             </p>

                             {type.requiresProof && (
                               <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-xl border border-orange-100 w-fit">
                                  <ShieldCheck className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                                  <div className="space-y-0.5">
                                     <p className="text-[8px] font-black text-orange-800 uppercase">Atenção</p>
                                     <p className="text-[9px] text-orange-700 font-bold uppercase leading-tight">{type.proofDescription || "Necessário comprovação no check-in."}</p>
                                  </div>
                               </div>
                             )}

                             {isWaiting && startDate && (
                               <div className="flex items-center gap-2 text-[9px] font-bold text-orange-600 uppercase">
                                  <Clock className="w-3.5 h-3.5" /> 
                                  Disponível em breve
                               </div>
                             )}
                          </div>

                          <div className="flex items-center gap-6">
                             <div className="text-right shrink-0">
                                <p className="text-3xl font-black text-primary italic tracking-tighter leading-none">
                                   {isFree ? "GRÁTIS" : formatCurrency(type.price)}
                                </p>
                                {!isFree && (
                                  <p className="text-[8px] font-black text-muted-foreground uppercase mt-2 opacity-50">+ {formatCurrency(breakdown.administrativeFeeAmount)} taxa viby</p>
                                )}
                             </div>

                             <div className="flex items-center gap-3 bg-muted/40 p-2 rounded-2xl border">
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white" onClick={() => handleUpdateQty(type.id, qty - 1)} disabled={qty <= 0 || !canBuy}><Minus className="w-3.5 h-3.5" /></Button>
                                <span className="font-black text-base w-6 text-center">{qty}</span>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white" onClick={() => handleUpdateQty(type.id, qty + 1)} disabled={!canBuy}><Plus className="w-3.5 h-3.5" /></Button>
                             </div>

                             <Button 
                               onClick={() => handleAddToCart(type)}
                               disabled={qty <= 0 || !canBuy}
                               className={cn(
                                 "h-14 px-8 rounded-2xl font-black uppercase italic shadow-lg transition-all",
                                 qty > 0 ? "bg-secondary text-white hover:scale-105 active:scale-95" : "bg-muted text-muted-foreground"
                               )}
                             >
                                <ShoppingCart className="w-5 h-5 mr-2" /> {isWaiting ? "Em Breve" : (isFree ? "Reservar" : "Garantir")}
                             </Button>
                          </div>
                       </div>
                    </CardContent>
                  </Card>
                )
              })}
           </div>
        </div>
      ) : (
        <Card className="border-none shadow-sm rounded-[3rem] bg-muted/10 border-2 border-dashed border-border/60 p-20 text-center space-y-6">
           <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-10 h-10 text-muted-foreground opacity-30" />
           </div>
           <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Vendas Indisponíveis</h3>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest max-w-xs mx-auto">Os ingressos para este evento ainda não estão liberados ou o período de vendas foi encerrado.</p>
           </div>
        </Card>
      )}

      {/* Informativo de Lotes */}
      {event.ticketMode === 'batches' && event.batches.length > 1 && (
        <div className="p-6 bg-secondary/5 rounded-[2.5rem] border border-secondary/10 flex items-start gap-4">
           <AlertCircle className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
           <div className="space-y-1">
              <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary">Sistema de Lotes Dinâmicos</h4>
              <p className="text-[10px] text-muted-foreground font-medium uppercase leading-relaxed">
                 O Viby garante o melhor preço disponível. Quando um lote esgota ou atinge o prazo, o próximo assume automaticamente incluindo as sobras do lote anterior para maximizar a ocupação do evento.
              </p>
           </div>
        </div>
      )}
    </section>
  )
}
