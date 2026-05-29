
"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Ticket, 
  ShoppingCart, 
  Clock, 
  Info, 
  CheckCircle2, 
  Plus, 
  Minus, 
  Lock,
  ArrowRight,
  ShieldCheck,
  Layers,
  Armchair,
  XCircle
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
  onSelectSector?: (s: any) => void
}

export function BilheteriaPublic({ event, globalFees, promotions, orgSettings, onSelectSector }: BilheteriaPublicProps) {
  const { addItem, totalCount } = useCart()
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
      toast({ title: "Ação necessária", description: "Faça login para adicionar ao carrinho." })
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
      price: type.price,
      quantity: qty,
      requiresProof: type.requiresProof || false,
      ageRating: event.ageRating?.code
    })

    toast({ title: "Adicionado ao carrinho!" })
    setQuantities(prev => ({ ...prev, [type.id]: 0 }))
  }

  if (event.ticketMode === 'none') return null

  return (
    <section id="bilheteria" className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
         <h2 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Ingressos</h2>
         <p className="text-muted-foreground font-medium">Garanta sua presença com segurança oficial Viby.</p>
      </div>

      {activeBatch ? (
        <div className="grid grid-cols-1 gap-4">
           {activeBatch.ticketTypes.map((type: any) => {
             const breakdown = calculateFinancialBreakdown(type.price, globalFees, promotions, orgSettings)
             const qty = quantities[type.id] || 0
             
             return (
               <Card key={type.id} className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group hover:shadow-md transition-all">
                  <CardContent className="p-8">
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2 flex-1">
                           <div className="flex items-center gap-3">
                              <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary leading-none">{type.name}</h3>
                              <Badge variant="outline" className="text-[8px] font-black uppercase border-secondary text-secondary">{activeBatch.name}</Badge>
                           </div>
                           <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{type.description || "Acesso individual para o evento."}</p>
                           {type.requiresProof && (
                             <div className="flex items-center gap-2 text-[9px] font-black text-orange-600 uppercase">
                                <ShieldCheck className="w-3 h-3" /> Documento Obrigatório
                             </div>
                           )}
                        </div>

                        <div className="flex items-center gap-8">
                           <div className="text-right shrink-0">
                              <p className="text-3xl font-black text-primary">{formatCurrency(type.price)}</p>
                              {type.price > 0 && (
                                <p className="text-[9px] font-black text-muted-foreground uppercase mt-1">+ {formatCurrency(breakdown.administrativeFeeAmount)} taxa viby</p>
                              )}
                           </div>

                           <div className="flex items-center gap-4 bg-muted/40 p-2 rounded-2xl">
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => handleUpdateQty(type.id, qty - 1)}><Minus className="w-4 h-4" /></Button>
                              <span className="font-black text-lg w-6 text-center">{qty || 0}</span>
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
                              <ShoppingCart className="w-5 h-5 mr-2" /> Comprar
                           </Button>
                        </div>
                     </div>
                  </CardContent>
               </Card>
             )
           })}
        </div>
      ) : (
        <div className="p-12 text-center bg-muted/30 rounded-[3rem] border-2 border-dashed flex flex-col items-center gap-4">
           <Clock className="w-12 h-12 text-muted-foreground opacity-30" />
           <p className="text-sm font-bold text-muted-foreground uppercase">Vendas não iniciadas ou encerradas.</p>
        </div>
      )}
    </section>
  )
}
