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
import { cn } from "@/lib/utils"
import { calculateFinancialBreakdown } from "@/lib/financial-utils"
import { useCart, CartItem } from "@/contexts/CartContext"
import { toast } from "@/hooks/use-toast"
import { useAuth, useUser } from "@/firebase"
import { useRouter, usePathname } from "next/navigation"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"

interface BilheteriaPublicProps {
  event: any
  globalFees: any
  promotions: any
  orgSettings: any
}

export function BilheteriaPublic({ event, globalFees, promotions, orgSettings }: BilheteriaPublicProps) {
  const { addMultipleItems } = useCart()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  const pathname = usePathname()
  const { formatPriceWithOriginal, rates } = useCurrency()

  const [quantities, setQuantities] = React.useState<Record<string, number>>({})
  const eventCurrency = (event.currency || 'BRL') as CurrencyCode;

  const handleUpdateQty = (typeId: string, val: number) => {
    setQuantities(prev => ({ ...prev, [typeId]: Math.max(0, val) }))
  }

  const handleAddToCart = (requestedQty: number, ticketTypeName: string) => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`)
      return
    }

    const itemsToAdd: CartItem[] = [];
    let remaining = requestedQty;
    const now = new Date();

    const sortedBatches = [...(event.batches || [])].sort((a, b) => {
      const startA = a.startDate ? new Date(a.startDate).getTime() : 0;
      const startB = b.startDate ? new Date(b.startDate).getTime() : 0;
      return startA - startB;
    });

    for (const batch of sortedBatches) {
      if (remaining <= 0) break;
      const start = batch.startDate ? new Date(batch.startDate) : null;
      const end = batch.endDate ? new Date(batch.endDate) : null;
      if ((start && now < start) || (end && now > end)) continue;

      const type = batch.ticketTypes.find((t: any) => t.name === ticketTypeName);
      if (!type || type.quantity <= 0) continue;

      const amountToTake = Math.min(remaining, type.quantity);
      if (amountToTake > 0) {
        itemsToAdd.push({
          id: `${event.id}_${batch.id}_${type.id}${event.occurrenceId ? `_${event.occurrenceId}` : ''}`,
          eventId: event.id, eventTitle: event.title, eventImage: event.image || '', eventDate: event.date, eventCity: event.city || '',
          organizationId: event.organizationId, organizerId: event.organizerId, organizerUsername: event.organizer?.username || '',
          ticketTypeId: type.id, ticketTypeName: type.name, batchId: batch.id, batchName: batch.name,
          currency: eventCurrency, price: type.price, quantity: amountToTake, requiresProof: type.requiresProof || false,
          occurrenceId: event.occurrenceId || null
        } as any);
        remaining -= amountToTake;
      }
    }

    if (itemsToAdd.length > 0) {
      addMultipleItems(itemsToAdd);
      toast({ title: "Adicionado ao carrinho!" });
      setQuantities(prev => ({ ...prev, [ticketTypeName]: 0 }));
    }
  }

  const ticketTypeGroups = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    event.batches?.forEach((b: any) => b.ticketTypes?.forEach((t: any) => {
      if (!groups[t.name]) groups[t.name] = [];
      groups[t.name].push({ ...t, batch: b });
    }));
    return groups;
  }, [event.batches]);

  return (
    <section id="bilheteria" className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2"><h2 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Bilheteria</h2></div>
      <div className="space-y-6">
         {Object.entries(ticketTypeGroups).map(([typeName, instances]) => {
           const activeInstance = instances.find(inst => {
              const now = new Date();
              const start = inst.batch.startDate ? new Date(inst.batch.startDate) : null;
              const end = inst.batch.endDate ? new Date(inst.batch.endDate) : null;
              return (!start || now >= start) && (!end || now <= end) && inst.quantity > 0;
           });
           const displayInstance = activeInstance || instances[0];
           const status = activeInstance ? 'ativo' : 'esgotado';
           const qty = quantities[typeName] || 0;
           const breakdown = calculateFinancialBreakdown(displayInstance.price, globalFees, promotions, orgSettings, eventCurrency, rates);

           return (
             <Card key={typeName} className={cn("border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden", status === 'esgotado' && "opacity-60 grayscale")}>
                <CardContent className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                   <div className="space-y-1">
                      <h3 className="text-2xl font-black uppercase italic tracking-tighter text-primary">{typeName}</h3>
                      {status === 'ativo' && <Badge className="bg-secondary text-white border-none text-[8px] font-black uppercase">{displayInstance.batch.name}</Badge>}
                   </div>
                   <div className="flex items-center gap-6">
                      <div className="text-right">
                         {formatPriceWithOriginal(displayInstance.price, eventCurrency)}
                         {displayInstance.price > 0 && <p className="text-[8px] font-black text-muted-foreground uppercase opacity-50">+ taxas de serviço</p>}
                      </div>
                      <div className="flex items-center gap-3 bg-muted/40 p-2 rounded-2xl border">
                         <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleUpdateQty(typeName, qty - 1)} disabled={status !== 'ativo'}><Minus className="w-3.5 h-3.5" /></Button>
                         <span className="font-black text-base w-6 text-center">{qty}</span>
                         <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleUpdateQty(typeName, qty + 1)} disabled={status !== 'ativo'}><Plus className="w-3.5 h-3.5" /></Button>
                      </div>
                      <Button onClick={() => handleAddToCart(qty, typeName)} disabled={qty <= 0 || status !== 'ativo'} className="h-14 px-8 rounded-2xl font-black uppercase italic shadow-lg">
                         <ShoppingCart className="w-5 h-5 mr-2" /> Garantir
                      </Button>
                   </div>
                </CardContent>
             </Card>
           );
         })}
      </div>
    </section>
  )
}