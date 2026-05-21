
"use client"

import * as React from "react"
import { useCart } from "@/contexts/CartContext"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
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
  RefreshCw,
  ShieldCheck,
  TicketPercent,
  CheckCircle2,
  X
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { formatCurrency, calculateFinancialBreakdown } from "@/lib/financial-utils"
import { createCheckoutSession } from "@/app/actions/stripe"
import { toast } from "@/hooks/use-toast"
import { doc, addDoc, collection, serverTimestamp, query, where, getDocs, limit } from "firebase/firestore"
import { generateUniqueTicketCode } from "@/lib/ticket-utils"
import { sendCartPendingEmail } from "@/app/actions/email"
import { cn } from "@/lib/utils"

export default function CarrinhoPage() {
  const { items, removeItem, updateQuantity, clearCart } = useCart()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  
  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)

  const plansRef = React.useMemo(() => db ? doc(db, 'settings', 'plans') : null, [db])
  const { data: plansSettings } = useDoc<any>(plansRef)

  const [processing, setProcessing] = React.useState(false)
  const [isWaitingPayment, setIsWaitingPayment] = React.useState(false)
  
  // States para Cupons
  const [couponCode, setCouponCode] = React.useState("")
  const [appliedCoupon, setAppliedCoupon] = React.useState<any>(null)
  const [isApplyingCoupon, setIsApplyingCoupon] = React.useState(false)

  // O cálculo de totais precisa ser individualizado por organizador para aplicar taxas de planos diferentes
  const [breakdowns, setBreakdowns] = React.useState<Record<string, any>>({})
  const [loadingBreakdowns, setLoadingBreakdowns] = React.useState(true)

  // Carrega os dados de planos dos organizadores para o cálculo correto das taxas
  React.useEffect(() => {
    if (!db || items.length === 0 || !plansSettings) {
      setLoadingBreakdowns(false)
      return
    }

    const fetchOrganizerPlans = async () => {
      setLoadingBreakdowns(true)
      const uniqueOrganizerIds = Array.from(new Set(items.map(i => i.organizerId)))
      const newBreakdowns: Record<string, any> = {}

      try {
        for (const orgId of uniqueOrganizerIds) {
          const orgUserRef = doc(db, "users", orgId)
          const orgUserSnap = await getDoc(orgUserRef)
          
          if (orgUserSnap.exists()) {
            const orgData = orgUserSnap.data()
            const planKey = (orgData.plan || "START").toLowerCase()
            const planData = orgData.planOverride || plansSettings[planKey] || {}
            newBreakdowns[orgId] = planData
          }
        }
        setBreakdowns(newBreakdowns)
      } catch (e) {
        console.error("Erro ao carregar planos dos organizadores", e)
      } finally {
        setLoadingBreakdowns(false)
      }
    }

    fetchOrganizerPlans()
  }, [db, items, plansSettings])

  const cartTotals = React.useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let fees = 0;

    items.forEach(item => {
      subtotal += item.price * item.quantity;
    });

    if (appliedCoupon && items.length > 0) {
      const validItems = items.filter(i => i.eventId === appliedCoupon.eventId);
      if (validItems.length > 0) {
        const eventSubtotal = validItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
        if (appliedCoupon.discountType === 'percentage') {
          discount = eventSubtotal * (appliedCoupon.discountValue / 100);
        } else if (appliedCoupon.discountType === 'fixed') {
          discount = Math.min(appliedCoupon.discountValue, eventSubtotal);
        } else if (appliedCoupon.discountType === 'free_ticket') {
          const prices = validItems.map(i => i.price);
          discount = Math.min(...prices);
        }
      }
    }

    const totalQtyEligible = items.reduce((acc, i) => acc + (appliedCoupon && i.eventId === appliedCoupon.eventId ? i.quantity : 0), 0);
    const discountPerUnit = totalQtyEligible > 0 ? (discount / totalQtyEligible) : 0;

    items.forEach(item => {
      const isEligible = appliedCoupon && item.eventId === appliedCoupon.eventId;
      const unitDiscount = isEligible ? discountPerUnit : 0;
      const discountedUnitPrice = Math.max(0, item.price - unitDiscount);
      
      // Usa o plano específico do organizador se disponível
      const orgPlan = breakdowns[item.organizerId];
      const res = calculateFinancialBreakdown(discountedUnitPrice, orgPlan);
      fees += res.administrativeFeeAmount * item.quantity;
    });

    const finalTotal = Math.max(0, (subtotal - discount) + fees);
    return { subtotal, fees, discount, total: finalTotal };
  }, [items, appliedCoupon, breakdowns]);

  const handleApplyCoupon = async () => {
    if (!db || !couponCode.trim()) return;
    setIsApplyingCoupon(true);
    try {
      const q = query(
        collection(db, "coupons"), 
        where("code", "==", couponCode.trim().toUpperCase()),
        where("status", "==", "Ativo"),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        toast({ variant: "destructive", title: "Cupom inválido" });
        setAppliedCoupon(null);
        return;
      }
      const couponData = { id: snap.docs[0].id, ...snap.docs[0].data() };
      const now = new Date();
      if (couponData.validUntil && new Date(couponData.validUntil) < now) {
        toast({ variant: "destructive", title: "Cupom expirado" });
        return;
      }
      const hasEventInCart = items.some(item => item.eventId === couponData.eventId);
      if (!hasEventInCart) {
        toast({ variant: "destructive", title: "Evento não correspondente" });
        return;
      }
      setAppliedCoupon(couponData);
      toast({ title: "Cupom aplicado!" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao validar cupom" });
    } finally {
      setIsApplyingCoupon(false);
    }
  }

  const handleCheckout = async () => {
    if (!user) return router.push("/login")
    if (!db || items.length === 0 || processing) return

    setProcessing(true)
    try {
      const registrationIds = [];
      const lineItems = [];
      const totalQtyEligible = items.reduce((acc, i) => acc + (appliedCoupon && i.eventId === appliedCoupon.eventId ? i.quantity : 0), 0);
      const discountPerUnit = totalQtyEligible > 0 ? (cartTotals.discount / totalQtyEligible) : 0;

      for (const item of items) {
        const isEligibleForDiscount = appliedCoupon && item.eventId === appliedCoupon.eventId;
        const currentItemDiscount = isEligibleForDiscount ? discountPerUnit : 0;
        const discountedPrice = Math.max(0, item.price - currentItemDiscount);
        
        // Busca o plano do organizador para gravar os valores corretos
        const orgPlan = breakdowns[item.organizerId];
        const breakdown = calculateFinancialBreakdown(discountedPrice, orgPlan);
        
        for (let i = 0; i < item.quantity; i++) {
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
            discountApplied: currentItemDiscount,
            price: breakdown.customerFinalPrice,
            administrativeFeeAmount: breakdown.administrativeFeeAmount,
            producerFeeAmount: breakdown.producerFeeAmount,
            producerNetAmount: breakdown.producerNetAmount,
            batchId: item.batchId,
            batchName: item.batchName,
            ticketTypeId: item.ticketTypeId,
            ticketTypeName: item.ticketTypeName,
            poolId: item.poolId || null,
            poolName: item.poolName || null,
            couponId: isEligibleForDiscount ? appliedCoupon.id : null,
            quantity: 1,
            checkedIn: false,
            paymentStatus: "Pendente",
            ticketCode,
            status: "Ativo",
            createdAt: serverTimestamp(),
            timestamp: serverTimestamp()
          };
          const docRef = await addDoc(collection(db, "registrations"), regData);
          registrationIds.push(docRef.id);
        }

        lineItems.push({
          price_data: {
            currency: 'brl',
            product_data: {
              name: `${item.eventTitle} - ${item.ticketTypeName}`,
              description: `Voucher individual`,
              images: (item.eventImage && item.eventImage.startsWith('http')) ? [item.eventImage] : [],
            },
            unit_amount: Math.round(breakdown.customerFinalPrice * 100),
          },
          quantity: item.quantity,
        });
      }

      await sendCartPendingEmail({
        to: user.email!, userName: user.displayName || "Usuário",
        items: items, totalAmount: cartTotals.total, siteName: settings?.siteName || "Viby Club"
      });

      const { url } = await createCheckoutSession({
        eventId: "multiple", eventTitle: "Ingressos Viby Club", eventImage: "",
        userId: user.uid, userName: user.displayName || "Usuário", userEmail: user.email!,
        totalAmount: Math.round(cartTotals.total * 100),
        metadata: { 
          type: "cart_checkout",
          registrationIds: registrationIds.join(","),
          userId: user.uid,
          couponId: appliedCoupon?.id || null
        }
      });

      if (url) { window.open(url, '_blank'); setIsWaitingPayment(true); }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
      setProcessing(false);
    }
  }

  if (items.length === 0 && !isWaitingPayment) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-6">
        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center"><ShoppingCart className="w-12 h-12 text-muted-foreground opacity-20" /></div>
        <div className="text-center space-y-2"><h2 className="text-2xl font-black uppercase italic tracking-tighter">Seu carrinho está vazio</h2></div>
        <Button asChild className="bg-secondary text-white font-black rounded-2xl px-10 h-14 uppercase italic shadow-lg"><Link href="/dashboard">Explorar Eventos</Link></Button>
      </div>
    )
  }

  if (isWaitingPayment) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
           <div className="bg-primary p-12 flex flex-col items-center text-white gap-6">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center relative">
                 <RefreshCw className="w-10 h-10 animate-spin text-secondary" /><CreditCard className="w-5 h-5 absolute text-white" />
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">Aguardando Pagamento</h2>
           </div>
           <CardContent className="p-10 text-center space-y-8">
              <div className="p-4 bg-muted/30 rounded-2xl border border-dashed flex gap-3 text-left">
                 <Info className="w-5 h-5 text-secondary shrink-0" /><p className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">Seu painel será atualizado assim que o pagamento for concluído.</p>
              </div>
              <div className="flex flex-col gap-3">
                 <Button variant="outline" className="h-12 rounded-xl font-bold" onClick={() => window.location.reload()}>Verificar Status</Button>
                 <Button variant="ghost" className="text-[10px] font-black uppercase text-muted-foreground" onClick={() => setIsWaitingPayment(false)}>Voltar ao Carrinho</Button>
              </div>
           </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3"><ShoppingCart className="w-8 h-8 text-secondary" /> Carrinho</h1>
        </div>
        <Button variant="ghost" className="text-destructive font-bold uppercase text-[10px]" onClick={clearCart}>Limpar Tudo</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-4">
           {loadingBreakdowns ? <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div> : 
            items.map((item) => {
             const orgPlan = breakdowns[item.organizerId];
             const res = calculateFinancialBreakdown(item.price, orgPlan);
             return (
               <Card key={item.id} className="border-none shadow-sm rounded-2xl overflow-hidden group">
                  <div className="flex flex-col sm:flex-row">
                     <div className="relative w-full sm:w-48 h-32 sm:h-auto bg-muted"><Image src={item.eventImage || "https://picsum.photos/seed/event/400/300"} alt={item.eventTitle} fill className="object-cover" unoptimized /></div>
                     <CardContent className="p-6 flex-1 flex flex-col justify-between gap-4">
                        <div className="flex justify-between items-start gap-4">
                           <div className="space-y-1"><h3 className="font-bold text-base leading-tight uppercase italic tracking-tight">{item.eventTitle}</h3><div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase"><span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(item.eventDate).toLocaleDateString('pt-BR')}</span></div></div>
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(item.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                        <div className="flex flex-wrap items-end justify-between gap-4 pt-4 border-t border-dashed border-border/60">
                           <div><Badge variant="outline" className="text-[9px] font-black uppercase border-secondary text-secondary">{item.ticketTypeName}</Badge></div>
                           <div className="flex items-center gap-6">
                              <div className="flex items-center gap-3"><Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus className="w-3 h-3" /></Button><span className="font-black text-sm">{item.quantity}</span><Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus className="w-3 h-3" /></Button></div>
                              <div className="text-right"><p className="text-lg font-black text-primary">{formatCurrency(res.customerFinalPrice * item.quantity)}</p><p className="text-[8px] font-bold text-muted-foreground uppercase">Taxa: {formatCurrency(res.administrativeFeeAmount * item.quantity)} incl.</p></div>
                           </div>
                        </div>
                     </CardContent>
                  </div>
               </Card>
             );
           })}
        </div>

        <div className="lg:col-span-4 space-y-6">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white">
              <CardHeader className="pb-4"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><TicketPercent className="w-4 h-4 text-secondary" /> Possui Cupom?</CardTitle></CardHeader>
              <CardContent>
                 {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-200"><div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-600" /><div><p className="text-xs font-black uppercase text-green-800">{appliedCoupon.code}</p></div></div><Button variant="ghost" size="icon" className="h-8 w-8 text-green-800" onClick={() => { setAppliedCoupon(null); setCouponCode(""); }}><X className="w-4 h-4" /></Button></div>
                 ) : (
                    <div className="flex gap-2"><Input placeholder="CÓDIGO" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} className="rounded-xl font-bold uppercase" /><Button variant="secondary" onClick={handleApplyCoupon} disabled={isApplyingCoupon || !couponCode} className="rounded-xl font-bold">{isApplyingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}</Button></div>
                 )}
              </CardContent>
           </Card>

           <Card className="border-none shadow-xl rounded-[2.5rem] bg-white border-t-8 border-secondary sticky top-24">
              <CardHeader><CardTitle className="text-xl font-black italic uppercase tracking-tighter">Resumo da Compra</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                 <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold uppercase opacity-60"><span>Subtotal</span><span>{formatCurrency(cartTotals.subtotal)}</span></div>
                    {cartTotals.discount > 0 && <div className="flex justify-between text-xs font-black uppercase text-green-600"><span>Desconto</span><span>-{formatCurrency(cartTotals.discount)}</span></div>}
                    <div className="flex justify-between text-xs font-bold uppercase opacity-60"><span>Taxas</span><span>{formatCurrency(cartTotals.fees)}</span></div>
                    <Separator className="bg-border/60" />
                    <div className="flex justify-between items-center"><span className="text-lg font-black uppercase italic">Total</span><span className="text-2xl font-black text-primary">{formatCurrency(cartTotals.total)}</span></div>
                 </div>
                 <Button onClick={handleCheckout} disabled={processing || loadingBreakdowns} className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform gap-3">{processing ? <Loader2 className="w-6 h-6 animate-spin" /> : (cartTotals.total > 0 ? <><CreditCard className="w-6 h-6" /> Pagar via Stripe</> : "Confirmar Reserva")}</Button>
                 <Button variant="ghost" asChild className="w-full font-bold text-muted-foreground uppercase text-xs tracking-widest"><Link href="/dashboard">Continuar Comprando</Link></Button>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  )
}
