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
  Timer,
  TicketPercent,
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

  const handleApplyCoupon = async (cartItemId: string) => {
    const code = couponInputs[cartItemId]?.trim().toUpperCase();
    if (!code || !db) return;
    setApplyingCoupon(cartItemId);
    try {
      const q = query(collection(db, "coupons"), where("code", "==", code), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) throw new Error("Cupom não encontrado.");
      toast({ title: "Cupom Aplicado!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro no Cupom", description: e.message });
    } finally {
      setApplyingCoupon(null);
    }
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
      <div className="flex flex-col gap-6 md:flex-row md:items-end justify-between">
        <h1 className="text-4xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <ShoppingCart className="w-10 h-10 text-secondary" /> Carrinho
        </h1>
        <Button variant="ghost" onClick={clearCart}>Esvaziar</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
           {items.length === 0 ? (
             <Card className="border-none shadow-sm rounded-[2rem] bg-white p-20 text-center">
                <Inbox className="w-10 h-10 mx-auto opacity-20 mb-4" />
                <h2 className="text-xl font-black uppercase">Seu carrinho está vazio</h2>
                <Button asChild className="mt-4"><Link href="/dashboard">Explorar Eventos</Link></Button>
             </Card>
           ) : (
             <div className="space-y-6">
                {items.map((item) => (
                  <Card key={item.id} className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
                     <div className="flex flex-col sm:flex-row">
                        <div className="relative w-full sm:w-56 h-48 bg-muted">
                           <Image src={item.eventImage || "https://picsum.photos/seed/event/400/300"} alt={item.eventTitle} fill className="object-cover" unoptimized />
                        </div>
                        <CardContent className="p-6 flex-1 flex flex-col justify-between">
                           <div className="flex justify-between items-start">
                              <div>
                                 <h3 className="font-black text-xl uppercase italic text-primary">{item.eventTitle}</h3>
                                 <p className="text-[10px] font-bold text-muted-foreground uppercase">{item.ticketTypeName}</p>
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}><Trash2 className="w-4 h-4" /></Button>
                           </div>
                           <div className="flex items-center justify-between mt-4">
                              <div className="flex items-center gap-3 bg-muted p-1 rounded-xl">
                                 <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</Button>
                                 <span className="font-bold text-sm">{item.quantity}</span>
                                 <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</Button>
                              </div>
                              <p className="font-black text-lg">{formatCurrency(item.price * item.quantity)}</p>
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
             <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary text-white p-8">
                <div className="flex justify-between items-center">
                   <p className="text-[10px] font-black uppercase opacity-40">Saldo Carteira</p>
                   <p className="text-xl font-black italic">{formatCurrency(wallet?.balance || 0)}</p>
                </div>
             </Card>

             <Card className="border-none shadow-2xl rounded-[3rem] bg-white p-8 space-y-8">
                <div className="space-y-4">
                   <div className="flex justify-between text-xs opacity-60"><span>Subtotal</span><span>{formatCurrency(cartTotals.subtotal)}</span></div>
                   <div className="flex justify-between text-xs opacity-60"><span>Taxas</span><span>{formatCurrency(cartTotals.fees)}</span></div>
                   <Separator className="border-dashed" />
                   <div className="flex justify-between items-center"><span className="text-xl font-black italic uppercase">Total</span><span className="text-3xl font-black text-primary">{formatCurrency(cartTotals.total)}</span></div>
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
             </Card>
          </div>
        )}
      </div>
    </div>
  )
}
