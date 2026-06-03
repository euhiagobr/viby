"use client"

import * as React from "react"
import { useCart, CartItem } from "@/contexts/CartContext"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Loader2,
  ShieldAlert,
  Wallet,
  Clock,
  Timer,
  Info,
  AlertCircle,
  ShieldCheck,
  Calendar,
  RefreshCw,
  TicketPercent,
  CheckCircle2,
  X,
  Inbox
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { formatCurrency, calculateFinancialBreakdown } from "@/lib/financial-utils"
import { PayButton } from "@/components/payments/PayButton"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function CarrinhoPage() {
  const { items, removeItem, updateQuantity, clearCart, expiresAt, setItems } = useCart()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  
  const [useBalance, setUseBalance] = React.useState(false)
  const [orgsData, setOrgsData] = React.useState<Record<string, any>>({})
  const [isRevalidating, setIsRevalidating] = React.useState(false)
  const [timeLeft, setTimeLeft] = React.useState<{ min: number, sec: number, percent: number } | null>(null)
  const [couponInputs, setCouponInputs] = React.useState<Record<string, string>>({})
  const [applyingCoupon, setApplyingCoupon] = React.useState<string | null>(null)

  const isProcessingRef = React.useRef(false)

  const walletRef = React.useMemo(() => (db && user) ? doc(db, "wallets", user.uid) : null, [db, user]);
  const { data: wallet } = useDoc<any>(walletRef);

  const profileRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user]);
  const { data: profile } = useDoc<any>(profileRef);

  const feesRef = React.useMemo(() => db ? doc(db, 'settings', 'fees') : null, [db])
  const { data: globalFees } = useDoc<any>(feesRef)
  
  const promosRef = React.useMemo(() => db ? doc(db, 'settings', 'promotions') : null, [db])
  const { data: promotions } = useDoc<any>(promosRef)

  React.useEffect(() => {
    if (!expiresAt || items.length === 0) {
      setTimeLeft(null);
      return;
    }
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = expiresAt - now;
      if (diff <= 0) {
        setTimeLeft({ min: 0, sec: 0, percent: 0 });
        clearInterval(interval);
        return;
      }
      const totalMs = 5 * 60 * 1000;
      const percent = (diff / totalMs) * 100;
      const min = Math.floor(diff / 60000);
      const sec = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ min, sec, percent });
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, items.length]);

  const revalidateCart = React.useCallback(async () => {
    if (!db || items.length === 0 || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsRevalidating(true);
    try {
      const updatedItems: CartItem[] = [];
      let hadChanges = false;
      const eventCache: Record<string, any> = {};
      for (const item of items) {
        try {
          if (!eventCache[item.eventId]) {
            const eSnap = await getDoc(doc(db, "events", item.eventId));
            if (eSnap.exists()) eventCache[item.eventId] = eSnap.data();
          }
          const eventData = eventCache[item.eventId];
          if (!eventData || eventData.status !== 'Ativo') {
            hadChanges = true; continue; 
          }
          const batch = eventData.batches?.find((b: any) => b.id === item.batchId);
          const type = batch?.ticketTypes?.find((t: any) => t.id === item.ticketTypeId);
          if (!batch || !type || type.quantity <= 0) {
            hadChanges = true; continue;
          }
          if (type.price !== (item.originalPrice || item.price)) {
            hadChanges = true;
            updatedItems.push({ ...item, originalPrice: type.price, price: item.couponCode ? item.price : type.price });
          } else {
            updatedItems.push(item);
          }
        } catch (e) { updatedItems.push(item); }
      }
      if (hadChanges) {
        setItems(updatedItems);
        toast({ title: "Carrinho Atualizado", description: "Ajustamos disponibilidade com base no estoque real." });
      }
    } catch (err) { console.error(err); } finally {
      setIsRevalidating(false); isProcessingRef.current = false;
    }
  }, [db, items, setItems]);

  React.useEffect(() => {
    revalidateCart();
    const handleFocus = () => revalidateCart();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [revalidateCart]);

  React.useEffect(() => {
    if (!db || items.length === 0) return;
    const fetchData = async () => {
      const orgIds = Array.from(new Set(items.map(i => i.organizationId)))
      const results: Record<string, any> = {}
      for (const id of orgIds) {
        try {
          const snap = await getDoc(doc(db, "organizations", id))
          if (snap.exists()) results[id] = snap.data()
        } catch (e) {}
      }
      setOrgsData(results)
    }
    fetchData()
  }, [db, items]);

  const handleApplyCoupon = async (cartItemId: string) => {
    const code = couponInputs[cartItemId]?.trim().toUpperCase();
    if (!code || !db) return;

    const item = items.find(i => i.id === cartItemId);
    if (!item) return;

    setApplyingCoupon(cartItemId);
    try {
      const q = query(collection(db, "coupons"), where("code", "==", code), limit(1));
      const snap = await getDocs(q);

      if (snap.empty) throw new Error("Cupom não encontrado.");
      
      const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;

      if (coupon.status !== 'Ativo') throw new Error("Este cupom não está mais ativo.");
      if (coupon.eventId !== item.eventId) throw new Error("Este cupom não pertence a este evento.");
      if (coupon.maxUses > 0 && coupon.currentUses >= coupon.maxUses) throw new Error("Limite de usos do cupom atingido.");
      
      const now = new Date();
      if (coupon.validFrom && now < new Date(coupon.validFrom)) throw new Error("Cupom ainda não está disponível.");
      if (coupon.validUntil && now > new Date(coupon.validUntil)) throw new Error("Este cupom expirou.");

      let discountAmount = 0;
      if (coupon.discountType === 'percentage') {
        discountAmount = (item.originalPrice || item.price) * (coupon.discountValue / 100);
      } else if (coupon.discountType === 'fixed') {
        discountAmount = coupon.discountValue;
      } else if (coupon.discountType === 'free_ticket') {
        discountAmount = (item.originalPrice || item.price);
      }

      const newPrice = Math.max(0, (item.originalPrice || item.price) - discountAmount);

      const updatedItems = items.map(i => i.id === cartItemId ? {
        ...i,
        price: newPrice,
        couponCode: code,
        discountAmount: discountAmount
      } : i);

      setItems(updatedItems);
      toast({ title: "Cupom Aplicado!", description: `Desconto de ${coupon.discountType === 'percentage' ? coupon.discountValue + '%' : formatCurrency(discountAmount)} aplicado.` });
      setCouponInputs(prev => ({ ...prev, [cartItemId]: "" }));
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro no Cupom", description: e.message });
    } finally {
      setApplyingCoupon(null);
    }
  };

  const handleRemoveCoupon = (cartItemId: string) => {
    const updatedItems = items.map(i => i.id === cartItemId ? {
      ...i,
      price: i.originalPrice || i.price,
      couponCode: null,
      discountAmount: 0
    } : i);
    setItems(updatedItems);
    toast({ title: "Cupom Removido" });
  };

  const cartTotals = React.useMemo(() => {
    let subtotal = 0; let fees = 0;
    items.forEach(item => { 
      subtotal += item.price * item.quantity;
      const res = calculateFinancialBreakdown(item.price, globalFees, promotions, orgsData[item.organizationId]);
      fees += res.administrativeFeeAmount * item.quantity;
    });
    const totalBeforeBalance = Number((subtotal + fees).toFixed(2));
    const walletBalance = wallet?.balance || 0;
    const balanceUsed = useBalance ? Math.min(walletBalance, totalBeforeBalance) : 0;
    return { subtotal, fees, balanceUsed, total: Number((totalBeforeBalance - balanceUsed).toFixed(2)) };
  }, [items, globalFees, promotions, orgsData, useBalance, wallet?.balance]);

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-6 md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
           <h1 className="text-4xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
             <ShoppingCart className="w-10 h-10 text-secondary" /> Carrinho
           </h1>
           <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest ml-1">Itens revalidados em tempo real</p>
        </div>
        <Button variant="ghost" className="text-destructive font-black uppercase text-[10px] tracking-widest h-10 px-6 hover:bg-destructive/5 rounded-xl" onClick={clearCart}>
           Esvaziar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
           {items.length === 0 ? (
             <Card className="border-none shadow-sm rounded-[2rem] bg-white p-20 text-center flex flex-col items-center gap-6">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                   <Inbox className="w-10 h-10 text-muted-foreground opacity-20" />
                </div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary">Seu carrinho está vazio</h2>
                <Button asChild className="bg-secondary text-white font-black rounded-xl h-12 px-8 uppercase italic"><Link href="/dashboard">Explorar Eventos</Link></Button>
             </Card>
           ) : (
             <>
               {timeLeft && (
                 <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                    <CardContent className="p-6">
                       <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                             <div className={cn("p-2 rounded-xl", timeLeft.min < 1 ? "bg-red-100 text-red-600" : "bg-secondary/10 text-secondary")}>
                                <Timer className={cn("w-4 h-4", timeLeft.min < 1 && "animate-pulse")} />
                             </div>
                             <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Expiração</p>
                                <p className={cn("text-xs font-black uppercase italic", timeLeft.min < 1 ? "text-red-600" : "text-primary")}>
                                  {timeLeft.min.toString().padStart(2, '0')}:{timeLeft.sec.toString().padStart(2, '0')}
                                </p>
                             </div>
                          </div>
                       </div>
                       <Progress value={timeLeft.percent} className={cn("h-1.5", timeLeft.min < 1 ? "bg-red-100" : "bg-muted")} />
                    </CardContent>
                 </Card>
               )}

               <div className="space-y-6">
                  {items.map((item) => {
                    const res = calculateFinancialBreakdown(item.price, globalFees, promotions, orgsData[item.organizationId]);
                    return (
                      <Card key={item.id} className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white group hover:shadow-md transition-all">
                         <div className="flex flex-col sm:flex-row">
                            <div className="relative w-full sm:w-56 h-48 bg-muted">
                               <Image src={item.eventImage || "https://picsum.photos/seed/event/400/300"} alt={item.eventTitle} fill className="object-cover group-hover:scale-105 transition-transform duration-700" unoptimized />
                            </div>
                            <CardContent className="p-6 flex-1 flex flex-col justify-between">
                               <div className="flex justify-between items-start gap-4">
                                  <div className="space-y-1">
                                     <div className="flex items-center gap-2 mb-1">
                                        <Badge className="bg-secondary text-white border-none text-[8px] font-black uppercase h-5">{item.batchName}</Badge>
                                     </div>
                                     <h3 className="font-black text-xl uppercase italic tracking-tighter text-primary leading-none group-hover:text-secondary transition-colors">{item.eventTitle}</h3>
                                     <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{item.ticketTypeName}</p>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-red-50 rounded-full" onClick={() => removeItem(item.id)}>
                                     <Trash2 className="w-4 h-4" />
                                  </Button>
                               </div>

                               <div className="mt-4 pt-4 border-t border-dashed space-y-4">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                     <div className="flex items-center gap-4 bg-muted/30 p-1.5 rounded-2xl border w-fit">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl hover:bg-white" onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}><Minus className="w-3 i-3" /></Button>
                                        <span className="font-black text-sm w-6 text-center">{item.quantity}</span>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl hover:bg-white" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus className="w-3 i-3" /></Button>
                                     </div>
                                     <div className="text-right">
                                        {item.couponCode && (
                                           <p className="text-[10px] font-bold text-muted-foreground line-through uppercase">{formatCurrency((item.originalPrice || item.price) * item.quantity)}</p>
                                        )}
                                        <p className="text-2xl font-black text-primary italic tracking-tighter">{formatCurrency(res.customerFinalPrice * item.quantity)}</p>
                                     </div>
                                  </div>

                                  <div className="bg-muted/10 rounded-2xl border-2 border-dashed p-4 transition-all">
                                     {item.couponCode ? (
                                        <div className="flex items-center justify-between animate-in zoom-in-95">
                                           <div className="flex items-center gap-2">
                                              <div className="p-2 bg-green-50 rounded-xl text-green-600"><TicketPercent className="w-4 h-4" /></div>
                                              <div className="space-y-0.5">
                                                 <p className="text-[9px] font-black uppercase text-green-700">Cupom Aplicado: {item.couponCode}</p>
                                                 <p className="text-[8px] font-bold text-green-600 uppercase">-{formatCurrency((item.discountAmount || 0) * item.quantity)} de desconto</p>
                                              </div>
                                           </div>
                                           <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-full" onClick={() => handleRemoveCoupon(item.id)}>
                                              <X className="w-4 h-4" />
                                           </Button>
                                        </div>
                                     ) : (
                                        <div className="flex gap-2">
                                           <div className="relative flex-1">
                                              <TicketPercent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-40" />
                                              <Input 
                                                placeholder="CÓDIGO PROMOCIONAL" 
                                                value={couponInputs[item.id] || ""}
                                                onChange={e => setCouponInputs(prev => ({...prev, [item.id]: e.target.value.toUpperCase()}))}
                                                className="h-10 pl-9 rounded-xl text-[10px] font-black uppercase border-none focus-visible:ring-secondary/20"
                                              />
                                           </div>
                                           <Button 
                                             variant="secondary" 
                                             className="h-10 rounded-xl px-4 text-[9px] font-black uppercase italic"
                                             disabled={applyingCoupon === item.id || !couponInputs[item.id]}
                                             onClick={() => handleApplyCoupon(item.id)}
                                           >
                                              {applyingCoupon === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Aplicar"}
                                           </Button>
                                        </div>
                                     )}
                                  </div>
                               </div>
                            </CardContent>
                         </div>
                      </Card>
                    );
                  })}
               </div>
             </>
           )}
        </div>

        {items.length > 0 && (
          <div className="lg:col-span-4 space-y-6">
             <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary text-white overflow-hidden relative">
                <CardContent className="p-8 space-y-6 relative z-10">
                   <div className="flex justify-between items-center">
                      <div className="space-y-1">
                         <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Saldo Carteira</p>
                         <p className="text-2xl font-black italic tracking-tighter">{formatCurrency(wallet?.balance || 0)}</p>
                      </div>
                      <Switch checked={useBalance} onCheckedChange={setUseBalance} disabled={(wallet?.balance || 0) <= 0} className="data-[state=checked]:bg-secondary" />
                   </div>
                </CardContent>
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
             </Card>

             <Card className="border-none shadow-2xl rounded-[3rem] bg-white border-t-[12px] border-secondary">
                <CardHeader className="pb-2">
                   <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">Resumo</CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                   <div className="space-y-4">
                      <div className="flex justify-between text-[11px] font-bold uppercase opacity-40">
                         <span>Total Bruto</span>
                         <span>{formatCurrency(cartTotals.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold uppercase opacity-40">
                         <span>Taxa de Serviço</span>
                         <span>{formatCurrency(cartTotals.fees)}</span>
                      </div>
                      {cartTotals.balanceUsed > 0 && (
                        <div className="flex justify-between text-[11px] font-black uppercase text-secondary">
                           <span className="flex items-center gap-1.5"><Wallet className="w-3 h-3" /> Saldo Usado</span>
                           <span>-{formatCurrency(cartTotals.balanceUsed)}</span>
                        </div>
                      )}
                      <Separator className="bg-border/60 border-dashed" />
                      <div className="flex justify-between items-center py-2">
                         <span className="text-xl font-black uppercase italic tracking-tighter">Total</span>
                         <span className="text-4xl font-black text-primary italic tracking-tighter">{formatCurrency(cartTotals.total)}</span>
                      </div>
                   </div>

                   <PayButton 
                     items={items} 
                     totals={cartTotals} 
                     profile={{ ...profile, id: user?.uid }} 
                     orgsData={orgsData} 
                     globalFees={globalFees} 
                     promotions={promotions} 
                     useBalance={useBalance} 
                     onSuccess={clearCart} 
                     disabled={isRevalidating} 
                   />
                </CardContent>
             </Card>

             <div className="p-6 bg-muted/30 rounded-[2rem] border-2 border-dashed border-border flex items-start gap-4">
                <ShieldCheck className="w-6 h-6 text-muted-foreground opacity-30 shrink-0 mt-0.5" />
                <div className="space-y-1">
                   <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Segurança VIBY</h4>
                   <p className="text-[9px] text-muted-foreground font-medium leading-relaxed uppercase">O carrinho não reserva vagas no estoque. Cupons aplicados são validados novamente no processamento do pagamento.</p>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  )
}