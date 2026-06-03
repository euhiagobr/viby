
'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit,
  collectionGroup,
  doc
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Wallet, 
  TrendingUp, 
  Loader2,
  ShieldCheck,
  History,
  Coins,
  RefreshCw,
  Clock,
  CheckCircle2,
  Ticket,
  Info,
  Zap,
  Search,
  Landmark,
  TicketPercent,
  X,
  Inbox,
  CreditCard
} from 'lucide-react';
import { formatCurrency, calculateFinancialBreakdown } from '@/lib/financial-utils';
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { createAdBalanceTopUpSession, finalizeAdTopUpSession } from '@/app/actions/stripe';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSearchParams, useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

function OrganizationFinanceContent() {
  const { currentOrg, userRole, refreshOrg, loading: orgLoading } = useCurrentOrganization();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [topUpAmount, setTopUpAmount] = React.useState<string>("50.00");
  const [couponCode, setCouponCode] = React.useState("");
  const [appliedCoupon, setAppliedCoupon] = React.useState<any>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = React.useState(false);
  const [isTopUpLoading, setIsTopUpLoading] = React.useState(false);
  const [salesSearch, setSalesSearch] = React.useState("");
  const [isProcessingSession, setIsProcessingSession] = React.useState(false);

  const sessionId = searchParams.get('session_id');

  React.useEffect(() => {
    if (!sessionId || isProcessingSession || !currentOrg) return;

    const completeTopUp = async () => {
      setIsProcessingSession(true);
      try {
        const result = await finalizeAdTopUpSession(sessionId);
        if (result.success) {
          toast({ title: "Saldo Recarregado!", description: "Seu crédito já está disponível para uso." });
          await refreshOrg();
          const newParams = new URLSearchParams(searchParams.toString());
          newParams.delete('session_id');
          newParams.delete('success');
          router.replace(`${window.location.pathname}?${newParams.toString()}`);
        }
      } catch (e) {
        console.error("[Finance] Error finalizing top-up:", e);
      } finally {
        setIsProcessingSession(false);
      }
    };

    completeTopUp();
  }, [sessionId, currentOrg, refreshOrg, router, searchParams]);

  const salesQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return query(collection(db, "registrations"), where("organizationId", "==", currentOrg.id));
  }, [db, currentOrg?.id]);
  const { data: rawSales, loading: salesLoading } = useCollection<any>(salesQuery);

  const isConnectActive = currentOrg?.stripePayoutsEnabled && currentOrg?.stripeChargesEnabled;

  const sales = React.useMemo(() => {
    if (!rawSales) return [];
    return rawSales
      .filter((r: any) => ["Pago", "Disponível", "Cancelado"].includes(r.paymentStatus))
      .filter((r: any) => {
        const s = salesSearch.toLowerCase();
        return r.eventTitle?.toLowerCase().includes(s) || r.userName?.toLowerCase().includes(s) || r.ticketCode?.toLowerCase().includes(s);
      })
      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
  }, [rawSales, salesSearch]);

  const handleValidateCoupon = async () => {
    if (!db || !user || !couponCode.trim()) return;
    setIsValidatingCoupon(true);
    try {
      const q = query(
        collection(db, "ad_coupons"), 
        where("code", "==", couponCode.trim().toUpperCase()),
        where("status", "==", "active"),
        limit(1)
      );
      const snap = await getDocs(q);
      
      if (snap.empty) {
        throw new Error("Código não encontrado ou expirado.");
      }

      const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
      const now = new Date();
      const start = data.startAt?.toDate ? data.startAt.toDate() : new Date(data.startAt);
      const end = data.endAt?.toDate ? data.endAt.toDate() : new Date(data.endAt);
      
      const amount = parseFloat(topUpAmount);

      if (amount < (data.minRecharge || 0)) {
         throw new Error(`Este cupom exige recarga mínima de ${formatCurrency(data.minRecharge)}`);
      }
      if (data.maxRecharge && amount > data.maxRecharge) {
         throw new Error(`Este cupom é válido para recargas de até ${formatCurrency(data.maxRecharge)}`);
      }
      if (now < start || now > end) {
         throw new Error("Este cupom não está vigente para a data atual.");
      }

      if (data.maxTotalUses > 0 && data.currentUses >= data.maxTotalUses) {
         throw new Error("Este cupom atingiu o limite máximo de utilizações.");
      }

      if (data.maxUsesPerUser > 0) {
        const usagesQuery = query(
           collectionGroup(db, 'transactions'),
           where('userId', '==', user.uid),
           where('couponCode', '==', data.code),
           where('status', '==', 'completed')
        );
        const usagesSnap = await getDocs(usagesQuery);
        if (usagesSnap.size >= data.maxUsesPerUser) {
           throw new Error(`Você já atingiu o limite de ${data.maxUsesPerUser} uso(s) para este cupom.`);
        }
      }

      setAppliedCoupon(data);
      toast({ title: "Cupom Aplicado!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro no Cupom", description: e.message });
      setAppliedCoupon(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const rechargeCalcs = React.useMemo(() => {
    const base = parseFloat(topUpAmount) || 0;
    const fee = base * 0.05;
    let totalToPay = base + fee;
    let finalBalance = base;

    if (appliedCoupon) {
       const val = appliedCoupon.value || 0;
       if (appliedCoupon.type === 'discount') {
          totalToPay -= (totalToPay * (val / 100));
       } else if (appliedCoupon.type === 'bonus_percent') {
          finalBalance += (base * (val / 100));
       } else if (appliedCoupon.type === 'bonus_fixed') {
          finalBalance += val;
       }
    }

    return { base, fee, totalToPay, finalBalance };
  }, [topUpAmount, appliedCoupon]);

  const handleTopUp = async () => {
    if (!currentOrg || !user || !db) return;
    if (rechargeCalcs.base < 10) {
      toast({ variant: "destructive", title: "Valor mínimo", description: "O valor mínimo para recarga é R$ 10,00." });
      return;
    }
    setIsTopUpLoading(true);
    try {
      const result = await createAdBalanceTopUpSession({ 
        orgId: currentOrg.id, 
        orgUsername: currentOrg.username,
        orgName: currentOrg.name, 
        userEmail: user.email!, 
        baseAmount: rechargeCalcs.base, 
        finalBalance: rechargeCalcs.finalBalance,
        totalToPay: rechargeCalcs.totalToPay,
        couponCode: appliedCoupon?.code,
        transactionId: crypto.randomUUID() 
      });
      if (result.url) window.location.href = result.url;
    } catch (e) { 
      toast({ variant: "destructive", title: "Erro no Checkout" }); 
    } finally { 
      setIsTopUpLoading(false); 
    }
  };

  if (orgLoading || isProcessingSession) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse text-muted-foreground">
          Sincronizando finanças...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Wallet className="w-8 h-8 text-secondary" /> Finanças da Marca
        </h1>
        <p className="text-muted-foreground font-medium">Gestão de saldo Ads e extrato para <strong>{currentOrg?.name}</strong>.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className={cn("border-none shadow-sm overflow-hidden relative border-l-4", isConnectActive ? "border-green-500 bg-white" : "border-orange-500 bg-orange-50")}>
           <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Status de Repasse</CardTitle></CardHeader>
           <CardContent className="space-y-3 relative z-10">
              <div className="flex items-center gap-2">
                 <div className={cn("w-2 h-2 rounded-full", isConnectActive ? "bg-green-500" : "bg-orange-500 animate-pulse")} />
                 <span className="text-xs font-black uppercase">{isConnectActive ? "Ativo (Stripe Connect)" : "Ação Necessária"}</span>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full rounded-xl text-[9px] font-black uppercase h-9 border-secondary text-secondary">
                 <Link href="/dashboard/financeiro">{isConnectActive ? "Gerenciar Conta" : "Configurar Agora"}</Link>
              </Button>
           </CardContent>
           <Landmark className="absolute -bottom-2 -right-2 w-16 h-16 opacity-5 rotate-12" />
        </Card>

        <Card className="border-none shadow-sm bg-white border-l-4 border-secondary">
           <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Saldo Livre Ads</CardTitle></CardHeader>
           <CardContent>
              <div className="text-2xl font-black">{formatCurrency(currentOrg?.adBalance || 0)}</div>
              <p className="text-[8px] font-bold text-muted-foreground uppercase mt-1">Disponível para impulsionamento</p>
           </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="vendas" className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12">
          <TabsTrigger value="vendas" className="rounded-lg px-8 font-bold gap-2"><Ticket className="w-4 h-4" /> Histórico de Vendas</TabsTrigger>
          <TabsTrigger value="anuncios" className="rounded-lg px-8 font-bold gap-2"><Coins className="w-4 h-4" /> Conta de Anúncios</TabsTrigger>
        </TabsList>

        <TabsContent value="vendas" className="space-y-6">
           <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <CardHeader className="border-b p-8 pb-6">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2"><History className="w-5 h-5 text-secondary" /> Extrato Unificado</CardTitle>
                    <div className="relative w-full md:w-80">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                       <Input placeholder="Buscar venda..." value={salesSearch} onChange={e => setSalesSearch(e.target.value)} className="pl-10 h-10 rounded-xl text-xs" />
                    </div>
                 </div>
              </CardHeader>
              <CardContent className="p-0">
                 {salesLoading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div> : (
                   <Table>
                      <TableHeader className="bg-muted/30">
                         <TableRow>
                            <TableHead className="font-black uppercase text-[9px] px-8">Data</TableHead>
                            <TableHead className="font-black uppercase text-[9px]">Evento</TableHead>
                            <TableHead className="font-black uppercase text-[9px]">Comprador</TableHead>
                            <TableHead className="font-black uppercase text-[9px] text-right">Repasse Líquido</TableHead>
                            <TableHead className="font-black uppercase text-[9px] text-center">Status</TableHead>
                         </TableRow>
                      </TableHeader>
                      <TableBody>
                         {sales.length > 0 ? sales.map((sale: any) => (
                           <TableRow key={sale.id} className="hover:bg-muted/10 transition-colors">
                              <TableCell className="text-[10px] font-bold px-8">{new Date(sale.timestamp?.seconds * 1000 || sale.timestamp).toLocaleString('pt-BR')}</TableCell>
                              <TableCell className="text-xs font-bold uppercase truncate max-w-[200px]">{sale.eventTitle}</TableCell>
                              <TableCell className="text-xs font-medium uppercase">{sale.userName}</TableCell>
                              <TableCell className="text-right font-black text-xs text-primary">{formatCurrency(sale.producerNetAmount || 0)}</TableCell>
                              <TableCell className="text-center">
                                 <Badge variant="outline" className={cn("text-[8px] font-black uppercase", sale.paymentStatus === 'Pago' ? "bg-green-50 text-green-600 border-green-200" : "bg-muted")}>{sale.paymentStatus}</Badge>
                              </TableCell>
                           </TableRow>
                         )) : (
                           <TableRow><TableCell colSpan={5} className="py-20 text-center opacity-30 italic">Nenhum registro localizado.</TableCell></TableRow>
                         )}
                      </TableBody>
                   </Table>
                 )}
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="anuncios" className="space-y-6">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2">
                 <div className="p-10 space-y-8">
                    <div className="space-y-2">
                       <h3 className="text-2xl font-black italic uppercase tracking-tighter text-primary">Recarregar Saldo Ads</h3>
                       <p className="text-sm text-muted-foreground leading-relaxed">Adicione crédito para promover sua marca e eventos. Recargas via cartão ou PIX.</p>
                    </div>

                    <div className="space-y-6">
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase opacity-60">Valor da Recarga (Base)</Label>
                          <div className="relative">
                             <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-secondary">R$</span>
                             <Input 
                                type="number" 
                                value={topUpAmount} 
                                onChange={e => setTopUpAmount(e.target.value)} 
                                className="h-16 text-3xl font-black rounded-2xl pl-12 border-secondary/20 shadow-inner" 
                             />
                          </div>
                       </div>

                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase opacity-60">Cupom de Anúncio</Label>
                          <div className="flex gap-2">
                             <div className="relative flex-1">
                                <TicketPercent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary opacity-40" />
                                <Input 
                                   placeholder="CÓDIGO" 
                                   value={couponCode} 
                                   onChange={e => setCouponCode(e.target.value.toUpperCase())}
                                   disabled={!!appliedCoupon}
                                   className="rounded-xl h-11 pl-10 border-dashed border-secondary/30 uppercase font-bold" 
                                />
                             </div>
                             {appliedCoupon ? (
                               <Button variant="outline" className="rounded-xl border-destructive text-destructive h-11" onClick={() => { setAppliedCoupon(null); setCouponCode(""); }}>
                                  <X className="w-4 h-4" />
                               </Button>
                             ) : (
                               <Button variant="secondary" className="rounded-xl h-11 px-6 font-bold" onClick={handleValidateCoupon} disabled={isValidatingCoupon || !couponCode}>
                                  {isValidatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
                               </Button>
                             )}
                          </div>
                          {appliedCoupon && (
                             <p className="text-[10px] font-black uppercase text-green-600 mt-1 animate-in zoom-in-95">
                                <CheckCircle2 className="inline w-3 h-3 mr-1" /> 
                                {appliedCoupon.type === 'discount' ? `${appliedCoupon.value}% de Desconto aplicado!` : 
                                 appliedCoupon.type === 'bonus_percent' ? `+${appliedCoupon.value}% de Bônus no saldo!` : 
                                 `+${formatCurrency(appliedCoupon.value)} de Bônus de saldo!`}
                             </p>
                          )}
                       </div>
                    </div>
                 </div>

                 <div className="bg-muted/30 p-10 flex flex-col justify-center gap-6 border-l border-dashed">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Resumo do Pagamento</h4>
                    
                    <div className="space-y-4">
                       <div className="flex justify-between items-center text-sm font-bold">
                          <span className="opacity-60 uppercase">Valor Base:</span>
                          <span className="text-primary">{formatCurrency(rechargeCalcs.base)}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm font-bold">
                          <span className="opacity-60 uppercase">Taxa de Processamento (5%):</span>
                          <span className="text-primary">{formatCurrency(rechargeCalcs.fee)}</span>
                       </div>
                       {appliedCoupon?.type === 'discount' && (
                         <div className="flex justify-between items-center text-sm font-black text-green-600">
                            <span className="uppercase">Desconto Cupom:</span>
                            <span>-{formatCurrency((rechargeCalcs.base + rechargeCalcs.fee) * (appliedCoupon.value / 100))}</span>
                         </div>
                       )}
                       <Separator className="border-dashed" />
                       <div className="flex justify-between items-center">
                          <span className="text-lg font-black uppercase italic text-primary">Total a Pagar:</span>
                          <span className="text-3xl font-black text-primary">{formatCurrency(rechargeCalcs.totalToPay)}</span>
                       </div>
                    </div>

                    <div className="p-6 bg-secondary text-white rounded-[2rem] shadow-xl space-y-2 relative overflow-hidden group">
                       <p className="text-[10px] font-black uppercase opacity-60">Saldo a ser creditado:</p>
                       <p className="text-4xl font-black italic tracking-tighter">{formatCurrency(rechargeCalcs.finalBalance)}</p>
                       {appliedCoupon && (appliedCoupon.type === 'bonus_percent' || appliedCoupon.type === 'bonus_fixed') && (
                         <Badge className="bg-white text-secondary font-black text-[9px] uppercase border-none">BÔNUS ATIVO</Badge>
                       )}
                       <Zap className="absolute -bottom-4 -right-4 w-24 h-24 opacity-10 group-hover:scale-110 transition-transform" />
                    </div>

                    <Button 
                      onClick={handleTopUp} 
                      disabled={isTopUpLoading || rechargeCalcs.base < 10} 
                      className="h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform"
                    >
                      {isTopUpLoading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <><CreditCard className="w-6 h-6 mr-2" /> Pagar com Stripe</>}
                    </Button>
                    <p className="text-[9px] text-center text-muted-foreground font-medium uppercase italic">A liberação do saldo é instantânea após a confirmação do pagamento.</p>
                 </div>
              </div>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function OrganizationFinancePage() {
  return (
    <React.Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-secondary" /></div>}>
      <OrganizationFinanceContent />
    </React.Suspense>
  );
}
