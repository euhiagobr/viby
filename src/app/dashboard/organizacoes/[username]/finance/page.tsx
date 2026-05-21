
'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from '@/firebase';
import { collection, query, where, doc, updateDoc, serverTimestamp, increment, addDoc, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  ArrowUpRight, 
  Loader2,
  Info,
  ShieldCheck,
  Building2,
  History,
  Coins,
  ArrowRightLeft,
  Plus,
  ArrowRight,
  ShieldAlert,
  ArrowDownRight,
  RefreshCw,
  Clock,
  XCircle,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { formatCurrency } from '@/lib/financial-utils';
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { createAdBalanceTopUpSession } from '@/app/actions/stripe';
import Link from 'next/link';

export default function OrganizationFinancePage() {
  const { currentOrg, userRole, refreshOrg, loading: orgLoading } = useCurrentOrganization();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);

  const [topUpAmount, setTopUpAmount] = React.useState<string>("10.00");
  const [isTopUpLoading, setIsTopUpLoading] = React.useState(false);
  const [isTransferModalOpen, setIsTransferOpen] = React.useState(false);
  const [transferValue, setTransferValue] = React.useState("");
  const [isTransferring, setIsTransferring] = React.useState(false);
  const [isWaitingPayment, setIsWaitingPayment] = React.useState(false);

  const transactionsQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return query(
      collection(db, 'organizations', currentOrg.id, 'transactions'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
  }, [db, currentOrg?.id]);

  const { data: transactions, loading: txLoading } = useCollection<any>(transactionsQuery);

  const isFinanceManager = ['owner', 'admin', 'finance'].includes(userRole || '');
  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole || '');

  if (orgLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  if (!isFinanceManager) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <ShieldCheck className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-bold italic uppercase tracking-tighter">Acesso Restrito</h2>
        <p className="text-muted-foreground font-medium">Sua conta não possui permissões de gestão financeira.</p>
      </div>
    );
  }

  const handleTopUp = async () => {
    if (!currentOrg || !user || !db) return;
    
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount < 10) {
      toast({ variant: "destructive", title: "Valor mínimo", description: "O valor mínimo para recarga é R$ 10,00." });
      return;
    }

    setIsTopUpLoading(true);
    try {
      const tax = amount * 0.16;
      const fee = amount * 0.05;
      const totalToCharge = amount + tax + fee;

      const txRef = await addDoc(collection(db, 'organizations', currentOrg.id, 'transactions'), {
        type: 'topup',
        description: 'Recarga de Saldo (Aguardando)',
        amount: amount,
        totalCharged: totalToCharge,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || "Usuário"
      });

      const { url } = await createAdBalanceTopUpSession({
        orgId: currentOrg.id,
        orgName: currentOrg.name,
        userEmail: user.email!,
        baseAmount: amount,
        transactionId: txRef.id
      });

      if (url) {
        window.open(url, '_blank');
        setIsWaitingPayment(true);
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na recarga" });
    } finally {
      setIsTopUpLoading(false);
    }
  };

  const handleTransferWalletToAds = async () => {
    if (!db || !currentOrg || !isOwnerOrAdmin || !user) return;
    
    const amount = parseFloat(transferValue.replace(',', '.'));
    const walletBalance = currentOrg.walletBalance || 0;

    if (isNaN(amount) || amount <= 0) return;
    if (amount > walletBalance) {
      toast({ variant: "destructive", title: "Saldo insuficiente", description: "Você não tem saldo suficiente na carteira de vendas." });
      return;
    }

    setIsTransferring(true);
    try {
      const orgRef = doc(db, 'organizations', currentOrg.id);
      
      await updateDoc(orgRef, {
        walletBalance: increment(-amount),
        adBalance: increment(amount),
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'organizations', currentOrg.id, 'transactions'), {
        type: 'transfer',
        description: 'Transferência Carteira -> Ads',
        amount: amount,
        totalCharged: amount,
        status: 'completed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || "Usuário"
      });

      toast({ title: "Transferência realizada!", description: `R$ ${amount.toFixed(2)} movidos para a Conta de Anúncios.` });
      setIsTransferOpen(false);
      setTransferValue("");
      await refreshOrg();
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na transferência" });
    } finally {
      setIsTransferring(false);
    }
  };

  const getTransactionStatus = (tx: any) => {
    if (tx.status === 'completed') return { label: 'Concluído', color: 'text-green-600 bg-green-50', icon: CheckCircle2 };
    if (tx.status === 'failed') return { label: 'Falhou', color: 'text-red-600 bg-red-50', icon: XCircle };
    if (tx.status === 'pending') {
      const now = new Date().getTime();
      const createdAt = tx.createdAt?.toMillis?.() || new Date(tx.createdAt).getTime();
      const diffHours = (now - createdAt) / (1000 * 60 * 60);
      if (diffHours >= 2) return { label: 'Não Pago', color: 'text-muted-foreground bg-muted', icon: Clock };
      return { label: 'Aguardando', color: 'text-orange-600 bg-orange-50 animate-pulse', icon: RefreshCw };
    }
    return { label: tx.status, color: 'bg-muted', icon: Info };
  };

  const adBalance = currentOrg?.adBalance || 0;
  const blockedBalance = currentOrg?.blockedBalance || 0;
  const walletBalance = currentOrg?.walletBalance || 0;

  const base = parseFloat(topUpAmount) || 0;
  const tax = base * 0.16;
  const fee = base * 0.05;
  const total = base + tax + fee;

  if (isWaitingPayment) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
           <div className="bg-primary p-12 flex flex-col items-center text-white gap-6">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center relative">
                 <RefreshCw className="w-10 h-10 animate-spin text-secondary" />
                 <CreditCard className="w-5 h-5 absolute text-white" />
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-center">Aguardando Pagamento</h2>
           </div>
           <CardContent className="p-10 text-center space-y-6">
              <p className="text-sm font-medium text-muted-foreground uppercase leading-relaxed">
                 Assim que concluir o pagamento, seu saldo será atualizado automaticamente.
              </p>
              <div className="flex flex-col gap-3">
                 <Button variant="outline" className="h-12 rounded-xl font-bold gap-2" onClick={() => window.location.reload()}>
                    <RefreshCw className="w-4 h-4" /> Verificar Status
                 </Button>
                 <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground" onClick={() => setIsWaitingPayment(false)}>
                    Voltar ao Painel
                 </Button>
              </div>
           </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Wallet className="w-8 h-8 text-secondary" />
          Financeiro da Marca
        </h1>
        <p className="text-muted-foreground font-medium">Gestão de saldos, recargas e orçamentos bloqueados de <strong>{currentOrg.name}</strong>.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative group">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest flex justify-between">
               Saldo Disponível Ads
               <Coins className="w-4 h-4 text-secondary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{formatCurrency(adBalance)}</div>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="mt-4 w-full h-10 rounded-xl bg-secondary text-white font-black uppercase text-[10px] italic shadow-lg hover:scale-105 transition-transform">
                  <Plus className="w-3 h-3 mr-2" /> Adicionar Saldo
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-[2rem] max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Recarregar Saldo</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Valor da Recarga (R$)</Label>
                      <div className="relative">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-secondary">R$</span>
                         <Input value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} className="h-14 pl-10 text-xl font-black rounded-2xl border-secondary/20" />
                      </div>
                      <p className="text-[9px] text-muted-foreground font-bold italic">* Mínimo de R$ 10,00</p>
                   </div>
                   <div className="bg-muted/50 rounded-2xl p-5 space-y-2">
                      <div className="flex justify-between text-xs font-medium"><span>Crédito em Saldo:</span><span className="font-bold">{formatCurrency(base)}</span></div>
                      <div className="flex justify-between text-[10px] text-muted-foreground"><span>Impostos (16%):</span><span>+{formatCurrency(tax)}</span></div>
                      <div className="flex justify-between text-[10px] text-muted-foreground"><span>Processamento (5%):</span><span>+{formatCurrency(fee)}</span></div>
                      <div className="h-px bg-border my-2" />
                      <div className="flex justify-between items-center"><span className="text-sm font-black uppercase">Total a Pagar:</span><span className="text-lg font-black text-primary">{formatCurrency(total)}</span></div>
                   </div>
                </div>
                <DialogFooter>
                   <Button onClick={handleTopUp} disabled={isTopUpLoading || base < 10} className="w-full h-14 rounded-2xl bg-secondary text-white font-black uppercase italic shadow-xl">
                      {isTopUpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CreditCard className="w-5 h-5 mr-2" /> Ir para Pagamento</>}
                   </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-secondary/10 rounded-full blur-3xl" />
        </Card>

        <Card className="border-none shadow-sm bg-white border-l-4 border-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
               Saldo Bloqueado (Ads)
               <Lock className="w-4 h-4 text-secondary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{formatCurrency(blockedBalance)}</div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase mt-2">Reservado para campanhas ativas</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
               Carteira de Vendas
               <TrendingUp className="w-4 h-4 text-green-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary">{formatCurrency(walletBalance)}</div>
            <div className="flex gap-2 mt-4">
               <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferOpen}>
                 <DialogTrigger asChild>
                   <Button variant="outline" className="flex-1 h-9 rounded-xl font-bold uppercase text-[9px] border-secondary text-secondary">
                      <ArrowRightLeft className="w-3 h-3 mr-2" /> Mover para Ads
                   </Button>
                 </DialogTrigger>
                 <DialogContent className="rounded-[2.5rem] max-w-sm">
                    <DialogHeader>
                       <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Investir em Ads</DialogTitle>
                       <DialogDescription>Mova seus ganhos para a Conta de Anúncios.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4 text-center">
                       <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10">
                          <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Disponível na Carteira</p>
                          <p className="text-xl font-black text-primary">{formatCurrency(walletBalance)}</p>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase opacity-60">Valor a Transferir</Label>
                          <Input value={transferValue} onChange={e => setTransferValue(e.target.value)} placeholder="0,00" className="h-14 text-center text-xl font-black rounded-2xl" />
                       </div>
                       <Button onClick={handleTransferWalletToAds} disabled={isTransferring || !transferValue} className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase italic">
                          {isTransferring ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar Transferência"}
                       </Button>
                    </div>
                 </DialogContent>
               </Dialog>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-l-4 border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
               Repasses Bancários
               <Building2 className="w-4 h-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-3">
                <div className="flex items-center gap-2">
                   <div className={cn("w-2 h-2 rounded-full", currentOrg.payoutSettings?.status === 'verified' ? "bg-green-500" : "bg-orange-500 animate-pulse")} />
                   <span className="text-[10px] font-black uppercase">{currentOrg.payoutSettings?.status === 'verified' ? 'Verificada' : 'Pendente'}</span>
                </div>
                <Button variant="outline" className="w-full h-9 rounded-xl uppercase italic text-[9px] font-bold" asChild>
                   <Link href="/dashboard/financeiro">Verificar Conta PJ</Link>
                </Button>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <Card className="lg:col-span-2 border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
            <CardHeader className="border-b pb-4">
               <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <History className="w-5 h-5 text-secondary" /> Histórico
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               {txLoading ? (
                 <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
               ) : transactions && transactions.length > 0 ? (
                 <div className="divide-y">
                   {transactions.map((tx: any) => {
                     const statusInfo = getTransactionStatus(tx);
                     const StatusIcon = statusInfo.icon;
                     return (
                       <div key={tx.id} className="p-5 flex items-center justify-between hover:bg-muted/10 transition-colors">
                          <div className="flex items-center gap-4">
                             <div className={cn("p-2 rounded-lg", statusInfo.color)}><StatusIcon className="w-4 h-4" /></div>
                             <div className="space-y-0.5">
                                <p className="font-bold text-sm">{tx.description}</p>
                                <p className="text-[9px] font-black uppercase text-muted-foreground">{tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleString('pt-BR') : 'agora'}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className={cn("text-sm font-black italic", tx.type === 'ad_reservation' ? 'text-orange-500' : 'text-primary')}>
                               {tx.type === 'ad_reservation' ? '-' : '+'} {formatCurrency(tx.amount)}
                             </p>
                             <Badge variant="outline" className={cn("text-[8px] font-black h-4 px-1.5 uppercase border-none", statusInfo.color)}>{statusInfo.label}</Badge>
                          </div>
                       </div>
                     );
                   })}
                 </div>
               ) : (
                 <div className="py-24 text-center text-muted-foreground font-bold italic">Nenhuma movimentação registrada.</div>
               )}
            </CardContent>
         </Card>

         <Card className="border-none shadow-sm rounded-[2rem] bg-muted/20 border-2 border-dashed border-border p-6 flex flex-col justify-center gap-6">
            <div className="space-y-2">
               <h3 className="text-lg font-bold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-secondary" /> Reserva de Orçamento</h3>
               <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                  Ao lançar um anúncio, o orçamento total é reservado (bloqueado) para garantir a veiculação por todo o período contratado. 
               </p>
            </div>
            <ul className="space-y-2">
               <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground"><CheckCircle2 className="w-3 h-3 text-green-500" /> Consumo diário do saldo bloqueado</li>
               <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground"><CheckCircle2 className="w-3 h-3 text-green-500" /> Reembolso imediato ao cancelar</li>
               <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground"><CheckCircle2 className="w-3 h-3 text-green-500" /> Gestão individual por marca</li>
            </ul>
         </Card>
      </div>
    </div>
  );
}
