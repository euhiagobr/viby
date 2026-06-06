"use client"

import * as React from "react"
import { useCart, CartItem } from "@/contexts/CartContext"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc, getDoc } from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Loader2,
  Inbox,
  AlertTriangle,
  Info
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { calculateFinancialBreakdown } from "@/lib/financial-utils"
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

  const isProcessingRef = React.useRef(false)

  const walletRef = React.useMemo(() => (db && user) ? doc(db, "wallets", user.uid) : null, [db, user]);
  const { data: wallet } = useDoc<any>(walletRef);

  const profileRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user]);
  const { data: profile } = useDoc<any>(profileRef);

  const feesRef = React.useMemo(() => db ? doc(db, 'settings', 'fees') : null, [db])
  const { data: globalFees, loading: feesLoading } = useDoc<any>(feesRef)
  
  const promosRef = React.useMemo(() => db ? doc(db, 'settings', 'promotions') : null, [db])
  const { data: promotions } = useDoc<any>(promosRef)

  // Detecção de Conflito de Moeda
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
      for (const item of items) {
        const eSnap = await getDoc(doc(db, "events", item.eventId));
        if (eSnap.exists() && eSnap.data().status === 'Ativo') {
          updatedItems.push(item);
        } else {
          hadChanges = true;
        }
      }
      if (hadChanges) {
        setItems(updatedItems);
        toast({ title: "Carrinho Atualizado" });
      }
    } catch (err) { console.error(err); } finally {
      setIsRevalidating(false); isProcessingRef.current = false;
    }
  }, [db, items, setItems]);

  React.useEffect(() => {
    revalidateCart();
  }, [revalidateCart]);

  React.useEffect(() => {
    if (!db || items.length === 0) return;
    const fetchData = async () => {
      const orgIds = Array.from(new Set(items.map(i => i.organizationId)))
      const results: Record<string, any> = {}
      for (const id of orgIds) {
        const snap = await getDoc(doc(db, "organizations", id))
        if (snap.exists()) results[id] = snap.data()
      }
      setOrgsData(results)
    }
    fetchData()
  }, [db, items]);

  const cartTotals = React.useMemo(() => {
    if (!items || items.length === 0) return { subtotal: 0, fees: 0, balanceUsed: 0, total: 0, currency: 'BRL' };

    // Se houver conflito, calculamos apenas para a moeda do PRIMEIRO item para exibição no resumo
    const primaryCurrency = items[0].currency || 'BRL';
    const filteredItems = items.filter(i => (i.currency || 'BRL') === primaryCurrency);

    let subtotal = 0;
    let fees = 0;
    
    filteredItems.forEach(item => { 
      const itemSubtotal = (item.price || 0) * (item.quantity || 0);
      subtotal += itemSubtotal;
      
      const org = orgsData?.[item.organizationId];
      if (org && globalFees) {
        const res = calculateFinancialBreakdown(item.price, globalFees, promotions, org, primaryCurrency as CurrencyCode, rates);
        fees += (res?.administrativeFeeAmount || 0) * (item.quantity || 0);
      }
    });

    const totalBeforeBalance = Number((subtotal + fees).toFixed(2));
    const walletBalance = wallet?.balance || 0;
    
    // Saldo da carteira só pode ser usado se a moeda principal for BRL
    const balanceUsed = (useBalance && primaryCurrency === 'BRL') ? Math.min(walletBalance, totalBeforeBalance) : 0;
    const finalTotal = Math.max(0, Number((totalBeforeBalance - balanceUsed).toFixed(2)));

    return { 
      subtotal, 
      fees, 
      balanceUsed, 
      total: finalTotal,
      currency: primaryCurrency
    };
  }, [items, globalFees, promotions, orgsData, useBalance, wallet?.balance, rates]);

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
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
                 Seu carrinho possui itens em moedas diferentes. O checkout está temporariamente bloqueado. 
                 Remova os itens divergentes para prosseguir com o pagamento.
               </AlertDescription>
             </Alert>
           )}

           {items.length === 0 ? (
             <Card className="border-none shadow-sm rounded-[2rem] bg-white p-20 text-center">
                <Inbox className="w-10 h-10 mx-auto opacity-20 mb-4" />
                <h2 className="text-xl font-black uppercase">Seu carrinho está vazio</h2>
                <Button asChild className="mt-4"><Link href="/dashboard">Explorar Eventos</Link></Button>
             </Card>
           ) : (
             <div className="space-y-6">
                {items.map((item) => (
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
                                 <h3 className="font-black text-xl uppercase italic text-primary">{item.eventTitle}</h3>
                                 <p className="text-[10px] font-bold text-muted-foreground uppercase">{item.ticketTypeName}</p>
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></Button>
                           </div>
                           <div className="flex items-center justify-between mt-4">
                              <div className="flex items-center gap-3 bg-muted p-1 rounded-xl">
                                 <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</Button>
                                 <span className="font-bold text-sm">{item.quantity}</span>
                                 <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</Button>
                              </div>
                              <p className="font-black text-lg">{formatPrice(item.price * item.quantity, (item.currency || 'BRL') as CurrencyCode)}</p>
                           </div>
                        </CardContent>
                     </div>
                  </Card>
                ))}
             </div>
           )}
        </div>

        {items.length > 0 && (
          <div className="lg:col-span-4 space-y-6">
             <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary text-white p-8 relative overflow-hidden">
                <div className="relative z-10">
                   <p className="text-[10px] font-black uppercase opacity-40">Seu Saldo</p>
                   <p className="text-2xl font-black italic">{formatPrice(wallet?.balance || 0, 'BRL')}</p>
                </div>
                <div className="absolute -bottom-4 -right-4 opacity-5"><Info className="w-20 h-20" /></div>
             </Card>

             <Card className="border-none shadow-2xl rounded-[3rem] bg-white p-8 space-y-8">
                <div className="space-y-4">
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resumo ({cartTotals.currency})</p>
                   <div className="flex justify-between text-xs opacity-60 font-bold uppercase">
                      <span>Subtotal</span>
                      <span>{formatPrice(cartTotals.subtotal, cartTotals.currency as CurrencyCode)}</span>
                   </div>
                   <div className="flex justify-between text-xs opacity-60 font-bold uppercase">
                      <span>Taxas</span>
                      <span>{formatPrice(cartTotals.fees, cartTotals.currency as CurrencyCode)}</span>
                   </div>
                   <Separator className="border-dashed" />
                   <div className="flex justify-between items-center">
                      <span className="text-xl font-black italic uppercase">Total</span>
                      <span className="text-3xl font-black text-primary">{formatPrice(cartTotals.total, cartTotals.currency as CurrencyCode)}</span>
                   </div>
                </div>

                {hasCurrencyConflict && (
                   <div className="p-4 bg-red-50 rounded-2xl flex gap-3 border border-red-100 animate-in zoom-in-95">
                      <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                      <p className="text-[9px] text-destructive font-black uppercase leading-relaxed italic">
                         Checkout desabilitado. O carrinho contém itens em moedas divergentes da principal ({cartTotals.currency}).
                      </p>
                   </div>
                )}

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
                />
             </Card>
          </div>
        )}
      </div>
    </div>
  )
}
