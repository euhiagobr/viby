'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  increment, 
  addDoc, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowRightLeft,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  Ticket,
  BarChart3,
  Percent,
  ChevronRight,
  Info
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

export default function OrganizationFinancePage() {
  const { currentOrg, userRole, refreshOrg, loading: orgLoading } = useCurrentOrganization();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);

  const [topUpAmount, setTopUpAmount] = React.useState<string>("10.00");
  const [isTopUpLoading, setIsTopUpLoading] = React.useState(false);
  const [isWaitingPayment, setIsWaitingPayment] = React.useState(false);

  // Consulta de Vendas (Ingressos)
  const salesQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return query(
      collection(db, "registrations"), 
      where("organizationId", "==", currentOrg.id),
      where("paymentStatus", "in", ["Pago", "Disponível"])
    );
  }, [db, currentOrg?.id]);

  const { data: sales, loading: salesLoading } = useCollection<any>(salesQuery);

  // Consulta de Transações de Ads
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

  const salesStats = React.useMemo(() => {
    if (!sales) return { netTotal: 0, grossTotal: 0, count: 0, fees: 0, byEvent: {} as any };
    
    return sales.reduce((acc: any, sale: any) => {
      acc.count++;
      acc.grossTotal += (sale.ticketBasePrice || 0);
      acc.netTotal += (sale.producerNetAmount || 0);
      acc.fees += (sale.producerFeeAmount || 0);
      
      // Agrupar por evento
      if (!acc.byEvent[sale.eventId]) {
        acc.byEvent[sale.eventId] = { title: sale.eventTitle, count: 0, net: 0, gross: 0 };
      }
      acc.byEvent[sale.eventId].count++;
      acc.byEvent[sale.eventId].net += (sale.producerNetAmount || 0);
      acc.byEvent[sale.eventId].gross += (sale.ticketBasePrice || 0);
      
      return acc;
    }, { netTotal: 0, grossTotal: 0, count: 0, fees: 0, byEvent: {} });
  }, [sales]);

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
        type: 'topup', description: 'Recarga de Saldo Ads (Aguardando)', amount: amount, totalCharged: totalToCharge,
        status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), userId: user.uid, userName: user.displayName || "Usuário"
      });
      const { url } = await createAdBalanceTopUpSession({ orgId: currentOrg.id, orgName: currentOrg.name, userEmail: user.email!, baseAmount: amount, transactionId: txRef.id });
      if (url) { window.open(url, '_blank'); setIsWaitingPayment(true); }
    } catch (e) { toast({ variant: "destructive", title: "Erro na recarga" }); }
    finally { setIsTopUpLoading(false); }
  };

  if (orgLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  if (!isFinanceManager) return <div className="flex flex-col items-center justify-center py-20 gap-4 text-center"><ShieldCheck className="w-16 h-16 text-muted-foreground opacity-20" /><h2 className="text-xl font-bold italic uppercase tracking-tighter">Acesso Restrito</h2><p className="text-muted-foreground font-medium">Sua conta não possui permissões de gestão financeira.</p></div>

  if (isWaitingPayment) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
         <div className="bg-primary p-12 flex flex-col items-center text-white gap-6"><div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center relative"><RefreshCw className="w-10 h-10 animate-spin text-secondary" /><CreditCard className="w-5 h-5 absolute text-white" /></div><h2 className="text-2xl font-black uppercase italic tracking-tighter text-center">Aguardando Pagamento</h2></div>
         <CardContent className="p-10 text-center space-y-6"><p className="text-sm font-medium text-muted-foreground uppercase leading-relaxed">Assim que concluir o pagamento, seu saldo será atualizado automaticamente.</p><div className="flex flex-col gap-3"><Button variant="outline" className="h-12 rounded-xl font-bold gap-2" onClick={() => window.location.reload()}><RefreshCw className="w-4 h-4" /> Verificar Status</Button><Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground" onClick={() => setIsWaitingPayment(false)}>Voltar ao Painel</Button></div></CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Wallet className="w-8 h-8 text-secondary" /> Financeiro da Marca
        </h1>
        <p className="text-muted-foreground font-medium">Gestão centralizada de vendas e publicidade para <strong>{currentOrg.name}</strong>.</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Valor Líquido (A Receber)</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-black">{formatCurrency(salesStats.netTotal)}</div>
                <p className="text-[9px] mt-2 font-bold opacity-40 uppercase">Já descontadas as taxas do seu plano</p>
              </CardContent>
              <TrendingUp className="absolute -bottom-2 -right-2 w-20 h-20 opacity-5 rotate-12" />
            </Card>

            <Card className="border-none shadow-sm bg-white border-l-4 border-secondary">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Faturamento Bruto</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-foreground">{formatCurrency(salesStats.grossTotal)}</div>
                <p className="text-[9px] font-bold text-red-500 uppercase mt-2">Taxas Plataforma: -{formatCurrency(salesStats.fees)}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Repasses Bancários</CardTitle></CardHeader>
              <CardContent>
                 <div className="flex items-center gap-2 mb-3">
                    <div className={cn("w-2 h-2 rounded-full", currentOrg.payoutSettings?.status === 'verified' ? "bg-green-500" : "bg-orange-500 animate-pulse")} />
                    <span className="text-[10px] font-black uppercase">{currentOrg.payoutSettings?.status === 'verified' ? 'Verificada' : 'Pendente Verificação'}</span>
                 </div>
                 <Button variant="outline" size="sm" className="w-full rounded-xl uppercase italic text-[9px] font-bold h-9" asChild>
                    <Link href="/dashboard/financeiro">Gerenciar Conta PJ</Link>
                 </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-8">
              <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
                <CardHeader className="border-b p-8 pb-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2"><History className="w-5 h-5 text-secondary" /> Últimas Vendas</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {salesLoading ? (
                    <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
                  ) : sales && sales.length > 0 ? (
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="font-bold text-[10px] uppercase">Data</TableHead>
                          <TableHead className="font-bold text-[10px] uppercase">Evento</TableHead>
                          <TableHead className="font-bold text-[10px] uppercase">Participante</TableHead>
                          <TableHead className="text-right font-bold text-[10px] uppercase">Valor Líquido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sales.slice(0, 10).map((sale: any) => (
                          <TableRow key={sale.id} className="hover:bg-muted/20">
                            <TableCell className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                              {sale.timestamp?.toDate ? sale.timestamp.toDate().toLocaleDateString('pt-BR') : '---'}
                            </TableCell>
                            <TableCell className="font-bold text-xs truncate max-w-[150px]">{sale.eventTitle}</TableCell>
                            <TableCell className="text-xs">@{sale.userName}</TableCell>
                            <TableCell className="text-right font-black text-xs text-primary">{formatCurrency(sale.producerNetAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="py-24 text-center text-muted-foreground italic text-sm">Nenhuma venda registrada ainda.</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-sm rounded-[2rem] bg-secondary/5 border-2 border-dashed border-secondary/20">
                <CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest text-secondary flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Performance por Evento</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(salesStats.byEvent).length > 0 ? (
                    Object.entries(salesStats.byEvent).map(([id, data]: [string, any]) => (
                      <div key={id} className="p-4 bg-white rounded-2xl border border-secondary/10 flex justify-between items-center group cursor-pointer hover:border-secondary transition-all">
                        <div className="space-y-0.5">
                           <p className="font-bold text-xs truncate max-w-[120px]">{data.title}</p>
                           <p className="text-[9px] font-black text-muted-foreground uppercase">{data.count} Ingressos</p>
                        </div>
                        <div className="text-right">
                           <p className="text-xs font-black text-primary">{formatCurrency(data.net)}</p>
                           <ChevronRight className="w-3 h-3 text-secondary inline-block ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic text-center py-4">Aguardando primeiras vendas.</p>
                  )}
                </CardContent>
              </Card>

              <div className="p-6 bg-muted/20 rounded-3xl space-y-4">
                 <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest"><Info className="w-4 h-4" /> Regras de Taxas</div>
                 <p className="text-[10px] text-muted-foreground leading-relaxed">As taxas são calculadas por ingresso de acordo com o plano do proprietário da marca no momento da venda. O valor líquido é transferido para sua conta PJ verificada conforme o ciclo de repasse.</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="anuncios" className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-none shadow-sm bg-secondary text-white overflow-hidden relative group">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest flex justify-between">Saldo Livre para Ads <Coins className="w-4 h-4 text-white" /></CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-black">{formatCurrency(currentOrg?.adBalance || 0)}</div>
                <Dialog>
                  <DialogTrigger asChild><Button className="mt-4 w-full h-10 rounded-xl bg-white text-secondary font-black uppercase text-[10px] italic shadow-lg hover:bg-white/90">Recarregar Agora</Button></DialogTrigger>
                  <DialogContent className="rounded-[2.5rem] max-w-sm">
                    <DialogHeader><DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Recarregar Saldo</DialogTitle></DialogHeader>
                    <div className="space-y-6 py-4">
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase opacity-60">Valor da Recarga (R$)</Label>
                          <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-secondary">R$</span><Input value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} className="h-14 pl-10 text-xl font-black rounded-2xl border-secondary/20" /></div>
                          <p className="text-[9px] text-muted-foreground font-bold italic">* Mínimo de R$ 10,00</p>
                       </div>
                       <div className="bg-muted/50 rounded-2xl p-5 space-y-2">
                          <div className="flex justify-between text-xs font-medium"><span>Crédito em Saldo:</span><span className="font-bold">{formatCurrency(parseFloat(topUpAmount) || 0)}</span></div>
                          <div className="flex justify-between text-[10px] text-muted-foreground"><span>Taxas Operacionais:</span><span>+{(parseFloat(topUpAmount) * 0.21 || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                          <div className="h-px bg-border my-2" />
                          <div className="flex justify-between items-center"><span className="text-sm font-black uppercase">Total a Pagar:</span><span className="text-lg font-black text-primary">{formatCurrency((parseFloat(topUpAmount) || 0) * 1.21)}</span></div>
                       </div>
                    </div>
                    <DialogFooter><Button onClick={handleTopUp} disabled={isTopUpLoading || (parseFloat(topUpAmount) || 0) < 10} className="w-full h-14 rounded-2xl bg-secondary text-white font-black uppercase italic shadow-xl">{isTopUpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CreditCard className="w-5 h-5 mr-2" /> Pagar via Stripe</>}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white border-l-4 border-secondary">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">Saldo Bloqueado <Lock className="w-4 h-4 text-secondary" /></CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-black text-foreground">{formatCurrency(currentOrg?.blockedBalance || 0)}</div><p className="text-[9px] font-bold text-muted-foreground uppercase mt-2">Reservado para campanhas ativas</p></CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Investimento do Mês</CardTitle></CardHeader>
              <CardContent className="flex items-center gap-8">
                <div><div className="text-2xl font-black text-primary">{formatCurrency(transactions?.filter(t => t.type === 'ad_reservation' || t.type === 'topup').reduce((acc, t) => acc + (t.amount || 0), 0) || 0)}</div><p className="text-[9px] font-bold text-muted-foreground uppercase">Gasto total bruto</p></div>
                <div className="w-px h-10 bg-border" />
                <Button variant="outline" size="sm" className="rounded-xl font-bold text-[10px] uppercase h-9 border-secondary text-secondary" asChild><Link href={`/dashboard/organizacoes/${currentOrg.username}/anuncios`}>Gerenciar Campanhas</Link></Button>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
            <CardHeader className="border-b p-8 pb-4"><CardTitle className="text-lg font-bold flex items-center gap-2"><History className="w-5 h-5 text-secondary" /> Histórico Financeiro Ads</CardTitle></CardHeader>
            <CardContent className="p-0">
               {txLoading ? (
                 <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
               ) : transactions && transactions.length > 0 ? (
                 <div className="divide-y">
                   {transactions.map((tx: any) => {
                     const isNegative = tx.type === 'ad_reservation';
                     return (
                       <div key={tx.id} className="p-5 flex items-center justify-between hover:bg-muted/10 transition-colors">
                          <div className="flex items-center gap-4">
                             <div className={cn("p-2 rounded-lg", isNegative ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600")}>{isNegative ? <ArrowRightLeft className="w-4 h-4" /> : <Plus className="w-4 h-4" />}</div>
                             <div><p className="font-bold text-sm">{tx.description}</p><p className="text-[9px] font-black uppercase text-muted-foreground">{tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleString('pt-BR') : 'agora'}</p></div>
                          </div>
                          <div className="text-right">
                             <p className={cn("text-sm font-black italic", isNegative ? 'text-orange-500' : 'text-primary')}>{isNegative ? '-' : '+'} {formatCurrency(tx.amount)}</p>
                             <Badge variant="outline" className={cn("text-[8px] font-black h-4 px-1.5 uppercase border-none", tx.status === 'completed' ? 'text-green-600' : 'text-orange-500')}>{tx.status === 'completed' ? 'Confirmado' : 'Pendente'}</Badge>
                          </div>
                       </div>
                     );
                   })}
                 </div>
               ) : (
                 <div className="py-24 text-center text-muted-foreground font-bold italic">Nenhuma recarga ou reserva registrada.</div>
               )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
