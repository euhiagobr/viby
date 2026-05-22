
'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser, useDoc } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  increment, 
  setDoc,
  orderBy, 
  limit
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Wallet, 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  Loader2,
  ShieldCheck,
  Building2,
  History,
  Coins,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  Ticket,
  Info,
  Zap,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function OrganizationFinancePage() {
  const { currentOrg, userRole, refreshOrg, loading: orgLoading } = useCurrentOrganization();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);

  const [topUpAmount, setTopUpAmount] = React.useState<string>("10.00");
  const [isTopUpLoading, setIsTopUpLoading] = React.useState(false);
  const [isWaitingPayment, setIsWaitingPayment] = React.useState(false);

  // Estados para Antecipação
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = React.useState(false);
  const [selectedSaleForAdvance, setSelectedSaleForAdvance] = React.useState<any>(null);
  const [isAdvancing, setIsAdvancing] = React.useState(false);

  const feesRef = React.useMemo(() => db ? doc(db, 'settings', 'fees') : null, [db])
  const { data: globalFees } = useDoc<any>(feesRef)

  const salesQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return query(
      collection(db, "registrations"), 
      where("organizationId", "==", currentOrg.id)
    );
  }, [db, currentOrg?.id]);

  const { data: rawSales, loading: salesLoading } = useCollection<any>(salesQuery);

  const sales = React.useMemo(() => {
    if (!rawSales) return [];
    return rawSales
      .filter((r: any) => ["Pago", "Disponível"].includes(r.paymentStatus))
      .sort((a, b) => {
        const timeA = a.timestamp?.seconds || a.createdAt?.seconds || 0;
        const timeB = b.timestamp?.seconds || b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
  }, [rawSales]);

  const isFinanceManager = ['owner', 'admin', 'finance'].includes(userRole || '');

  const salesStats = React.useMemo(() => {
    if (!sales) return { netTotal: 0, availableTotal: 0, lockedTotal: 0, grossTotal: 0, count: 0, fees: 0 };
    
    const now = new Date();

    return sales.reduce((acc: any, sale: any) => {
      acc.count++;
      acc.grossTotal += (sale.ticketBasePrice || 0);
      acc.fees += (sale.producerFeeAmount || 0);
      
      const net = sale.producerNetAmount || 0;
      acc.netTotal += net;

      const saleDate = sale.timestamp?.toDate ? sale.timestamp.toDate() : new Date(sale.timestamp);
      const standardReleaseDate = new Date(saleDate);
      standardReleaseDate.setDate(standardReleaseDate.getDate() + 30);

      const releaseDate = sale.advanceRequestedAt 
        ? new Date(new Date(sale.advanceRequestedAt).getTime() + 24 * 60 * 60 * 1000)
        : standardReleaseDate;

      if (now >= releaseDate) {
        acc.availableTotal += net;
      } else {
        acc.lockedTotal += net;
      }
      return acc;
    }, { netTotal: 0, availableTotal: 0, lockedTotal: 0, grossTotal: 0, count: 0, fees: 0 });
  }, [sales]);

  const handleTopUp = async () => {
    if (!currentOrg || !user || !db) return;
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount < 10) {
      toast({ variant: "destructive", title: "Valor mínimo", description: "O valor mínimo para recarga é R$ 10,00." });
      return;
    }

    setIsTopUpLoading(true);
    const totalToCharge = amount * 1.21;
    
    const transactionsRef = collection(db, 'organizations', currentOrg.id, 'transactions');
    const txDocRef = doc(transactionsRef);
    const txId = txDocRef.id;

    const txData = {
      type: 'topup', 
      description: 'Recarga de Saldo Ads (Aguardando)', 
      amount: amount, 
      totalCharged: totalToCharge,
      status: 'pending', 
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp(), 
      userId: user.uid, 
      userName: user.displayName || "Usuário"
    };

    setDoc(txDocRef, txData)
      .then(async () => {
        try {
          const result = await createAdBalanceTopUpSession({ 
            orgId: currentOrg.id, 
            orgName: currentOrg.name, 
            userEmail: user.email!, 
            baseAmount: amount, 
            transactionId: txId 
          });

          if (result && result.url) { 
            window.open(result.url, '_blank');
            setIsWaitingPayment(true); 
            setIsTopUpLoading(false);
          } else {
            throw new Error("Não foi possível gerar a URL de pagamento.");
          }
        } catch (stripeError: any) {
          toast({ variant: "destructive", title: "Erro no Checkout", description: stripeError.message });
          setIsTopUpLoading(false);
        }
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: txDocRef.path,
          operation: 'create',
          requestResourceData: txData
        });
        errorEmitter.emit('permission-error', permissionError);
        setIsTopUpLoading(false);
      });
  };

  const handleRequestAdvance = async () => {
    if (!db || !selectedSaleForAdvance || !currentOrg) return;
    
    setIsAdvancing(true);
    const advanceFee = selectedSaleForAdvance.producerNetAmount * 0.019;
    const newNetValue = selectedSaleForAdvance.producerNetAmount - advanceFee;

    const saleRef = doc(db, "registrations", selectedSaleForAdvance.id);
    const updateData = {
      advanceRequested: true,
      advanceRequestedAt: new Date().toISOString(),
      originalProducerNet: selectedSaleForAdvance.producerNetAmount,
      advanceFee: advanceFee,
      producerNetAmount: newNetValue,
      updatedAt: serverTimestamp()
    };

    updateDoc(saleRef, updateData)
      .then(() => {
        toast({ title: "Antecipação solicitada!", description: `O valor de ${formatCurrency(newNetValue)} estará disponível em 24h.` });
        setIsAdvanceModalOpen(false);
        setSelectedSaleForAdvance(null);
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: saleRef.path,
          operation: 'update',
          requestResourceData: updateData
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsAdvancing(false);
      });
  }

  if (orgLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  if (!currentOrg) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Wallet className="w-8 h-8 text-secondary" /> Financeiro da Marca
        </h1>
        <p className="text-muted-foreground font-medium">Gestão centralizada de recebíveis e conta de anúncios de <strong>{currentOrg.name}</strong>.</p>
      </div>

      <Tabs defaultValue="vendas" className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12">
          <TabsTrigger value="vendas" className="rounded-lg px-8 font-bold gap-2">
            <Ticket className="w-4 h-4" /> Venda de Ingressos
          </TabsTrigger>
          <TabsTrigger value="anuncios" className="rounded-lg px-8 font-bold gap-2">
            <Coins className="w-4 h-4" /> Conta de Anúncios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vendas" className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative border-l-4 border-secondary">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Disponível para Saque</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-black">{formatCurrency(salesStats.availableTotal)}</div>
                <p className="text-[9px] mt-2 font-bold opacity-40 uppercase">Liberação imediata</p>
              </CardContent>
              <CheckCircle2 className="absolute -bottom-2 -right-2 w-20 h-20 opacity-5 rotate-12" />
            </Card>

            <Card className="border-none shadow-sm bg-white border-l-4 border-orange-500">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">Total Bloqueado (D+30)</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-orange-600">{formatCurrency(salesStats.lockedTotal)}</div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-2">Valores em fase de custódia</p>
              </CardContent>
              <Lock className="absolute -bottom-2 -right-2 w-16 h-16 opacity-5 rotate-12" />
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Faturamento Bruto</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-foreground">{formatCurrency(salesStats.grossTotal)}</div>
                <p className="text-[9px] font-bold text-red-500 uppercase mt-2">Taxas Plataforma: -{formatCurrency(salesStats.fees)}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Status de Repasse</CardTitle></CardHeader>
              <CardContent>
                 <div className="flex items-center gap-2 mb-3">
                    <div className={cn("w-2 h-2 rounded-full", currentOrg.payoutSettings?.status === 'verified' ? "bg-green-500" : "bg-orange-500 animate-pulse")} />
                    <span className="text-[10px] font-black uppercase">{currentOrg.payoutSettings?.status === 'verified' ? 'Conta Verificada' : 'Pendente Verificação'}</span>
                 </div>
                 <Button variant="outline" size="sm" className="w-full rounded-xl uppercase italic text-[9px] font-bold h-9 border-secondary text-secondary" asChild>
                    <Link href="/dashboard/financeiro">Gerenciar Conta PJ</Link>
                 </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="border-b p-8 pb-6">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                <History className="w-5 h-5 text-secondary" /> Extrato de Vendas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {salesLoading ? (
                <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
              ) : sales && sales.length > 0 ? (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest">Data / Hora</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest">Evento</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Bruto</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Líquido</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Status</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale: any) => {
                      const saleDate = sale.timestamp?.toDate ? sale.timestamp.toDate() : new Date(sale.timestamp);
                      const standardReleaseDate = new Date(saleDate);
                      standardReleaseDate.setDate(standardReleaseDate.getDate() + 30);
                      const releaseDate = sale.advanceRequestedAt ? new Date(new Date(sale.advanceRequestedAt).getTime() + 24 * 60 * 60 * 1000) : standardReleaseDate;
                      const isAvailable = new Date() >= releaseDate;

                      return (
                        <TableRow key={sale.id} className="hover:bg-muted/10">
                          <TableCell className="text-[10px] font-bold">{saleDate.toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="text-xs font-bold uppercase">{sale.eventTitle}</TableCell>
                          <TableCell className="text-right text-[10px] text-muted-foreground">{formatCurrency(sale.ticketBasePrice || 0)}</TableCell>
                          <TableCell className="text-right"><span className="font-black text-xs text-primary">{formatCurrency(sale.producerNetAmount)}</span></TableCell>
                          <TableCell className="text-center">
                             <div className={cn("flex items-center justify-center gap-1 text-[9px] font-black uppercase", isAvailable ? "text-green-600" : "text-orange-500")}>
                               {isAvailable ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                               {isAvailable ? "Liberado" : "Bloqueado"}
                             </div>
                          </TableCell>
                          <TableCell className="text-right">
                             {!isAvailable && !sale.advanceRequested && (
                               <Button size="sm" variant="outline" className="h-8 rounded-lg text-[8px] font-black uppercase border-secondary text-secondary" onClick={() => { setSelectedSaleForAdvance(sale); setIsAdvanceModalOpen(true); }}>
                                  <Zap className="w-3 h-3 fill-secondary" /> Antecipar
                               </Button>
                             )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-24 text-center text-muted-foreground italic text-sm">Nenhuma venda registrada.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anuncios" className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-none shadow-sm bg-secondary text-white overflow-hidden relative">
                 <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Saldo Livre para Ads</CardTitle></CardHeader>
                 <CardContent>
                    <div className="text-3xl font-black">{formatCurrency(currentOrg.adBalance || 0)}</div>
                    <p className="text-[9px] mt-2 font-bold opacity-40 uppercase">Utilizável em campanhas</p>
                 </CardContent>
                 <Coins className="absolute -bottom-2 -right-2 w-20 h-20 opacity-10 rotate-12" />
              </Card>

              <Card className="border-none shadow-sm bg-white border-l-4 border-primary">
                 <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">Saldo em Campanhas</CardTitle></CardHeader>
                 <CardContent>
                    <div className="text-3xl font-black text-primary">{formatCurrency(currentOrg.blockedBalance || 0)}</div>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase mt-2">Vinculado a anúncios ativos</p>
                 </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white">
                 <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Investimento Total</CardTitle></CardHeader>
                 <CardContent>
                    <div className="text-3xl font-black text-foreground">{formatCurrency((currentOrg.adBalance || 0) + (currentOrg.blockedBalance || 0))}</div>
                 </CardContent>
              </Card>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-8">
                 <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                    <CardHeader className="bg-muted/30 p-8">
                       <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                          <Plus className="w-5 h-5 text-secondary" /> Recarregar Saldo
                       </CardTitle>
                       <CardDescription className="font-medium">Adicione crédito para impulsionar seus eventos.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                       <div className="space-y-4">
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Valor da Recarga (Mín. R$ 10,00)</Label>
                             <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-secondary">R$</span>
                                <Input 
                                   type="number" 
                                   step="0.01" 
                                   value={topUpAmount}
                                   onChange={e => setTopUpAmount(e.target.value)}
                                   className="h-16 text-3xl font-black pl-12 rounded-2xl border-secondary/20"
                                />
                             </div>
                          </div>

                          <div className="p-4 bg-muted/30 rounded-2xl space-y-3">
                             <div className="flex justify-between text-xs font-bold uppercase opacity-60">
                                <span>Subtotal</span>
                                <span>{formatCurrency(parseFloat(topUpAmount) || 0)}</span>
                             </div>
                             <div className="flex justify-between text-xs font-bold uppercase opacity-60">
                                <span>Encargos (21%)</span>
                                <span>{formatCurrency((parseFloat(topUpAmount) || 0) * 0.21)}</span>
                             </div>
                             <Separator />
                             <div className="flex justify-between items-center">
                                <span className="text-sm font-black uppercase italic">Total a Pagar</span>
                                <span className="text-xl font-black text-primary">{formatCurrency((parseFloat(topUpAmount) || 0) * 1.21)}</span>
                             </div>
                          </div>

                          <Button 
                             onClick={handleTopUp}
                             disabled={isTopUpLoading || !topUpAmount || parseFloat(topUpAmount) < 10}
                             className="w-full h-16 bg-secondary text-white font-black text-lg rounded-2xl shadow-xl shadow-secondary/20 uppercase italic transition-all hover:scale-[1.02]"
                          >
                             {isTopUpLoading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <CreditCard className="w-6 h-6 mr-2" />}
                             Pagar com Cartão / PIX
                          </Button>

                          {isWaitingPayment && (
                             <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-2xl border border-orange-200 animate-pulse">
                                <RefreshCw className="w-5 h-5 text-orange-600 animate-spin" />
                                <p className="text-[10px] font-black text-orange-800 uppercase">Aguardando confirmação em nova aba...</p>
                             </div>
                          )}
                       </div>
                    </CardContent>
                 </Card>
              </div>

              <div className="lg:col-span-5 space-y-6">
                 <Card className="border-none shadow-sm rounded-[2rem] bg-primary text-white">
                    <CardHeader>
                       <CardTitle className="text-sm font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                          <Info className="w-4 h-4" /> Sobre o Saldo Ads
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-xs font-medium opacity-80 leading-relaxed">
                       <p>1. O saldo recarregado é exclusivo para uso em campanhas de impulsionamento dentro da plataforma Viby.</p>
                       <p>2. Os encargos de 21% cobrem taxas de processamento financeiro (Stripe) e impostos de intermediação.</p>
                       <p>3. Saldo bloqueado refere-se a valores já reservados para campanhas ativas. Caso cancele uma campanha, o saldo remanescente volta para o Saldo Livre.</p>
                    </CardContent>
                 </Card>
              </div>
           </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isAdvanceModalOpen} onOpenChange={setIsAdvanceModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-sm">
           <DialogHeader>
              <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-2 text-secondary">
                 <Zap className="w-8 h-8 fill-secondary" />
              </div>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center">Antecipação Express</DialogTitle>
              <DialogDescription className="text-center font-medium">
                 Receba o valor deste ingresso em 24h em vez de 30 dias.
              </DialogDescription>
           </DialogHeader>
           <div className="py-4 space-y-4">
              <div className="p-4 bg-muted/30 rounded-2xl space-y-3">
                 <div className="flex justify-between text-xs font-bold opacity-60"><span>Valor Original</span> <span>{formatCurrency(selectedSaleForAdvance?.producerNetAmount || 0)}</span></div>
                 <div className="flex justify-between text-xs font-bold text-red-500"><span>Taxa de Antecipação (1.9%)</span> <span>-{formatCurrency((selectedSaleForAdvance?.producerNetAmount || 0) * 0.019)}</span></div>
                 <Separator />
                 <div className="flex justify-between items-center"><span className="text-sm font-black uppercase italic">Você Recebe</span> <span className="text-xl font-black text-green-600">{formatCurrency((selectedSaleForAdvance?.producerNetAmount || 0) * 0.981)}</span></div>
              </div>
              <p className="text-[9px] text-muted-foreground font-medium uppercase leading-relaxed text-center italic">A liberação ocorrerá na sua conta bancária verificada em até 1 dia útil após a aprovação.</p>
           </div>
           <DialogFooter>
              <Button onClick={handleRequestAdvance} disabled={isAdvancing} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-lg uppercase italic">
                 {isAdvancing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2 fill-white" />}
                 Confirmar Antecipação
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
