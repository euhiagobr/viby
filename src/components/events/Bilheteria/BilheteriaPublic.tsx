"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ShoppingCart, 
  Clock, 
  Plus, 
  Minus, 
  Zap, 
  ExternalLink, 
  Coins, 
  Heart, 
  Info,
  CheckCircle2,
  Tag,
  Loader2,
  Users
} from "lucide-react"
import { cn } from "@/lib/utils"
import { calculateVibyOfficialSplit, calculateFinancialBreakdown } from "@/lib/financial-utils"
import { useCart, CartItem } from "@/contexts/CartContext"
import { toast } from "@/hooks/use-toast"
import { useAuth, useUser, useFirestore } from "@/firebase"
import { useRouter, usePathname } from "next/navigation"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"
import { generateFreeTickets } from "@/app/actions/tickets"

const VIBY_OFFICIAL_UID = "dd9665af-ad6d-405c-a51d-08220fecf96f";

interface BilheteriaPublicProps {
  event: any
  occurrence?: any
  occurrenceLoading?: boolean
  globalFees: any
  promotions: any
  orgSettings: any
}

export function BilheteriaPublic({ event, occurrence, occurrenceLoading, globalFees, promotions, orgSettings }: BilheteriaPublicProps) {
  const { addMultipleItems } = useCart()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  const pathname = usePathname()
  const { formatPriceWithOriginal, rates } = useCurrency()

  const [quantities, setQuantities] = React.useState<Record<string, number>>({})
  const [isRegisteringInterest, setIsRegisteringInterest] = React.useState(false)
  const [bottomHasRegistered, setHasRegistered] = React.useState(false)

  const eventCurrency = (event.currency || 'BRL') as CurrencyCode;
  const isDivulgacao = event.type === 'divulgacao';
  const isExterno = event.type === 'externo';
  const isCuradoria = event.curationType === 'curadoria' || 
                      event.curatorProfile === 'viby' || 
                      (event.organizationId === VIBY_OFFICIAL_UID && (event.type === 'divulgacao' || event.type === 'externo'));

  const activeBatches = occurrence?.batches && occurrence.batches.length > 0 ? occurrence.batches : (event.batches || []);
  const activeOccurrenceId = occurrence?.id || null;

  const soldCount = occurrence ? (occurrence.ingressosVendidos || 0) : (event.ingressosVendidos || 0);
  const capacityTotal = occurrence ? (occurrence.capacidadeMaxima || 0) : (event.capacidadeTotal || 0);
  const isSoldOut = !isCuradoria && capacityTotal > 0 && soldCount >= capacityTotal;

  React.useEffect(() => {
    setQuantities({});
    setHasRegistered(false);
  }, [activeOccurrenceId]);

  const ticketTypeGroups = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    activeBatches.forEach((b: any) => b.ticketTypes?.forEach((t: any) => {
      if (!groups[t.name]) groups[t.name] = [];
      groups[t.name].push({ ...t, batch: b });
    }));
    return groups;
  }, [activeBatches]);

  const handleUpdateQty = (typeName: string, val: number, isFree: boolean) => {
    if (isFree && val > 1) {
      toast({ title: "Limite atingido", description: "Máximo de 1 unidade para ingressos gratuitos." });
      return;
    }
    setQuantities(prev => ({ ...prev, [typeName]: Math.max(0, val) }))
  }

  const handleRegisterInterest = async () => {
    if (isCuradoria) return;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`)
      return
    }
    if (!db || !event || isRegisteringInterest) return
    setIsRegisteringInterest(true)
    try {
      const result = await generateFreeTickets({
        userId: user.uid,
        userName: user.displayName || "Membro Viby",
        userEmail: user.email!,
        items: [{
          eventId: event.id,
          eventTitle: event.title,
          eventImage: event.image || "",
          eventDate: occurrence?.start_date || event.date,
          eventCity: event.city || "",
          organizationId: event.organizationId,
          organizerId: event.organizerId || event.userId || event.organizationId,
          ticketTypeId: "interest",
          ticketTypeName: "Interesse Confirmado",
          batchId: "disclosure",
          batchName: "Sessão",
          quantity: 1,
          occurrenceId: activeOccurrenceId
        }]
      });
      if (result.success) {
        setHasRegistered(true)
        toast({ title: "Presença confirmada!", description: "Sua intenção de ir nesta data foi registrada." })
      } else throw new Error(result.error)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na confirmação", description: e.message })
    } finally {
      setIsRegisteringInterest(false)
    }
  }

  const handleAddToCart = (requestedQty: number, ticketTypeName: string) => {
    if (isCuradoria) return;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`)
      return
    }
    if (event.isRecurring && !activeOccurrenceId) {
      toast({ variant: "destructive", title: "Selecione uma sessão", description: "Por favor, escolha uma data e horário antes de comprar." });
      return;
    }

    const itemsToAdd: CartItem[] = [];
    let remaining = requestedQty;
    const now = new Date();
    const sortedBatches = [...activeBatches].sort((a, b) => {
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
          id: `${event.id}_${batch.id}_${type.id}${activeOccurrenceId ? `_${activeOccurrenceId}` : ''}`,
          eventId: event.id, 
          eventTitle: event.title, 
          eventImage: event.image || '', 
          eventDate: occurrence?.start_date || event.date, 
          eventCity: event.city || '',
          organizationId: event.organizationId, 
          organizerId: event.organizerId || event.userId || event.organizationId, 
          organizerUsername: event.organizer?.username || '',
          ticketTypeId: type.id, 
          ticketTypeName: type.name, 
          batchId: batch.id, 
          batchName: batch.name,
          currency: eventCurrency, 
          price: type.price, 
          quantity: amountToTake, 
          requiresProof: type.requiresProof || false,
          occurrenceId: activeOccurrenceId,
          allowCoupon: type.allowCoupon !== false
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

  if (occurrenceLoading) {
    return (
      <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-12 text-center flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Sincronizando Bilheteria...</p>
      </Card>
    );
  }

  if (isSoldOut) {
    return (
      <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-12 text-center space-y-6">
        <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto">
          <Users className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Esgotado</h2>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">A lotação máxima para esta sessão foi atingida.</p>
        </div>
      </Card>
    );
  }

  if (event.isRecurring && !activeOccurrenceId) {
     return (
       <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-12 text-center space-y-4">
          <Clock className="w-12 h-12 text-secondary/30 mx-auto" />
          <div className="space-y-1">
             <p className="text-sm font-black uppercase italic text-primary">Selecione uma sessão</p>
             <p className="text-[10px] font-bold text-muted-foreground uppercase">Escolha o dia e horário acima para ver a disponibilidade de ingressos.</p>
          </div>
       </Card>
     )
  }

  if (isDivulgacao || isExterno) {
    return (
      <section id="bilheteria" className="space-y-6 animate-in fade-in duration-500">
         <div className="flex flex-col gap-1 px-1">
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-primary">Acesso</h2>
            <p className="text-muted-foreground font-medium uppercase text-[9px] tracking-widest">
              {isExterno ? "Venda em site parceiro." : "Cobrança no local ou free."}
            </p>
         </div>

         <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
            <CardContent className="p-6 space-y-8">
               {event.startingPrice !== undefined || event.disclosurePrices?.length > 0 ? (
                 <div className="space-y-8">
                    {event.startingPrice !== undefined && (
                       <div className="space-y-3">
                          <div className="p-5 bg-muted/20 rounded-3xl border-2 border-dashed border-border flex items-center justify-between">
                             <div>
                                <p className="text-[8px] font-black uppercase text-muted-foreground opacity-50">A partir de</p>
                                <p className="text-xl font-black text-primary italic tracking-tighter">
                                   {event.startingPrice === 0 ? "Evento gratuito" : formatPriceWithOriginal(event.startingPrice, eventCurrency)}
                                </p>
                             </div>
                             <Coins className="w-6 h-6 text-secondary opacity-20" />
                          </div>
                       </div>
                    )}

                    {event.disclosurePrices?.length > 0 && (
                      <div className="space-y-4">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cronograma</p>
                        <div className="grid grid-cols-1 gap-2">
                           {event.disclosurePrices.map((p: any, i: number) => (
                             <div key={i} className="p-4 bg-muted/10 rounded-2xl border border-dashed flex justify-between items-center">
                                <span className="text-[9px] font-black uppercase text-muted-foreground opacity-50">Até {p.untilTime}h</span>
                                <span className="text-sm font-black text-primary">{formatPriceWithOriginal(p.price, eventCurrency)}</span>
                             </div>
                           ))}
                        </div>
                      </div>
                    )}
                 </div>
               ) : (
                 <div className="p-6 bg-green-50 rounded-2xl border border-green-100 flex flex-col items-center text-center gap-2">
                    <Zap className="w-8 h-8 text-green-500" />
                    <p className="text-sm font-black uppercase italic text-green-700">Entrada Gratuita</p>
                 </div>
               )}

               <div className="flex flex-col gap-3">
                  {isExterno && event.externalUrl && (
                    <Button asChild className="h-12 bg-primary text-white font-black rounded-xl uppercase italic text-[11px] shadow-lg">
                       <a href={event.externalUrl} target="_blank" rel="noopener noreferrer">
                          Site de Vendas <ExternalLink className="ml-2 w-3.5 h-3.5" />
                       </a>
                    </Button>
                  )}
                  
                  <Button 
                    onClick={handleRegisterInterest}
                    disabled={bottomHasRegistered || isRegisteringInterest}
                    className={cn(
                      "h-12 font-black rounded-xl uppercase italic text-[11px] transition-all",
                      bottomHasRegistered ? "bg-green-600 text-white" : "bg-secondary text-white shadow-lg shadow-secondary/10"
                    )}
                  >
                     {isRegisteringInterest ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : bottomHasRegistered ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Heart className="w-4 h-4 mr-2" />}
                     {bottomHasRegistered ? "Inscrito!" : "Garantir Vaga"}
                  </Button>
               </div>
            </CardContent>
         </Card>
      </section>
    );
  }

  return (
    <section id="bilheteria" className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-2xl font-black italic uppercase tracking-tighter text-primary px-1">Bilheteria</h2>
      <div className="space-y-4">
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
           const isFree = displayInstance.price === 0;

           return (
             <Card key={typeName} className={cn("border-none shadow-sm rounded-3xl bg-white overflow-hidden", status === 'esgotado' && "opacity-50 grayscale")}>
                <CardContent className="p-5 flex flex-col gap-5">
                   <div className="space-y-1">
                      <h3 className="text-lg font-black uppercase italic tracking-tighter text-primary truncate leading-none">{typeName}</h3>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {status === 'ativo' && <Badge className="bg-secondary text-white border-none text-[7px] font-black uppercase h-4 px-1.5">{displayInstance.batch.name}</Badge>}
                        {isFree && <Badge variant="outline" className="text-[7px] font-black uppercase border-secondary text-secondary h-4 px-1.5">Limite: 1</Badge>}
                      </div>
                   </div>
                   
                   <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2 bg-muted/40 p-1.5 rounded-xl border shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUpdateQty(typeName, qty - 1, isFree)} disabled={status !== 'ativo'}><Minus className="w-3 h-3" /></Button>
                            <span className="font-black text-sm w-4 text-center">{qty}</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUpdateQty(typeName, qty + 1, isFree)} disabled={status !== 'ativo' || (isFree && qty >= 1)}><Plus className="w-3 h-3" /></Button>
                         </div>
                         <div className="text-right">
                            {formatPriceWithOriginal(displayInstance.price, eventCurrency)}
                            {displayInstance.price > 0 && <p className="text-[7px] font-black text-muted-foreground uppercase opacity-40">+ taxas</p>}
                         </div>
                      </div>
                      
                      <Button 
                        onClick={() => handleAddToCart(qty, typeName)} 
                        disabled={qty <= 0 || status !== 'ativo'} 
                        className="w-full h-11 bg-primary text-white font-black rounded-xl uppercase italic text-[10px] shadow-lg"
                      >
                         <ShoppingCart className="w-3.5 h-3.5 mr-2" /> {isFree ? "Resgatar" : "Comprar"}
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
