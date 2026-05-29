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
import { Switch } from "@/components/ui/switch"
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
  TicketPercent,
  CheckCircle2,
  X,
  Layers,
  Armchair,
  Ticket,
  Wallet,
  Coins,
  ArrowRight,
  ShieldAlert
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { formatCurrency, calculateFinancialBreakdown } from "@/lib/financial-utils"
import { createCheckoutSession } from "@/app/actions/stripe"
import { toast } from "@/hooks/use-toast"
import { doc, addDoc, collection, serverTimestamp, query, where, getDocs, limit, getDoc, updateDoc, increment, runTransaction } from "firebase/firestore"
import { generateUniqueTicketCode } from "@/lib/ticket-utils"
import { sendTicketEmail } from "@/app/actions/email"
import { AgeRatingBadge } from "@/lib/age-rating"

export default function CarrinhoPage() {
  const { items, removeItem, updateQuantity, clearCart } = useCart()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  
  const [processing, setProcessing] = React.useState(false)
  const [isWaitingPayment, setIsWaitingPayment] = React.useState(false)
  
  const [couponCode, setCouponCode] = React.useState("")
  const [appliedCoupon, setAppliedCoupon] = React.useState<any>(null)
  const [isApplyingCoupon, setIsApplyingCoupon] = React.useState(false)
  const [useBalance, setUseBalance] = React.useState(false)

  // Dados Auxiliares (Fees e Orgs)
  const [orgsData, setOrgsData] = React.useState<Record<string, any>>({})
  const [loadingConfig, setLoadingConfig] = React.useState(true)

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile } = useDoc<any>(userDocRef)

  const walletRef = React.useMemo(() => (db && user) ? doc(db, "wallets", user.uid) : null, [db, user])
  const { data: wallet } = useDoc<any>(walletRef)

  const feesRef = React.useMemo(() => db ? doc(db, 'settings', 'fees') : null, [db])
  const { data: globalFees } = useDoc<any>(feesRef)

  const promosRef = React.useMemo(() => db ? doc(db, 'settings', 'promotions') : null, [db])
  const { data: promotions } = useDoc<any>(promosRef)

  React.useEffect(() => {
    if (!db || items.length === 0) {
      setLoadingConfig(false)
      return
    }

    const fetchData = async () => {
      const orgIds = Array.from(new Set(items.map(i => i.organizationId)))
      const results: Record<string, any> = {}
      for (const id of orgIds) {
        const snap = await getDoc(doc(db, "organizations", id))
        if (snap.exists()) results[id] = snap.data()
      }
      setOrgsData(results)
      setLoadingConfig(false)
    }
    fetchData()
  }, [db, items])

  const walletBalance = wallet?.balance || 0
  const hasRestrictedEvents = items.some(item => (item as any).ageRating && (item as any).ageRating !== 'free');

  const cartTotals = React.useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let fees = 0;

    items.forEach(item => { subtotal += item.price * item.quantity; });

    if (appliedCoupon && items.length > 0) {
      const validItems = items.filter(i => i.eventId === appliedCoupon.eventId);
      if (validItems.length > 0) {
        const eventSubtotal = validItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
        if (appliedCoupon.discountType === 'percentage') discount = eventSubtotal * (appliedCoupon.discountValue / 100);
        else if (appliedCoupon.discountType === 'fixed') discount = Math.min(appliedCoupon.discountValue, eventSubtotal);
        else if (appliedCoupon.discountType === 'free_ticket') discount = Math.min(...validItems.map(i => i.price));
      }
    }

    const totalQtyEligible = items.reduce((acc, i) => acc + (appliedCoupon && i.eventId === appliedCoupon.eventId ? i.quantity : 0), 0);
    const discountPerUnit = totalQtyEligible > 0 ? (discount / totalQtyEligible) : 0;

    items.forEach(item => {
      const isEligible = appliedCoupon && item.eventId === appliedCoupon.eventId;
      const discountedUnitPrice = Math.max(0, item.price - (isEligible ? discountPerUnit : 0));
      const res = calculateFinancialBreakdown(discountedUnitPrice, globalFees, promotions, orgsData[item.organizationId]);
      fees += res.administrativeFeeAmount * item.quantity;
    });

    const totalBeforeBalance = Number(((subtotal - discount) + fees).toFixed(2));
    const balanceUsed = useBalance ? Math.min(walletBalance, totalBeforeBalance) : 0;
    const finalTotal = Number((totalBeforeBalance - balanceUsed).toFixed(2));

    return { subtotal, fees, discount, balanceUsed, total: finalTotal };
  }, [items, appliedCoupon, globalFees, promotions, orgsData, useBalance, walletBalance]);

  const handleApplyCoupon = async () => {
    if (!db || !couponCode.trim()) return;
    setIsApplyingCoupon(true);
    try {
      const q = query(collection(db, "coupons"), where("code", "==", couponCode.trim().toUpperCase()), where("status", "==", "Ativo"), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) { toast({ variant: "destructive", title: "Cupom inválido" }); setAppliedCoupon(null); return; }
      const couponData = { id: snap.docs[0].id, ...snap.docs[0].data() };
      if (couponData.validUntil && new Date(couponData.validUntil) < new Date()) { toast({ variant: "destructive", title: "Cupom expirado" }); return; }
      if (!items.some(item => item.eventId === couponData.eventId)) { toast({ variant: "destructive", title: "Evento não correspondente" }); return; }
      setAppliedCoupon(couponData); toast({ title: "Cupom aplicado!" });
    } catch (e) { toast({ variant: "destructive", title: "Erro no cupom" }); } finally { setIsApplyingCoupon(false); }
  }

  const handleCheckout = async () => {
    if (!user) return router.push("/login")
    if (!db || items.length === 0 || processing || loadingConfig) return

    setProcessing(true)
    try {
      const isFullBalanceOrder = cartTotals.total <= 0 && cartTotals.balanceUsed > 0;
      const isFreeOrder = cartTotals.total <= 0 && cartTotals.balanceUsed === 0;

      const registrationIds: string[] = [];
      const lineItems: any[] = [];
      
      const totalQtyEligible = items.reduce((acc, i) => acc + (appliedCoupon && i.eventId === appliedCoupon.eventId ? i.quantity : 0), 0);
      const discountPerUnit = totalQtyEligible > 0 ? (cartTotals.discount / totalQtyEligible) : 0;

      // Se for pagamento total via saldo, processamos no Ledger agora
      if (isFullBalanceOrder) {
        await runTransaction(db, async (transaction) => {
          const walletRef = doc(db, "wallets", user.uid);
          const userRef = doc(db, "users", user.uid);
          const wSnap = await transaction.get(walletRef);
          if (!wSnap.exists() || (wSnap.data().balance || 0) < cartTotals.balanceUsed) throw new Error("Saldo insuficiente.");
          transaction.set(walletRef, { balance: increment(-cartTotals.balanceUsed), updatedAt: serverTimestamp() }, { merge: true });
          transaction.update(userRef, { walletBalance: increment(-cartTotals.balanceUsed), updatedAt: serverTimestamp() });
          transaction.set(doc(collection(db, "wallet_transactions")), { userId: user.uid, amount: cartTotals.balanceUsed, type: 'debit', reason: 'compra_ingresso', description: `Compra Integral com Saldo`, timestamp: serverTimestamp() });
        });
      }

      // Preparar Ingressos
      for (const item of items) {
        const isEligible = appliedCoupon && item.eventId === appliedCoupon.eventId;
        const discountedPrice = Math.max(0, item.price - (isEligible ? discountPerUnit : 0));
        const breakdown = calculateFinancialBreakdown(discountedPrice, globalFees, promotions, orgsData[item.organizationId]);

        for (let i = 0; i < item.quantity; i++) {
          const ticketCode = await generateUniqueTicketCode(db);
          const regRef = await addDoc(collection(db, "registrations"), {
            ...item,
            userId: user.uid, userName: profile?.name || user.displayName || user.email || "Usuário", userEmail: user.email,
            ticketBasePrice: item.price, price: breakdown.customerFinalPrice, administrativeFeeAmount: breakdown.administrativeFeeAmount,
            producerFeeAmount: breakdown.producerFeeAmount, producerNetAmount: breakdown.producerNetAmount,
            paymentStatus: (isFreeOrder || isFullBalanceOrder) ? "Disponível" : "Pendente",
            confirmedAt: (isFreeOrder || isFullBalanceOrder) ? serverTimestamp() : null,
            ticketCode, status: "Ativo", createdAt: serverTimestamp(), timestamp: serverTimestamp()
          });
          registrationIds.push(regRef.id);
          
          if (isFreeOrder || isFullBalanceOrder) {
            await sendTicketEmail({ to: user.email!, userName: profile?.name || user.displayName || "Participante", eventTitle: item.eventTitle, ticketCode, eventDate: item.eventDate, eventCity: item.eventCity, voucherUrl: `https://viby.club/dashboard/ingressos/${regRef.id}/voucher` });
          }
        }

        if (!isFreeOrder && !isFullBalanceOrder) {
          lineItems.push({
            price_data: { currency: 'brl', product_data: { name: `${item.eventTitle} - ${item.ticketTypeName}`, images: item.eventImage ? [item.eventImage] : [] }, unit_amount: Math.round(breakdown.customerFinalPrice * 100) },
            quantity: item.quantity
          });
        }
      }

      if (isFreeOrder || isFullBalanceOrder) {
        clearCart();
        toast({ title: "Sucesso!", description: "Seus ingressos já estão disponíveis." });
        router.push("/dashboard/ingressos");
      } else {
        // Redireciona para o Stripe usando as chaves dinâmicas
        const result = await createCheckoutSession({
          eventTitle: items.length > 1 ? "Múltiplos Ingressos" : items[0].eventTitle,
          totalAmount: Math.round(cartTotals.total * 100),
          userEmail: user.email!,
          lineItems: cartTotals.balanceUsed > 0 ? undefined : lineItems, // Usa o total consolidado se houver abatimento de saldo
          metadata: { type: "cart_checkout", registrationIds: registrationIds.join(","), userId: user.uid, balanceUsed: cartTotals.balanceUsed.toString() }
        });

        if (result.url) { 
          window.open(result.url, '_blank'); 
          setIsWaitingPayment(true);
        }
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Checkout Indisponível", description: e.message });
    } finally {
      setProcessing(false)
    }
  }

  if (items.length === 0 && !isWaitingPayment) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-6">
        <ShoppingCart className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-2xl font-black uppercase italic">Carrinho Vazio</h2>
        <Button asChild className="bg-secondary text-white font-black rounded-full px-10 h-12 uppercase italic shadow-lg"><Link href="/dashboard">Explorar Eventos</Link></Button>
      </div>
    )
  }

  if (isWaitingPayment) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
           <div className="bg-primary p-12 flex flex-col items-center text-white gap-6">
              <RefreshCw className="w-12 h-12 animate-spin text-secondary" />
              <h2 className="text-2xl font-black uppercase italic text-center">Pagamento em Processamento</h2>
           </div>
           <CardContent className="p-10 text-center space-y-8">
              <p className="text-sm font-medium text-muted-foreground uppercase leading-relaxed">Conclua o pagamento na aba que se abriu. Seu painel será atualizado automaticamente.</p>
              <div className="flex flex-col gap-3">
                 <Button variant="outline" className="h-12 rounded-xl font-bold" onClick={() => window.location.reload()}>Verificar Status</Button>
                 <Button variant="ghost" className="text-[10px] font-black uppercase" onClick={() => setIsWaitingPayment(false)}>Voltar ao Carrinho</Button>
              </div>
           </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3"><ShoppingCart className="w-8 h-8 text-secondary" /> Carrinho</h1>
        <Button variant="ghost" className="text-destructive font-bold uppercase text-[10px]" onClick={clearCart}>Limpar Tudo</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
           {hasRestrictedEvents && <div className="p-4 bg-orange-50 rounded-2xl border-2 border-dashed border-orange-200 flex items-start gap-4"><ShieldAlert className="w-6 h-6 text-orange-600 shrink-0" /><div className="space-y-1"><h3 className="text-xs font-black uppercase italic text-orange-800">Aviso de Faixa Etária</h3><p className="text-[10px] text-orange-700 font-medium uppercase">Existem eventos restritos no seu carrinho. Documento com foto será exigido na entrada.</p></div></div>}

           <div className="space-y-4">
              {loadingConfig ? <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div> : 
               items.map((item) => {
                const res = calculateFinancialBreakdown(item.price, globalFees, promotions, orgsData[item.organizationId]);
                return (
                  <Card key={item.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                     <div className="flex flex-col sm:flex-row">
                        <div className="relative w-full sm:w-48 h-32 bg-muted">
                           <Image src={item.eventImage || "https://picsum.photos/seed/event/400/300"} alt={item.eventTitle} fill className="object-cover" unoptimized />
                        </div>
                        <CardContent className="p-6 flex-1 flex flex-col justify-between">
                           <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                 <h3 className="font-bold text-base uppercase italic">{item.eventTitle}</h3>
                                 <p className="text-[10px] font-bold text-muted-foreground uppercase">{item.ticketTypeName} • {item.batchName}</p>
                              </div>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(item.id)}><Trash2 className="w-4 h-4" /></Button>
                           </div>
                           <div className="flex items-center justify-between mt-6">
                              <div className="flex items-center gap-3"><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus className="w-3 h-3" /></Button><span className="font-black text-sm">{item.quantity}</span><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus className="w-3 h-3" /></Button></div>
                              <div className="text-right"><p className="text-lg font-black text-primary">{formatCurrency(res.customerFinalPrice * item.quantity)}</p></div>
                           </div>
                        </CardContent>
                     </div>
                  </Card>
                );
              })}
           </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <Card className="border-none shadow-sm rounded-[2rem] bg-primary text-white overflow-hidden p-6">
              <div className="flex justify-between items-center">
                 <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase opacity-40">Saldo Viby</p>
                    <p className="text-xl font-black italic">{formatCurrency(walletBalance)}</p>
                 </div>
                 <Switch checked={useBalance} onCheckedChange={setUseBalance} disabled={walletBalance <= 0} />
              </div>
           </Card>

           <Card className="border-none shadow-xl rounded-[2.5rem] bg-white border-t-8 border-secondary">
              <CardHeader><CardTitle className="text-xl font-black italic uppercase tracking-tighter">Resumo</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                 <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold uppercase opacity-60"><span>Subtotal</span><span>{formatCurrency(cartTotals.subtotal)}</span></div>
                    <div className="flex justify-between text-xs font-bold uppercase opacity-60"><span>Taxas Adm.</span><span>{formatCurrency(cartTotals.fees)}</span></div>
                    {cartTotals.discount > 0 && <div className="flex justify-between text-xs font-black uppercase text-green-600"><span>Desconto</span><span>-{formatCurrency(cartTotals.discount)}</span></div>}
                    {cartTotals.balanceUsed > 0 && <div className="flex justify-between text-xs font-black uppercase text-secondary"><span>Abatimento Saldo</span><span>-{formatCurrency(cartTotals.balanceUsed)}</span></div>}
                    <Separator />
                    <div className="flex justify-between items-center"><span className="text-lg font-black uppercase italic">Total</span><span className="text-2xl font-black text-primary">{formatCurrency(cartTotals.total)}</span></div>
                 </div>
                 <Button onClick={handleCheckout} disabled={processing || loadingConfig} className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg transition-all hover:scale-[1.02]">
                    {processing ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <><CreditCard className="w-6 h-6 mr-2" /> Pagar Agora</>}
                 </Button>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  )
}
