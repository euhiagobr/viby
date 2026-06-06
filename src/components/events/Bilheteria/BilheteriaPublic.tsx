
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
  Users,
  Layers
} from "lucide-react"
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { calculateFinancialBreakdown } from "@/lib/financial-utils"
import { useCart, CartItem } from "@/contexts/CartContext"
import { toast } from "@/hooks/use-toast"
import { useAuth, useUser } from "@/firebase"
import { useRouter, usePathname } from "next/navigation"
import { useCurrency } from "@/contexts/CurrencyContext"

interface BilheteriaPublicProps {
  event: any
  globalFees: any
  promotions: any
  orgSettings: any
}

export function BilheteriaPublic({ event, globalFees, promotions, orgSettings }: BilheteriaPublicProps) {
  const { addMultipleItems, items } = useCart()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  const pathname = usePathname()
  const { formatPrice } = useCurrency()

  const [quantities, setQuantities] = React.useState<Record<string, number>>({})

  const handleUpdateQty = (typeId: string, val: number) => {
    setQuantities(prev => ({ ...prev, [typeId]: Math.max(0, val) }))
  }

  // Lógica de Distribuição entre Lotes
  const handleAddToCart = (requestedQty: number, ticketTypeName: string) => {
    if (!user) {
      toast({ title: "Ação necessária", description: "Faça login para garantir seu ingresso." })
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`)
      return
    }

    if (event.isRecurring && event.isSoldOut) {
      toast({ variant: "destructive", title: "Data Lotada", description: "Infelizmente não há mais vagas para esta data." });
      return;
    }

    const sortedBatches = [...(event.batches || [])].sort((a, b) => {
      const startA = a.startDate ? new Date(a.startDate).getTime() : 0;
      const startB = b.startDate ? new Date(b.startDate).getTime() : 0;
      return startA - startB;
    });

    let remainingToDistribute = requestedQty;
    const itemsToAdd: CartItem[] = [];
    const now = new Date();

    for (const batch of sortedBatches) {
      if (remainingToDistribute <= 0) break;

      // Valida validade do lote
      const start = batch.startDate ? new Date(batch.startDate) : null;
      const end = batch.endDate ? new Date(batch.endDate) : null;
      const isFuture = start && now < start;
      const isPast = end && now > end;
      if (isFuture || isPast) continue;

      const type = batch.ticketTypes.find((t: any) => t.name === ticketTypeName);
      if (!type || type.quantity <= 0) continue;

      const availableInBatch = type.quantity;
      const amountToTake = Math.min(remainingToDistribute, availableInBatch);

      if (amountToTake > 0) {
        itemsToAdd.push({
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
          occurrenceId: event.occurrenceId || null,
          price: type.price,
          quantity: amountToTake,
          requiresProof: type.requiresProof || false,
          ageRating: event.ageRating?.code
        });

        remainingToDistribute -= amountToTake;
      }
    }

    if (itemsToAdd.length > 0) {
      addMultipleItems(itemsToAdd);
      if (remainingToDistribute > 0) {
        toast({ 
          title: "Adicionado parcialmente", 
          description: `Adicionamos ${requestedQty - remainingToDistribute} ingressos. Os outros ${remainingToDistribute} não estão disponíveis no momento.` 
        });
      } else {
        toast({ title: "Adicionado ao carrinho!" });
      }
      setQuantities(prev => ({ ...prev, [ticketTypeName]: 0 }));
    } else {
      toast({ variant: "destructive", title: "Indisponível", description: "Não há ingressos disponíveis para os lotes atuais." });
    }
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

  const getScarcityLabel = (qty: number) => {
    if (qty <= 0) return "Lote esgotado";
    if (qty === 1) return "Último ingresso disponível neste lote";
    if (qty <= 3) return `Últimos ${qty} ingressos deste lote`;
    if (qty <= 5) return `Últimos ${qty} ingressos deste lote`;
    if (qty <= 10) return `Últimos ${qty} ingressos deste lote`;
    return null;
  }

  // Agrupamos tipos de ingressos entre lotes para exibição unificada (Fluxo de Lotes)
  const ticketTypeGroups = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    event.batches?.forEach((b: any) => {
      b.ticketTypes?.forEach((t: any) => {
        if (!groups[t.name]) groups[t.name] = [];
        groups[t.name].push({ ...t, batch: b });
      });
    });
    return groups;
  }, [event.batches]);

  if (event.ticketMode === 'none' || !event.ticketMode) return null;

  return (
    <section id="bilheteria" className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
         <h2 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Bilheteria</h2>
         <p className="text-muted-foreground font-medium">Os lotes mudam automaticamente conforme a disponibilidade.</p>
      </div>

      {event.isSoldOut && (
         <div className="p-6 bg-red-50 rounded-[2.5rem] border-2 border-dashed border-red-200 flex items-center justify-center gap-4 animate-in zoom-in-95">
            <Users className="w-8 h-8 text-red-600 animate-bounce" />
            <p className="text-sm font-black uppercase italic text-red-800 tracking-tight">Capacidade Máxima atingida!</p>
         </div>
      )}

      <div className="space-y-6">
         {Object.entries(ticketTypeGroups).map(([typeName, instances]) => {
           // Encontra a instância ativa para exibição de preço e status
           const activeInstance = instances.find(inst => getBatchStatus(inst.batch) === 'ativo');
           const nextInstance = instances.find(inst => getBatchStatus(inst.batch) === 'futuro');
           const displayInstance = activeInstance || nextInstance || instances[instances.length - 1];
           
           const status = activeInstance ? 'ativo' : (nextInstance ? 'futuro' : 'esgotado');
           const qty = quantities[typeName] || 0;
           const breakdown = calculateFinancialBreakdown(displayInstance.price, globalFees, promotions, orgSettings);
           
           const scarcityLabel = activeInstance ? getScarcityLabel(activeInstance.quantity) : null;

           return (
             <Card key={typeName} className={cn(
               "border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden transition-all",
               qty > 0 && "ring-2 ring-secondary shadow-xl",
               status === 'esgotado' && "opacity-60 grayscale-[0.5]"
             )}>
                <CardContent className="p-8">
                   <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                      <div className="space-y-3 flex-1">
                         <div className="flex items-center gap-3">
                            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-primary">{typeName}</h3>
                            {status === 'ativo' && (
                              <Badge className="bg-secondary text-white border-none text-[8px] font-black uppercase h-5">
                                {displayInstance.batch.name}
                              </Badge>
                            )}
                         </div>
                         
                         {scarcityLabel && (
                            <p className="text-[10px] font-black text-orange-600 uppercase flex items-center gap-1.5 animate-pulse">
                               <AlertCircle className="w-3.5 h-3.5" /> {scarcityLabel}
                            </p>
                         )}

                         {status === 'futuro' && (
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                               Vendas iniciam em breve
                            </p>
                         )}

                         {displayInstance.requiresProof && (
                           <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-xl border border-orange-100 w-fit">
                              <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
                              <p className="text-[9px] text-orange-700 font-bold uppercase">{displayInstance.proofDescription || "Documento obrigatório."}</p>
                           </div>
                         )}
                      </div>

                      <div className="flex items-center gap-6">
                         <div className="text-right">
                            <p className="text-3xl font-black text-primary italic tracking-tighter">
                               {displayInstance.price <= 0 ? "GRÁTIS" : formatPrice(displayInstance.price)}
                            </p>
                            {displayInstance.price > 0 && <p className="text-[8px] font-black text-muted-foreground uppercase opacity-50">+ {formatPrice(breakdown.administrativeFeeAmount)} taxa</p>}
                         </div>
                         <div className="flex items-center gap-3 bg-muted/40 p-2 rounded-2xl border">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white" onClick={() => handleUpdateQty(typeName, qty - 1)} disabled={qty <= 0 || status !== 'ativo'}><Minus className="w-3.5 h-3.5" /></Button>
                            <span className="font-black text-base w-6 text-center">{qty}</span>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white" onClick={() => handleUpdateQty(typeName, qty + 1)} disabled={status !== 'ativo'}><Plus className="w-3.5 h-3.5" /></Button>
                         </div>
                         <Button 
                           onClick={() => handleAddToCart(qty, typeName)} 
                           disabled={qty <= 0 || status !== 'ativo'} 
                           className={cn("h-14 px-8 rounded-2xl font-black uppercase italic shadow-lg transition-all", qty > 0 ? "bg-secondary text-white scale-105" : "bg-muted text-muted-foreground")}
                         >
                            <ShoppingCart className="w-5 h-5 mr-2" /> {status === 'futuro' ? "Em Breve" : "Garantir"}
                         </Button>
                      </div>
                   </div>
                </CardContent>
             </Card>
           );
         })}
      </div>

      <div className="p-6 bg-secondary/5 rounded-[2.5rem] border border-secondary/10 flex items-start gap-4">
         <ShieldCheck className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
         <div className="space-y-1">
            <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary italic">Sistema de Lotes Inteligente</h4>
            <p className="text-[10px] text-muted-foreground font-medium uppercase leading-relaxed">
               Seu pedido será distribuído automaticamente entre os lotes disponíveis caso a quantidade solicitada ultrapasse o saldo do lote atual. A disponibilidade final é confirmada apenas no checkout.
            </p>
         </div>
      </div>
    </section>
  )
}
