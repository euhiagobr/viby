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
  Globe,
  Instagram,
  Phone,
  Mail
} from "lucide-react"
import { cn } from "@/lib/utils"
import { calculateVibyOfficialSplit } from "@/lib/financial-utils"
import { useCart, CartItem } from "@/contexts/CartContext"
import { toast } from "@/hooks/use-toast"
import { useAuth, useUser, useFirestore } from "@/firebase"
import { useRouter, usePathname } from "next/navigation"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"
import { doc, updateDoc, increment, serverTimestamp, setDoc } from "firebase/firestore"
import { generateFreeTickets } from "@/app/actions/tickets"

interface BilheteriaPublicProps {
  event: any
  globalFees: any
  promotions: any
  orgSettings: any
}

export function BilheteriaPublic({ event, globalFees, promotions, orgSettings }: BilheteriaPublicProps) {
  const { addMultipleItems } = useCart()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  const pathname = usePathname()
  const { formatPriceWithOriginal, rates } = useCurrency()

  const [quantities, setQuantities] = React.useState<Record<string, number>>({})
  const [isRegisteringInterest, setIsRegisteringInterest] = React.useState(false)
  const [hasRegistered, setHasRegistered] = React.useState(false)

  const eventCurrency = (event.currency || 'BRL') as CurrencyCode;
  const isDivulgacao = event.type === 'divulgacao';
  const isExterno = event.type === 'externo';
  const isCuradoria = event.curationType === 'curadoria';

  const handleUpdateQty = (typeId: string, val: number) => {
    setQuantities(prev => ({ ...prev, [typeId]: Math.max(0, val) }))
  }

  const handleRegisterInterest = async () => {
    if (isCuradoria) return; // Curadoria não registra interesse como 'presença'

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
          eventDate: event.date,
          eventCity: event.city || "",
          organizationId: event.organizationId,
          organizerId: event.organizerId,
          ticketTypeId: "interest",
          ticketTypeName: "Interesse Confirmado",
          batchId: "disclosure",
          batchName: "Sessão",
          quantity: 1,
          occurrenceId: event.occurrenceId || null
        }]
      });

      if (result.success) {
        setHasRegistered(true)
        toast({ title: "Presença confirmada!", description: "Sua intenção de ir nesta data foi registrada." })
      } else {
        throw new Error(result.error)
      }
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

  // FLOW: Curadoria Viby (Exclusivamente Informativo)
  if (isCuradoria) {
    return (
      <section id="bilheteria" className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Informações do Evento</h2>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">
            {isExterno ? "Links oficiais e canais externos." : "Conteúdo curado pela plataforma."}
          </p>
        </div>

        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
          <CardContent className="p-10 space-y-10">
            {event.disclosurePrices?.length > 0 ? (
              <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Coins className="w-4 h-4 text-secondary" /> Valores Informativos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {event.disclosurePrices.map((p: any, i: number) => (
                    <div key={i} className="p-5 bg-muted/20 rounded-2xl border border-dashed flex justify-between items-center">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-muted-foreground opacity-50">Até {p.untilTime}</p>
                        <p className="text-lg font-black text-primary">{formatPriceWithOriginal(p.price, eventCurrency)}</p>
                      </div>
                      <Clock className="w-5 h-5 text-secondary opacity-20" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 bg-muted/20 rounded-3xl border-2 border-dashed border-border/50 flex flex-col items-center text-center gap-2">
                <Zap className="w-8 h-8 text-secondary opacity-40" />
                <p className="text-xl font-black uppercase italic text-primary">Evento gratuito</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              {isExterno && event.externalUrl && (
                <Button asChild className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-base hover:scale-102 transition-transform">
                  <a href={event.externalUrl} target="_blank" rel="noopener noreferrer">
                    Acessar Ingressos Oficiais <ExternalLink className="ml-2 w-5 h-5" />
                  </a>
                </Button>
              )}
            </div>

            {/* Links Sociais / Site Oficial da Curadoria */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-dashed">
               {orgSettings?.website && (
                 <a href={orgSettings.website} target="_blank" className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl hover:bg-muted/50 transition-all">
                    <Globe className="w-4 h-4 text-secondary" />
                    <span className="text-[10px] font-black uppercase">Site Oficial</span>
                 </a>
               )}
               {orgSettings?.instagram && (
                 <a href={`https://instagram.com/${orgSettings.instagram.replace('@','')}`} target="_blank" className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl hover:bg-muted/50 transition-all">
                    <Instagram className="w-4 h-4 text-pink-500" />
                    <span className="text-[10px] font-black uppercase">Instagram</span>
                 </a>
               )}
               {(orgSettings?.contactEmail || orgSettings?.email) && (
                 <a href={`mailto:${orgSettings.contactEmail || orgSettings.email}`} className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl hover:bg-muted/50 transition-all">
                    <Mail className="w-4 h-4 text-secondary" />
                    <span className="text-[10px] font-black uppercase">Contato</span>
                 </a>
               )}
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  // FLOW: Divulgação ou Venda Externa (Padrão Viby)
  if (isDivulgacao || isExterno) {
    return (
      <section id="bilheteria" className="space-y-8 animate-in fade-in duration-500">
         <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Informações de Acesso</h2>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">
              {isExterno ? "Venda realizada em site parceiro." : "Evento com cobrança no local ou entrada franca."}
            </p>
         </div>

         <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
            <CardContent className="p-10 space-y-10">
               {event.disclosurePrices?.length > 0 ? (
                 <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                       <Coins className="w-4 h-4 text-secondary" /> Cronograma de Valores
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {event.disclosurePrices.map((p: any, i: number) => (
                         <div key={i} className="p-5 bg-muted/20 rounded-2xl border border-dashed flex justify-between items-center group hover:bg-muted/40 transition-all">
                            <div className="space-y-1">
                               <p className="text-[10px] font-black uppercase text-muted-foreground opacity-50">Até {p.untilTime}</p>
                               <p className="text-lg font-black text-primary">{formatPriceWithOriginal(p.price, eventCurrency)}</p>
                            </div>
                            <Clock className="w-5 h-5 text-secondary opacity-20 group-hover:opacity-100 transition-opacity" />
                         </div>
                       ))}
                    </div>
                 </div>
               ) : (
                 <div className="p-8 bg-green-50 rounded-3xl border-2 border-dashed border-green-100 flex flex-col items-center text-center gap-3">
                    <Zap className="w-10 h-10 text-green-500" />
                    <div className="space-y-1">
                       <p className="text-xl font-black uppercase italic text-green-700">Entrada Gratuita</p>
                       <p className="text-[10px] font-bold text-green-600 uppercase">Não há cobrança de ingressos para este acesso.</p>
                    </div>
                 </div>
               )}

               <div className="flex flex-col sm:flex-row gap-4">
                  {isExterno && (
                    <Button asChild className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-base hover:scale-102 transition-transform">
                       <a href={event.externalUrl} target="_blank" rel="noopener noreferrer">
                          Acessar Site de Vendas <ExternalLink className="ml-2 w-5 h-5" />
                       </a>
                    </Button>
                  )}
                  
                  <Button 
                    onClick={handleRegisterInterest}
                    disabled={hasRegistered || isRegisteringInterest}
                    className={cn(
                      "flex-1 h-16 font-black rounded-2xl shadow-xl uppercase italic text-base transition-all",
                      hasRegistered ? "bg-green-600 text-white" : "bg-secondary text-white hover:scale-102 shadow-secondary/20"
                    )}
                  >
                     {isRegisteringInterest ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : hasRegistered ? <CheckCircle2 className="w-6 h-6 mr-2" /> : <Heart className="w-5 h-5 mr-2" />}
                     {hasRegistered ? "Presença Confirmada" : "Vou nesta data"}
                  </Button>
               </div>

               <div className="p-5 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-4">
                  <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[10px] text-secondary font-bold uppercase leading-relaxed">
                      {isExterno 
                        ? "Você será redirecionado para um ambiente externo. A Viby não se responsabiliza por transações fora do nosso checkout oficial." 
                        : "Ao confirmar que 'Vai nesta data', você entra para a lista de presença do organizador e recebe lembretes sobre o evento."}
                    </p>
                  </div>
               </div>
            </CardContent>
         </Card>
      </section>
    );
  }

  // FLOW: Venda Interna (Viby Checkout)
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
