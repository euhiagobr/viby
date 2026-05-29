
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
  AlertCircle
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
  const { addItem } = useCart()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  const pathname = usePathname()

  const [quantities, setQuantities] = React.useState<Record<string, number>>({})

  const activeBatch = React.useMemo(() => {
    if (!event.batches || event.batches.length === 0) return null
    const now = new Date()
    return event.batches.find((b: any) => {
      const start = b.startDate ? new Date(b.startDate) : null
      const end = b.endDate ? new Date(b.endDate) : null
      return (!start || now >= start) && (!end || now <= end)
    }) || event.batches[0]
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

  return (
    <section id="bilheteria" className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
         <h2 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Bilheteria</h2>
         <p className="text-muted-foreground font-medium">Escolha sua categoria e viva a experiência.</p>
      </div>

      {activeBatch ? (
        <div className="space-y-4">
           {activeBatch.ticketTypes.map((type: any) => {
             const breakdown = calculateFinancialBreakdown(type.price, globalFees, promotions, orgSettings)
             const qty = quantities[type.id] || 0
             const isFree = type.price <= 0

             return (
               <Card key={type.id} className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group hover:shadow-md transition-all">
                  <CardContent className="p-8">
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                        <div className="space-y-3 flex-1">
                           <div className="flex items-center gap-3">
                              <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary leading-none">{type.name}</h3>
                              <Badge variant="outline" className="text-[8px] font-black uppercase border-secondary text-secondary">{activeBatch.name}</Badge>
                           </div>
                           
                           <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
                              {type.description || (isFree ? "Acesso gratuito para o evento." : "Ingresso individual oficial.")}
                           </p>

                           {type.requiresProof && (
                             <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-xl border border-orange-100 animate-in slide-in-from-left-2">
                                <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                   <p className="text-[9px] font-black text-orange-800 uppercase">Documento Obrigatório</p>
                                   <p className="text-[10px] text-orange-700 font-medium">{type.proofDescription || "Necessário comprovação no check-in."}</p>
                                </div>
                             </div>
                           )}

                           {activeBatch.endDate && (
                             <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground uppercase">
                                <Clock className="w-3.5 h-3.5" /> 
                                Vendas até {new Date(activeBatch.endDate).toLocaleDateString('pt-BR')} às {new Date(activeBatch.endDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                             </div>
                           )}
                        </div>

                        <div className="flex items-center gap-8">
                           <div className="text-right shrink-0">
                              <p className="text-3xl font-black text-primary">
                                 {isFree ? "GRÁTIS" : formatCurrency(type.price)}
                              </p>
                              {!isFree && (
                                <p className="text-[9px] font-black text-muted-foreground uppercase mt-1">+ {formatCurrency(breakdown.administrativeFeeAmount)} taxa viby</p>
                              )}
                           </div>

                           <div className="flex items-center gap-4 bg-muted/40 p-2 rounded-2xl">
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => handleUpdateQty(type.id, qty - 1)} disabled={qty <= 0}><Minus className="w-4 h-4" /></Button>
                              <span className="font-black text-lg w-6 text-center">{qty}</span>
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => handleUpdateQty(type.id, qty + 1)}><Plus className="w-4 h-4" /></Button>
                           </div>

                           <Button 
                             onClick={() => handleAddToCart(type)}
                             disabled={qty <= 0}
                             className={cn(
                               "h-14 px-8 rounded-2xl font-black uppercase italic shadow-lg transition-all",
                               qty > 0 ? "bg-secondary text-white hover:scale-105" : "bg-muted text-muted-foreground"
                             )}
                           >
                              <ShoppingCart className="w-5 h-5 mr-2" /> {isFree ? "Reservar" : "Comprar"}
                           </Button>
                        </div>
                     </div>
                  </CardContent>
               </Card>
             )
           })}
        </div>
      ) : (
        <Card className="border-none shadow-sm rounded-[3rem] bg-muted/10 border-2 border-dashed border-border/60 p-20 text-center space-y-6">
           <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-10 h-10 text-muted-foreground opacity-30" />
           </div>
           <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Vendas Indisponíveis</h3>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest max-w-xs mx-auto">O lote atual expirou ou as vendas ainda não foram iniciadas.</p>
           </div>
        </Card>
      )}

      {/* Regra de Lotes */}
      {event.ticketMode === 'batches' && event.batches.length > 1 && (
        <div className="p-6 bg-secondary/5 rounded-[2rem] border border-secondary/10 flex items-start gap-4">
           <AlertCircle className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
           <div className="space-y-1">
              <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary">Sistema de Lotes Dinâmicos</h4>
              <p className="text-[10px] text-muted-foreground font-medium uppercase leading-relaxed">
                 O Viby garante o melhor preço disponível. Quando um lote esgota ou atinge o prazo, o próximo assume automaticamente incluindo as sobras do lote anterior.
              </p>
           </div>
        </div>
      )}
    </section>
  )
}
