'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from '@/firebase';
import { collection, query, where, doc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
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
  ArrowDownRight
} from 'lucide-react';
import { formatCurrency } from '@/lib/financial-utils';
import { cn } from '@/lib/utils';
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

export default function OrganizationFinancePage() {
  const { currentOrg, userRole, refreshOrg } = useCurrentOrganization();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);

  const [topUpAmount, setTopUpProgress] = React.useState<string>("10.00");
  const [isTopUpLoading, setIsTopUpLoading] = React.useState(false);
  const [isTransferModalOpen, setIsTransferOpen] = React.useState(false);
  const [transferValue, setTransferValue] = React.useState("");
  const [isTransferring, setIsTransferring] = React.useState(false);

  const isFinanceManager = ['owner', 'admin', 'finance'].includes(userRole || '');
  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole || '');

  if (!isFinanceManager) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <ShieldCheck className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground">Você não tem permissão para visualizar dados financeiros.</p>
      </div>
    );
  }

  const handleTopUp = async () => {
    if (!currentOrg || !user) return;
    
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount < 10) {
      toast({ variant: "destructive", title: "Valor mínimo", description: "O valor mínimo para recarga é R$ 10,00." });
      return;
    }

    setIsTopUpLoading(true);
    try {
      const { url } = await createAdBalanceTopUpSession({
        orgId: currentOrg.id,
        orgName: currentOrg.name,
        userEmail: user.email!,
        baseAmount: amount
      });

      if (url) {
        window.location.href = url;
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na recarga" });
    } finally {
      setIsTopUpLoading(false);
    }
  };

  const handleTransferWalletToAds = async () => {
    if (!db || !currentOrg || !isOwnerOrAdmin) return;
    
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

  const adBalance = currentOrg?.adBalance || 0;
  const walletBalance = currentOrg?.walletBalance || 0;

  const base = parseFloat(topUpAmount) || 0;
  const tax = base * 0.16;
  const fee = base * 0.05;
  const fixed = 5.00;
  const total = base + tax + fee + fixed;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Wallet className="w-8 h-8 text-secondary" />
          Financeiro da Marca
        </h1>
        <p className="text-muted-foreground font-medium">Gestão de saldos, recargas de anúncios e repasses exclusivos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative group">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest flex justify-between">
               Conta de Anúncios (Saldo)
               <Coins className="w-4 h-4 text-secondary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">{formatCurrency(adBalance)}</div>
            
            <div className="flex gap-2 mt-6">
               <Dialog>
                 <DialogTrigger asChild>
                   <Button className="flex-1 h-10 rounded-xl bg-secondary text-white font-black uppercase text-[10px] italic shadow-lg hover:scale-105 transition-transform">
                      <Plus className="w-3 h-3 mr-2" /> Adicionar Saldo
                   </Button>
                 </DialogTrigger>
                 <DialogContent className="rounded-[2rem] max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Recarregar Saldo</DialogTitle>
                      <DialogDescription>O crédito será adicionado exclusivamente à conta de anúncios de {currentOrg.name}.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase opacity-60">Valor da Recarga (R$)</Label>
                          <div className="relative">
                             <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-secondary">R$</span>
                             <Input 
                               value={topUpAmount}
                               onChange={e => setTopUpProgress(e.target.value)}
                               className="h-14 pl-10 text-xl font-black rounded-2xl border-secondary/20"
                               placeholder="10.00"
                             />
                          </div>
                          <p className="text-[9px] text-muted-foreground font-bold italic">* Mínimo de R$ 10,00</p>
                       </div>

                       <div className="bg-muted/50 rounded-2xl p-5 space-y-3">
                          <div className="flex justify-between text-xs font-medium"><span>Crédito em Saldo:</span><span className="font-bold">{formatCurrency(base)}</span></div>
                          <div className="flex justify-between text-xs text-muted-foreground"><span>Impostos (16%):</span><span>+{formatCurrency(tax)}</span></div>
                          <div className="flex justify-between text-xs text-muted-foreground"><span>Taxa de Processamento (5%):</span><span>+{formatCurrency(fee)}</span></div>
                          <div className="flex justify-between text-xs text-muted-foreground"><span>Custo Fixo de Transação:</span><span>+{formatCurrency(fixed)}</span></div>
                          <div className="h-px bg-border my-2" />
                          <div className="flex justify-between items-center"><span className="text-sm font-black uppercase">Total a Pagar:</span><span className="text-lg font-black text-primary">{formatCurrency(total)}</span></div>
                       </div>
                    </div>

                    <DialogFooter>
                       <Button 
                         onClick={handleTopUp} 
                         disabled={isTopUpLoading || base < 10} 
                         className="w-full h-14 rounded-2xl bg-secondary text-white font-black uppercase italic shadow-xl"
                       >
                          {isTopUpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CreditCard className="w-5 h-5 mr-2" /> Pagar via Stripe</>}
                       </Button>
                    </DialogFooter>
                 </DialogContent>
               </Dialog>
            </div>
          </CardContent>
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-secondary/20 rounded-full blur-3xl" />
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden relative">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
               Carteira de Vendas (Líquido)
               <TrendingUp className="w-4 h-4 text-green-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary">{formatCurrency(walletBalance)}</div>
            
            <div className="flex gap-2 mt-4">
               <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferOpen}>
                 <DialogTrigger asChild>
                   <Button variant="outline" className="flex-1 h-10 rounded-xl font-bold uppercase text-[10px] border-secondary text-secondary hover:bg-secondary/5">
                      <ArrowRightLeft className="w-3.5 h-3.5 mr-2" /> Mover para Ads
                   </Button>
                 </DialogTrigger>
                 <DialogContent className="rounded-[2.5rem] max-w-sm">
                    <DialogHeader>
                       <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Investir em Ads</DialogTitle>
                       <DialogDescription>Mova o valor líquido das suas vendas para a Conta de Anúncios da marca.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                       <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex flex-col items-center text-center gap-2">
                          <p className="text-[10px] font-black uppercase text-muted-foreground">Disponível na Carteira</p>
                          <p className="text-xl font-black text-primary">{formatCurrency(walletBalance)}</p>
                       </div>

                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase opacity-60">Valor a Transferir</Label>
                          <Input 
                            value={transferValue}
                            onChange={e => setTransferValue(e.target.value)}
                            placeholder="0,00"
                            className="h-14 text-center text-xl font-black rounded-2xl"
                          />
                       </div>

                       <div className="flex justify-center">
                          <ArrowDownRight className="w-6 h-6 text-muted-foreground animate-bounce" />
                       </div>

                       <div className="p-4 bg-muted rounded-2xl border flex flex-col items-center text-center gap-1">
                          <p className="text-[10px] font-black uppercase opacity-60">Novo Saldo de Ads</p>
                          <p className="text-lg font-bold text-secondary">{formatCurrency(adBalance + (parseFloat(transferValue.replace(',','.')) || 0))}</p>
                       </div>
                    </div>

                    <DialogFooter>
                       <Button 
                         onClick={handleTransferWalletToAds} 
                         disabled={isTransferring || !transferValue} 
                         className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase italic"
                       >
                          {isTransferring ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar Transferência"}
                       </Button>
                    </DialogFooter>
                 </DialogContent>
               </Dialog>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-l-4 border-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
               Repasses Bancários
               <Building2 className="w-4 h-4 text-secondary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-3">
                <div className="flex items-center gap-2">
                   <div className={cn(
                     "w-2 h-2 rounded-full",
                     currentOrg.payoutSettings?.status === 'verified' ? "bg-green-500" : "bg-orange-500 animate-pulse"
                   )} />
                   <span className="text-[10px] font-black uppercase">
                     {currentOrg.payoutSettings?.status === 'verified' ? 'Conta Verificada' : 'Conta de Recebimento'}
                   </span>
                </div>
                <Button variant="outline" className="w-full h-10 rounded-xl uppercase italic text-[10px] font-bold border-muted" asChild>
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
                  <History className="w-5 h-5 text-secondary" /> Histórico de Transações
               </CardTitle>
               <CardDescription>Movimentações financeiras da marca <strong>{currentOrg.name}</strong>.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               <div className="py-20 text-center text-muted-foreground italic text-sm">
                  Nenhuma transação registrada para esta conta.
               </div>
            </CardContent>
         </Card>

         <Card className="border-none shadow-sm rounded-[2rem] bg-muted/20 border-2 border-dashed border-border">
            <CardHeader>
               <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-secondary" /> Antifraude Ativo
               </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
               <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                  Esta conta de anúncios conta com proteção avançada. Saldos adicionados via cartão de crédito possuem retenção de segurança em caso de disputa.
               </p>
               <ul className="space-y-2">
                  {['Gestão Individual por Marca', 'Sem Compartilhamento de Saldo', 'Faturamento Consolidado'].map(item => (
                    <li key={item} className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
                       <ShieldCheck className="w-3 h-3 text-green-500" /> {item}
                    </li>
                  ))}
               </ul>
            </CardContent>
         </Card>
      </div>

      <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
         <Info className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
         <div className="space-y-1">
            <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary">Isolamento de Contas</h4>
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
               Para sua segurança e conformidade fiscal, cada organização no Viby opera com sua própria <strong>Conta de Anúncios</strong>. Não é possível vincular ou transferir saldos entre diferentes marcas ou para perfis pessoais.
            </p>
         </div>
      </div>
    </div>
  );
}
