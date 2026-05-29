"use client"

import * as React from "react"
import { useCart } from "@/contexts/CartContext"
import { useAuth, useUser, useFirestore, db as singletonDB } from "@/firebase"
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
  ArrowLeft, 
  Loader2,
  RefreshCw,
  TicketPercent,
  X,
  Wallet,
  ShieldAlert
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { formatCurrency, calculateFinancialBreakdown } from "@/lib/financial-utils"
import { toast } from "@/hooks/use-toast"
import { query, where, getDocs, limit, getDoc } from "firebase/firestore"
import { useErrorManager } from "@/components/error-manager/ErrorManagerProvider"
import { safeCollection, safeDoc } from "@/lib/firestore-safe"
import { useDoc } from "@/firebase"
import { PayNow } from "@/components/payments/PayNow"

export default function CarrinhoPage() {
  const { items, removeItem, updateQuantity, clearCart } = useCart()
  const router = useRouter()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { reportError } = useErrorManager()
  
  const hookDb = useFirestore()
  const db = hookDb || singletonDB
  
  const [isWaitingPayment, setIsWaitingPayment] = React.useState(false)
  const [couponCode, setCouponCode] = React.useState("")
  const [appliedCoupon, setAppliedCoupon] = React.useState<any>(null)
  const [isApplyingCoupon, setIsApplyingCoupon] = React.useState(false)
  const [useBalance, setUseBalance] = React.useState(false)

  const [orgsData, setOrgsData] = React.useState<Record<string, any>>({})
  const [loadingConfig, setLoadingConfig] = React.useState(true)

  const userDocRef = React.useMemo(() => (db && user) ? safeDoc(db, "users", user.uid) : null, [db, user])
  const { data: profile } = useDoc<any>(userDocRef)

  const walletRef = React.useMemo(() => (db && user) ? safeDoc(db, "wallets", user.uid) : null, [db, user])
  const { data: wallet } = useDoc<any>(walletRef)

  const feesRef = React.useMemo(() => db ? safeDoc(db, 'settings', 'fees') : null, [db])
  const { data: globalFees } = useDoc<any>(feesRef)

  const promosRef = React.useMemo(() => db ? safeDoc(db, 'settings', 'promotions') : null, [db])
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
        const snap = await getDoc(safeDoc(db, "organizations", id))
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
      const q = query(safeCollection(db, "coupons"), where("code", "==", couponCode.trim().toUpperCase()), where("status", "==", "Ativo"), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) { toast({ variant: "destructive", title: "Cupom inválido" }); setAppliedCoupon(null); return; }
      const couponData = { id: snap.docs[0].id, ...snap.docs[0].data() };
      if (couponData.validUntil && new Date(couponData.validUntil) < new Date()) { toast({ variant: "destructive", title: "Cupom expirado" }); return; }
      if (!items.some(item => item.eventId === couponData.eventId)) { toast({ variant: "destructive", title: "Evento não correspondente" }); return; }
      setAppliedCoupon(couponData); toast({ title: "Cupom aplicado!" });
    } catch (e) { 
      reportError({ error: e, type: 'coupon_apply_error', severity: 'warning' });
    } finally { setIsApplyingCoupon(false); }
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
                 <div className="space-y-3">
                   <div className="flex gap-2">
                     <Input 
                       placeholder="CUPOM" 
                       value={couponCode} 
                       onChange={e => setCouponCode(e.target.value.toUpperCase())}
                       className="rounded-xl h-11 border-dashed font-black"
                     />
                     <Button variant="secondary" onClick={handleApplyCoupon} disabled={isApplyingCoupon} className="h-11 rounded-xl px-4">
                       {isApplyingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : <TicketPercent className="w-4 h-4" />}
                     </Button>
                   </div>
                   {appliedCoupon && (
                     <Badge className="w-full bg-green-500 text-white justify-between px-3 h-8 rounded-lg border-none uppercase font-black text-[9px]">
                        <span>CUPOM: {appliedCoupon.code}</span>
                        <X className="w-3 h-3 cursor-pointer" onClick={() => setAppliedCoupon(null)} />
                     </Badge>
                   )}
                 </div>
                 
                 <PayNow 
                   items={items}
                   totals={cartTotals}
                   profile={profile}
                   orgsData={orgsData}
                   globalFees={globalFees}
                   promotions={promotions}
                   useBalance={useBalance}
                   onSuccess={() => clearCart()}
                   disabled={loadingConfig}
                 />
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  )
}
