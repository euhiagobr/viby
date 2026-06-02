"use client"

import * as React from "react"
import { useCart, CartItem } from "@/contexts/CartContext"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc, getDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
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
  RefreshCw
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

  // Ref para evitar loop infinito de revalidação
  const isProcessingRef = React.useRef(false)

  const walletRef = React.useMemo(() => (db && user) ? doc(db, "wallets", user.uid) : null, [db, user]);
  const { data: wallet } = useDoc<any>(walletRef);

  const profileRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user]);
  const { data: profile } = useDoc<any>(profileRef);

  const feesRef = React.useMemo(() => db ? doc(db, 'settings', 'fees') : null, [db])
  const { data: globalFees } = useDoc<any>(feesRef)
  
  const promosRef = React.useMemo(() => db ? doc(db, 'settings', 'promotions') : null, [db])
  const { data: promotions } = useDoc<any>(promosRef)

  // Lógica do Contador Visual (5 minutos)
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

  // Motor de Revalidação de Disponibilidade (Refatorado para evitar loops)
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
            hadChanges = true;
            continue; 
          }

          const batch = eventData.batches?.find((b: any) => b.id === item.batchId);
          const type = batch?.ticketTypes?.find((t: any) => t.id === item.ticketTypeId);

          if (!batch || !type || type.quantity <= 0) {
            hadChanges = true;
            continue;
          }

          if (type.price !== item.price) {
            hadChanges = true;
            updatedItems.push({ ...item, price: type.price });
          } else {
            updatedItems.push(item);
          }
        } catch (e) {
          updatedItems.push(item); // Mantém no carrinho se falhar a verificação técnica
        }
      }

      if (hadChanges) {
        setItems(updatedItems);
        toast({ 
          title: "Carrinho Atualizado", 
          description: "Ajustamos preços ou disponibilidade com base no estoque real." 
        });
      }
    } catch (err) {
      console.error("[Cart Revalidation Error]", err);
    } finally {
      setIsRevalidating(false);
      isProcessingRef.current = false;
    }
  }, [db, items, setItems]);

  // Revalidar ao focar na página ou montar
  React.useEffect(() => {
    revalidateCart();
    const handleFocus = () => revalidateCart();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [revalidateCart]);

  React.useEffect(() => {
    const handleExpired = () => {
      toast({
        variant: "destructive",
        title: "Tempo esgotado",
        description: "Seu carrinho expirou para garantir a disponibilidade dos ingressos para outros usuários."
      });
    };
    window.addEventListener('viby-cart-expired', handleExpired);
    return () => window.removeEventListener('viby-cart-expired', handleExpired);
  }, []);

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

  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mb-4">
           <ShoppingCart className="w-12 h-12 text-muted-foreground opacity-20" />
        </div>
        <div className="text-center space-y-2">
           <h2 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Carrinho Vazio</h2>
           <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Suas experiências aparecerão aqui</p>
        </div>
        <Button asChild className="bg-secondary text-white font-black rounded-full px-12 h-14 uppercase italic shadow-xl hover:scale-105 transition-all">
           <Link href="/dashboard">Explorar Eventos</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
           <h1 className="text-4xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
             <ShoppingCart className="w-10 h-10 text-secondary" /> Carrinho
           </h1>
           <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest ml-1">Itens revalidados em tempo real</p>
        </div>
        <div className="flex items-center gap-3">
           {isRevalidating && <div className="flex items-center gap-2 text-[9px] font-black uppercase text-secondary animate-pulse"><RefreshCw className="w-3 h-3 animate-spin" /> Sincronizando...</div>}
           <Button variant="ghost" className="text-destructive font-black uppercase text-[10px] tracking-widest h-10 px-6 hover:bg-destructive/5 rounded-xl" onClick={clearCart}>
              Esvaziar
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
           {timeLeft && (
             <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                <CardContent className="p-6">
                   <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                         <div className={cn("p-2 rounded-xl transition-colors", timeLeft.min < 1 ? "bg-red-100 text-red-600" : "bg-secondary/10 text-secondary")}>
                            <Timer className={cn("w-4 h-4", timeLeft.min < 1 && "animate-pulse")} />
                         </div>
                         <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Expiração do Carrinho</p>
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

           <div className="space-y-4">
              {items.map((item) => {
                const res = calculateFinancialBreakdown(item.price, globalFees, promotions, orgsData[item.organizationId]);
                return (
                  <Card key={item.id} className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white group hover:shadow-md transition-all">
                     <div className="flex flex-col sm:flex-row">
                        <div className="relative w-full sm:w-56 h-40 bg-muted">
                           <Image src={item.eventImage || "https://picsum.photos/seed/event/400/300"} alt={item.eventTitle} fill className="object-cover group-hover:scale-110 transition-transform duration-700" unoptimized />
                        </div>
                        <CardContent className="p-8 flex-1 flex flex-col justify-between">
                           <div className="flex justify-between items-start gap-4">
                              <div className="space-y-1">
                                 <div className="flex items-center gap-2 mb-1">
                                    <Badge className="bg-secondary text-white border-none text-[8px] font-black uppercase h-5">{item.batchName}</Badge>
                                    {item.requiresProof && <Badge variant="outline" className="text-[8px] font-black uppercase h-5 border-orange-200 text-orange-600">Meia/Social</Badge>}
                                 </div>
                                 <h3 className="font-black text-xl uppercase italic tracking-tighter text-primary leading-none group-hover:text-secondary transition-colors">{item.eventTitle}</h3>
                                 <div className="flex items-center gap-1.5 text-[10px] font-black text-secondary uppercase mt-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(item.eventDate?.seconds * 1000 || item.eventDate).toLocaleDateString('pt-BR')}
                                 </div>
                                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{item.ticketTypeName}</p>
                              </div>
                              <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:bg-red-50 rounded-full" onClick={() => removeItem(item.id)}>
                                 <Trash2 className="w-4 h-4" />
                              </Button>
                           </div>
                           <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-8 pt-4 border-t border-dashed gap-4">
                              <div className="flex items-center gap-4 bg-muted/30 p-1.5 rounded-2xl border border-border/40 w-fit">
                                 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-white shadow-sm" onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}><Minus className="w-3 i-3" /></Button>
                                 <span className="font-black text-sm w-6 text-center">{item.quantity}</span>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-white shadow-sm" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus className="w-3 i-3" /></Button>
                              </div>
                              <div className="text-right">
                                 <p className="text-[9px] font-black text-muted-foreground uppercase opacity-40 mb-0.5">Subtotal Item</p>
                                 <p className="text-2xl font-black text-primary italic tracking-tighter">{formatCurrency(res.customerFinalPrice * item.quantity)}</p>
                              </div>
                           </div>
                        </CardContent>
                     </div>
                  </Card>
                );
              })}
           </div>
        </div>

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
                 <CardTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-2">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                 <div className="space-y-4">
                    <div className="flex justify-between text-[11px] font-bold uppercase opacity-40">
                       <span>Itens ({items.length})</span>
                       <span>{formatCurrency(cartTotals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold uppercase opacity-40">
                       <span>Serviço</span>
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

                 <PayButton items={items} totals={cartTotals} profile={{ ...profile, id: user?.uid }} orgsData={orgsData} globalFees={globalFees} promotions={promotions} useBalance={useBalance} onSuccess={clearCart} disabled={isRevalidating} />
              </CardContent>
           </Card>

           <div className="p-6 bg-muted/30 rounded-[2rem] border-2 border-dashed border-border flex items-start gap-4">
              <ShieldCheck className="w-6 h-6 text-muted-foreground opacity-30 shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Garantia de Vaga</h4>
                 <p className="text-[9px] text-muted-foreground font-medium leading-relaxed uppercase">O carrinho não reserva vagas no estoque. Sua vaga é confirmada apenas após a aprovação do pagamento.</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
