
'use client';

import * as React from "react"
import { useCart, CartItem } from "@/contexts/CartContext"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Loader2,
  Inbox,
  AlertTriangle,
  Info,
  Clock,
  ShieldCheck,
  TicketPercent,
  CheckCircle2,
  X,
  UserCheck,
  Tag
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { calculateVibyOfficialSplit, toCents, calculateFinancialBreakdown, ProductType } from "@/lib/financial-utils"
import { PayButton } from "@/components/payments/PayButton"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"

export default function CarrinhoPage() {
  const { items, removeItem, updateQuantity, clearCart, expiresAt, setItems } = useCart()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { formatPrice, rates } = useCurrency()
  
  const [useBalance, setUseBalance] = React.useState(false)
  const [orgsData, setOrgsData] = React.useState<Record<string, any>>({})
  const [isRevalidating, setIsRevalidating] = React.useState(false)
  const [timeLeft, setTimeLeft] = React.useState<{ min: number, sec: number, percent: number } | null>(null)

  // Estados para Cupons
  const [couponInput, setCouponCode] = React.useState("")
  const [appliedCoupon, setAppliedCoupon] = React.useState<any>(null)
  const [isValidatingCoupon, setIsValidatingCoupon] = React.useState(false)

  const isProcessingRef = React.useRef(false)

  const walletRef = React.useMemo(() => (db && user) ? doc(db, "wallets", user.uid) : null, [db, user]);
  const { data: wallet } = useDoc<any>(walletRef);

  const profileRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user]);
  const { data: profile } = useDoc<any>(profileRef);

  const feesRef = React.useMemo(() => db ? doc(db, 'settings', 'fees') : null, [db])
  const { data: globalFees, loading: feesLoading } = useDoc<any>(feesRef)
  
  const promosRef = React.useMemo(() => db ? doc(db, 'settings', 'promotions') : null, [db])
  const { data: promotions } = useDoc<any>(promosRef)

  const hasCurrencyConflict = React.useMemo(() => {
    if (items.length <= 1) return false;
    const firstCurrency = items[0].currency || 'BRL';
    return items.some(item => (item.currency || 'BRL') !== firstCurrency);
  }, [items]);

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
      const totalMs = 10 * 60 * 1000;
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
      
      for (const item of items) {
        try {
          const coll = item.productType === 'experience' ? 'experiences' : 'events';
          const eSnap = await getDoc(doc(db, coll, item.eventId));
          if (eSnap.exists()) {
            const eData = eSnap.data();
            if (eData.status !== 'Excluído' && eData.status !== 'Oculto') {
              updatedItems.push(item);
            } else {
              hadChanges = true;
            }
          } else {
            hadChanges = true;
          }
        } catch (e) {
          updatedItems.push(item);
        }
      }
      
      if (hadChanges) {
        setItems(updatedItems);
        toast({ 
          variant: "destructive",
          title: "Carrinho Atualizado", 
          description: "Alguns itens não estão mais disponíveis e foram removidos." 
        });
      }
    } catch (err) {
      console.error("[Cart] Revalidation error:", err);
    } finally {
      setIsRevalidating(false);
      isProcessingRef.current = false;
    }
  }, [db, items, setItems]);

  React.useEffect(() => {
    if (items.length > 0 && db) {
      revalidateCart();
    }
  }, [db, revalidateCart, items.length]); 

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
  }, [db, items.length]);

  const handleApplyCoupon = async () => {
    if (!db || !couponInput.trim() || isValidatingCoupon) return;

    setIsValidatingCoupon(true);
    const code = couponInput.trim().toUpperCase();
    try {
      // PRIORIDADE: Tenta Cupom de Usuário (Exclusivo)
      const uq = query(
        collection(db, "user_coupons"),
        where("code", "==", code),
        where("status", "==", "active"),
        limit(1)
      );
      const uSnap = await getDocs(uq);

      if (!uSnap.empty) {
        const uCoupon = { id: uSnap.docs[0].id, ...uSnap.docs[0].data() } as any;
        const matchedItem = items.find(i => i.eventId === uCoupon.eventId);
        if (!matchedItem) {
          toast({ variant: "destructive", title: "Restrição de Evento", description: "Este cupom exclusivo é válido apenas para outro evento." });
          return;
        }
        setAppliedCoupon({ ...uCoupon, isUserCoupon: true });
        toast({ title: "Cupom exclusivo aplicado!" });
        return;
      }

      // 2. Tenta Cupom Geral
      const q = query(
        collection(db, "coupons"), 
        where("code", "==", code),
        where("status", "==", "Ativo"),
        limit(1)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
        const matchedItem = items.find(i => i.eventId === coupon.eventId);
        if (!matchedItem) {
          toast({ variant: "destructive", title: "Cupom inválido", description: "Este código não é válido para este evento." });
          return;
        }
        setAppliedCoupon(coupon);
        toast({ title: "Cupom aplicado!" });
        return;
      }

      toast({ variant: "destructive", title: "Cupom inválido", description: "Código não encontrado ou expirado." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na validação" });
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const cartTotals = React.useMemo(() => {
    if (!items || items.length === 0) return { subtotal: 0, fees: 0, balanceUsed: 0, total: 0, discount: 0, currency: 'BRL' };

    const primaryCurrency = items[0].currency || 'BRL';
    const filteredItems = items.filter(i => (i.currency || 'BRL') === primaryCurrency);

    let subtotal = 0;
    let fees = 0;
    let discount = 0;
    
    filteredItems.forEach(item => { 
      subtotal += item.price * item.quantity;
      
      const org = orgsData?.[item.organizationId];
      if (org && globalFees) {
        let discValPerUnit = 0;
        const couponVal = Number(appliedCoupon?.discountValue) || 0;

        if (appliedCoupon && appliedCoupon.eventId === item.eventId) {
          if (appliedCoupon.discountType === 'percentage') {
            discValPerUnit = Number((item.price * (couponVal / 100)).toFixed(2));
          } else if (appliedCoupon.discountType === 'fixed') {
            discValPerUnit = Math.min(item.price, couponVal);
          } else if (appliedCoupon.discountType === 'free_ticket') {
            discValPerUnit = item.price;
          }
        }
        
        // O desconto é por UNIDADE
        discount += discValPerUnit * item.quantity; 
        const discountedUnitPrice = Math.max(0, item.price - discValPerUnit);

        const res = calculateVibyOfficialSplit(
          discountedUnitPrice, 
          primaryCurrency as CurrencyCode, 
          rates, 
          org, 
          globalFees, 
          promotions, 
          (item.productType as ProductType) || 'event'
        );
        
        fees += (res?.buyerFee || 0) * item.quantity;
      }
    });

    const totalBeforeBalance = Number((subtotal + fees - discount).toFixed(2));
    const walletBalance = wallet?.balance || 0;
    
    const balanceUsed = (useBalance && primaryCurrency === 'BRL') ? Math.min(walletBalance, totalBeforeBalance) : 0;
    const finalTotal = Math.max(0, Number((totalBeforeBalance - balanceUsed).toFixed(2)));

    return { 
      subtotal, 
      fees, 
      discount,
      balanceUsed, 
      total: finalTotal,
      currency: primaryCurrency
    };
  }, [items, globalFees, promotions, orgsData, useBalance, wallet?.balance, rates, appliedCoupon]);

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-6 md:flex-row md:items-end justify-between">
        <h1 className="text-4xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <ShoppingCart className="w-10 h-10 text-secondary" /> Carrinho
        </h1>
        <Button variant="ghost" onClick={clearCart}>Esvaziar</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
           {hasCurrencyConflict && (
             <Alert variant="destructive" className="rounded-3xl border-2 shadow-lg bg-red-50">
               <AlertTriangle className="h-5 w-5" />
               <AlertTitle className="font-black uppercase italic">Conflito de Moedas Detectado</AlertTitle>
               <AlertDescription className="font-medium text-xs uppercase leading-relaxed">
                 Seu carrinho possui itens em moedas diferentes. Remova os itens divergentes para prosseguir.
               </AlertDescription>
             </Alert>
           )}

           {items.length === 0 ? (
             <Card className="border-none shadow-sm rounded-[2rem] bg-white p-20 text-center">
                <Inbox className="w-10 h-10 auto opacity-20 mb-4" />
                <h2 className="text-xl font-black uppercase tracking-widest opacity-60">Seu carrinho está vazio</h2>
                <Button asChild className="mt-8 bg-secondary text-white font-black rounded-xl h-12 px-8 uppercase italic"><Link href="/dashboard">Explorar Experiências</Link></Button>
             </Card>
           ) : (
             <div className="space-y-6">
                {items.map((item) => {
                  const isCouponTarget = appliedCoupon && appliedCoupon.eventId === item.eventId;
                  const couponVal = Number(appliedCoupon?.discountValue) || 0;
                  
                  let itemDiscountUnit = 0;
                  if (isCouponTarget) {
                    if (appliedCoupon.discountType === 'percentage') {
                      itemDiscountUnit = Number((item.price * (couponVal / 100)).toFixed(2));
                    } else if (appliedCoupon.discountType === 'fixed') {
                      itemDiscountUnit = Math.min(item.price, couponVal);
                    } else if (appliedCoupon.discountType === 'free_ticket') {
                      itemDiscountUnit = item.price;
                    }
                  }

                  const discountedPrice = Math.max(0, item.price - itemDiscountUnit);

                  return (
                    <Card key={item.id} className={cn(
                      "border-none shadow-sm rounded-[2rem] overflow-hidden bg-white transition-opacity",
                      hasCurrencyConflict && (item.currency || 'BRL') !== cartTotals.currency && "opacity-50 grayscale border-2 border-dashed border-destructive/20"
                    )}>
                      <div className="flex flex-col sm:flex-row">
                          <div className="relative w-full sm:w-56 h-48 bg-muted">
                            <Image src={item.eventImage || "https://picsum.photos/seed/event/400/300"} alt={item.eventTitle} fill className="object-cover" unoptimized />
                            <div className="absolute top-3 left-3">
                                <Badge className="bg-white/90 text-primary font-black text-[10px] uppercase shadow-sm">
                                  {item.currency}
                                </Badge>
                            </div>
                          </div>
                          <CardContent className="p-6 flex-1 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-black text-xl uppercase italic text-primary leading-none">{item.eventTitle}</h3>
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">{item.ticketTypeName}</p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                            <div className="flex items-center justify-between mt-4">
                                <div className="flex items-center gap-3 bg-muted p-1.5 rounded-xl border">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</Button>
                                  <span className="font-bold text-sm w-6 text-center">{item.quantity}</span>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</Button>
                                </div>
                                <div className="text-right">
                                   {isCouponTarget && itemDiscountUnit > 0 ? (
                                     <div className="flex flex-col">
                                        <div className="flex items-center gap-2 justify-end">
                                           <span className="text-[10px] line-through opacity-30 font-black">{formatPrice(item.price * item.quantity, (item.currency || 'BRL') as CurrencyCode)}</span>
                                           <Badge variant="outline" className="text-[8px] font-black uppercase text-green-600 border-green-200">
                                              -{formatPrice(itemDiscountUnit * item.quantity, (item.currency || 'BRL') as CurrencyCode)}
                                           </Badge>
                                        </div>
                                        <p className="font-black text-xl text-primary">{formatPrice(discountedPrice * item.quantity, (item.currency || 'BRL') as CurrencyCode)}</p>
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Valor total da sessão</p>
                                     </div>
                                   ) : (
                                     <p className="font-black text-xl">{formatPrice(item.price * item.quantity, (item.currency || 'BRL') as CurrencyCode)}</p>
                                   )}
                                </div>
                            </div>
                          </CardContent>
                      </div>
                    </Card>
                  );
                })}
             </div>
           )}
        </div>

        {items.length > 0 && (
          <div className="lg:col-span-4 space-y-6">
             {timeLeft && (
               <Card className="border-none shadow-sm rounded-2xl bg-white p-4 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="relative w-10 h-10">
                     <svg className="w-full h-full transform -rotate-90">
                       <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
                       <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="113" strokeDashoffset={113 - (113 * timeLeft.percent / 100)} className={cn("text-secondary circular-timer-progress", timeLeft.percent < 20 && "text-destructive")} />
                     </svg>
                     <Clock className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                   </div>
                   <div className="space-y-0.5">
                     <p className="text-[9px] font-black uppercase text-muted-foreground">Sua reserva expira em</p>
                     <p className="text-sm font-black tabular-nums">{String(timeLeft.min).padStart(2, '0')}:{String(timeLeft.sec).padStart(2, '0')}</p>
                   </div>
                 </div>
                 <Badge variant="outline" className="text-[8px] font-black uppercase border-secondary text-secondary">Hold Ativo</Badge>
               </Card>
             )}

             <Card className="border-none shadow-sm rounded-3xl bg-white p-6 space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Cupom de Desconto</Label>
                <div className="flex gap-2">
                   <div className="relative flex-1">
                      <TicketPercent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary opacity-30" />
                      <Input 
                        placeholder="CÓDIGO" 
                        value={couponInput}
                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                        disabled={!!appliedCoupon}
                        className="pl-10 h-11 rounded-xl border-dashed border-secondary/30 uppercase font-black"
                      />
                      {appliedCoupon && (
                        <button onClick={() => { setAppliedCoupon(null); setCouponCode(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-muted rounded-full hover:bg-red-50 text-red-500">
                           <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                   </div>
                   {!appliedCoupon && (
                     <Button 
                        onClick={handleApplyCoupon} 
                        disabled={isValidatingCoupon || !couponInput.trim()}
                        className="h-11 px-6 rounded-xl bg-secondary text-white font-bold uppercase italic"
                      >
                        {isValidatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "OK"}
                     </Button>
                   )}
                </div>
                {appliedCoupon && (
                   <p className="text-[9px] font-black uppercase text-green-600 flex items-center gap-1.5 animate-in zoom-in-95">
                      {appliedCoupon.isUserCoupon ? <UserCheck className="w-3 h-3" /> : <CheckCircle2 className="w-3.5 h-3.5" />} 
                      {appliedCoupon.isUserCoupon ? "Cupom exclusivo aplicado!" : "Desconto aplicado!"}
                   </p>
                )}
             </Card>

             <Card className="border-none shadow-2xl rounded-[3rem] bg-white p-8 space-y-8">
                <div className="space-y-4">
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resumo ({cartTotals.currency})</p>
                   <div className="flex justify-between text-xs opacity-60 font-bold uppercase">
                      <span>Subtotal</span>
                      <span>{formatPrice(cartTotals.subtotal, cartTotals.currency as CurrencyCode)}</span>
                   </div>
                   {cartTotals.discount > 0 && (
                     <div className="flex justify-between text-xs font-black text-green-600 uppercase">
                        <span>Desconto Total</span>
                        <span>-{formatPrice(cartTotals.discount, cartTotals.currency as CurrencyCode)}</span>
                     </div>
                   )}
                   <div className="flex justify-between text-xs opacity-60 font-bold uppercase">
                      <span>Taxas de Serviço</span>
                      <span>{formatPrice(cartTotals.fees, cartTotals.currency as CurrencyCode)}</span>
                   </div>
                   <Separator className="border-dashed" />
                   <div className="flex justify-between items-center">
                      <span className="text-xl font-black italic uppercase">Total</span>
                      <span className="text-3xl font-black text-primary">{formatPrice(cartTotals.total, cartTotals.currency as CurrencyCode)}</span>
                   </div>
                </div>

                <PayButton 
                  items={items.filter(i => (i.currency || 'BRL') === cartTotals.currency)} 
                  totals={cartTotals} 
                  profile={{ ...profile, id: user?.uid }} 
                  orgsData={orgsData} 
                  globalFees={globalFees} 
                  promotions={promotions} 
                  useBalance={useBalance} 
                  onSuccess={clearCart} 
                  disabled={isRevalidating || feesLoading || hasCurrencyConflict} 
                  className={cn(hasCurrencyConflict && "grayscale opacity-50 cursor-not-allowed")}
                  rates={rates}
                  appliedCoupon={appliedCoupon}
                />
             </Card>
          </div>
        )}
      </div>
    </div>
  )
}
