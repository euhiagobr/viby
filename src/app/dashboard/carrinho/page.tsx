
"use client"

import * as React from "react"
import { useCart } from "@/contexts/CartContext"
import { useAuth, useUser, useFirestore } from "@/firebase"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  Info,
  Loader2,
  Ticket,
  ShieldAlert
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { formatCurrency, calculateFinancialBreakdown } from "@/lib/financial-utils"
import { createCheckoutSession } from "@/app/actions/stripe"
import { toast } from "@/hooks/use-toast"
import { doc, addDoc, collection, serverTimestamp } from "firebase/firestore"
import { generateUniqueTicketCode } from "@/lib/ticket-utils"

export default function CarrinhoPage() {
  const { items, removeItem, updateQuantity, clearCart } = useCart()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const [processing, setProcessing] = React.useState(false)

  const cartTotals = React.useMemo(() => {
    return items.reduce((acc, item) => {
      const breakdown = calculateFinancialBreakdown(item.price); // Default plan for buyer view
      acc.subtotal += item.price * item.quantity;
      acc.fees += breakdown.administrativeFeeAmount * item.quantity;
      acc.total += breakdown.customerFinalPrice * item.quantity;
      return acc;
    }, { subtotal: 0, fees: 0, total: 0 });
  }, [items]);

  const handleCheckout = async () => {
    if (!user) return router.push("/login")
    if (!db || items.length === 0) return

    setProcessing(true)
    try {
      // Para múltiplos itens, criamos uma sessão do Stripe com múltiplos line_items.
      // No Viby, as registrations são criadas após o sucesso, ou podemos criar como "Pendente".
      // Vamos criar as registrations pendentes para rastrear no metadata.
      
      const registrationIds = [];
      const lineItems = [];

      for (const item of items) {
        const breakdown = calculateFinancialBreakdown(item.price);
        const ticketCode = await generateUniqueTicketCode(db);
        
        const regData = {
          eventId: item.eventId,
          eventTitle: item.eventTitle,
          eventImage: item.eventImage,
          eventDate: item.eventDate,
          eventCity: item.eventCity,
          userId: user.uid,
          userName: user.displayName || user.email || "Usuário",
          userEmail: user.email,
          attendeeName: user.displayName || user.email || "Participante",
          organizationId: item.organizationId,
          organizerId: item.organizerId,
          organizerUsername: item.organizerUsername,
          ticketBasePrice: item.price,
          price: breakdown.customerFinalPrice,
          administrativeFeeAmount: breakdown.administrativeFeeAmount,
          batchId: item.batchId,
          batchName: item.batchName,
          ticketTypeId: item.ticketTypeId,
          ticketTypeName: item.ticketTypeName,
          poolId: item.poolId || null,
          poolName: item.poolName || null,
          quantity: item.quantity,
          checkedIn: false,
          paymentStatus: "Pendente",
          ticketCode,
          status: "Ativo",
          createdAt: serverTimestamp(),
          timestamp: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "registrations"), regData);
        registrationIds.push(docRef.id);

        lineItems.push({
          price_data: {
            currency: 'brl',
            product_data: {
              name: item.eventTitle,
              description: `${item.ticketTypeName} (${item.quantity}x)`,
              images: item.eventImage ? [item.eventImage] : [],
            },
            unit_amount: Math.round(breakdown.customerFinalPrice * 100),
          },
          quantity: item.quantity,
        });
      }

      const { url } = await createCheckoutSession({
        eventId: "multiple", // Identificador genérico
        eventTitle: "Ingressos Viby Club",
        eventImage: "",
        userId: user.uid,
        userName: user.displayName || "Usuário",
        userEmail: user.email!,
        totalAmount: Math.round(cartTotals.total * 100),
        metadata: { 
          type: "cart_checkout",
          registrationIds: registrationIds.join(","),
          userId: user.uid 
        }
      });

      if (url) window.location.href = url;
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setProcessing(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-6">
        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center">
           <ShoppingCart className="w-12 h-12 text-muted-foreground opacity-20" />
        </div>
        <div className="text-center space-y-2">
           <h2 className="text-2xl font-black uppercase italic tracking-tighter">Seu carrinho está vazio</h2>
           <p className="text-muted-foreground font-medium">Você ainda não selecionou nenhum ingresso.</p>
        </div>
        <Button asChild className="bg-secondary text-white font-black rounded-2xl px-10 h-14 uppercase italic shadow-lg">
           <Link href="/dashboard">Explorar Eventos</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
             <ShoppingCart className="w-8 h-8 text-secondary" /> Carrinho
          </h1>
        </div>
        <Button variant="ghost" className="text-destructive font-bold uppercase text-[10px]" onClick={clearCart}>Limpar Tudo</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-4">
           {items.map((item) => {
             const breakdown = calculateFinancialBreakdown(item.price);
             return (
               <Card key={item.id} className="border-none shadow-sm rounded-2xl overflow-hidden group">
                  <div className="flex flex-col sm:flex-row">
                     <div className="relative w-full sm:w-48 h-32 sm:h-auto bg-muted">
                        <Image src={item.eventImage || "https://picsum.photos/seed/event/400/300"} alt={item.eventTitle} fill className="object-cover" unoptimized />
                     </div>
                     <CardContent className="p-6 flex-1 flex flex-col justify-between gap-4">
                        <div className="flex justify-between items-start gap-4">
                           <div className="space-y-1">
                              <h3 className="font-bold text-base leading-tight uppercase italic tracking-tight">{item.eventTitle}</h3>
                              <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase">
                                 <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(item.eventDate).toLocaleDateString('pt-BR')}</span>
                                 <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.eventCity}</span>
                              </div>
                           </div>
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeItem(item.id)}>
                              <Trash2 className="w-4 h-4" />
                           </Button>
                        </div>

                        <div className="flex flex-wrap items-end justify-between gap-4 pt-4 border-t border-dashed border-border/60">
                           <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                 <Badge variant="outline" className="text-[9px] font-black uppercase border-secondary text-secondary">{item.ticketTypeName}</Badge>
                                 {item.requiresProof && <Badge className="bg-orange-500 text-white text-[8px] h-4">Doc. Obrigatório</Badge>}
                              </div>
                              <p className="text-[10px] font-medium text-muted-foreground">Valor Unitário: {formatCurrency(item.price)} + Taxas</p>
                           </div>

                           <div className="flex items-center gap-6">
                              <div className="flex items-center gap-3">
                                 <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus className="w-3 h-3" /></Button>
                                 <span className="font-black text-sm">{item.quantity}</span>
                                 <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus className="w-3 h-3" /></Button>
                              </div>
                              <div className="text-right">
                                 <p className="text-lg font-black text-primary">{formatCurrency(breakdown.customerFinalPrice * item.quantity)}</p>
                                 <p className="text-[8px] font-bold text-muted-foreground uppercase">Taxa: {formatCurrency(breakdown.administrativeFeeAmount * item.quantity)} incl.</p>
                              </div>
                           </div>
                        </div>
                     </CardContent>
                  </div>
               </Card>
             );
           })}
        </div>

        <div className="lg:col-span-4">
           <Card className="border-none shadow-xl rounded-[2.5rem] bg-white border-t-8 border-secondary sticky top-24">
              <CardHeader>
                 <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Resumo da Compra</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold uppercase opacity-60"><span>Subtotal (Ingressos)</span><span>{formatCurrency(cartTotals.subtotal)}</span></div>
                    <div className="flex justify-between text-xs font-bold uppercase opacity-60"><span>Taxas de Serviço</span><span>{formatCurrency(cartTotals.fees)}</span></div>
                    <Separator className="bg-border/60" />
                    <div className="flex justify-between items-center">
                       <span className="text-lg font-black uppercase italic">Total</span>
                       <span className="text-2xl font-black text-primary">{formatCurrency(cartTotals.total)}</span>
                    </div>
                 </div>

                 <div className="p-4 bg-muted/30 rounded-2xl border border-dashed border-border space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
                       <Info className="w-3 h-3 text-secondary" /> Informação Legal
                    </div>
                    <p className="text-[9px] text-muted-foreground font-medium leading-relaxed">
                       Ao finalizar, você garante sua presença em todos os eventos listados. Os vouchers serão enviados individualmente para seu e-mail após a confirmação.
                    </p>
                 </div>

                 <Button 
                   onClick={handleCheckout} 
                   disabled={processing}
                   className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform gap-3"
                 >
                    {processing ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CreditCard className="w-6 h-6" /> Finalizar Pagamento</>}
                 </Button>

                 <Button variant="ghost" asChild className="w-full font-bold text-muted-foreground uppercase text-xs tracking-widest">
                    <Link href="/dashboard">Continuar Comprando</Link>
                 </Button>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  )
}
