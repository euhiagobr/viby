
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
  limit,
  getDoc
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
  ArrowRightLeft,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  Ticket,
  BarChart3,
  Percent,
  ChevronRight,
  Info,
  Lock,
  Zap,
  Calendar,
  AlertTriangle,
  ArrowUpRight
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

  // Estados para Antecipação
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = React.useState(false);
  const [selectedSaleForAdvance, setSelectedSaleForAdvance] = React.useState<any>(null);
  const [isAdvancing, setIsAdvancing] = React.useState(false);

  // Consulta simplificada para evitar erros de índice composto no protótipo
  const salesQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return query(
      collection(db, "registrations"), 
      where("organizationId", "==", currentOrg.id)
    );
  }, [db, currentOrg?.id]);

  const { data: rawSales, loading: salesLoading } = useCollection<any>(salesQuery);

  // Processamento de dados em memória (Filtro de pagamento e Ordenação)
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
    if (!sales) return { netTotal: 0, availableTotal: 0, lockedTotal: 0, grossTotal: 0, count: 0, fees: 0, byEvent: {} as any };
    
    const now = new Date();

    return sales.reduce((acc: any, sale: any) => {
      acc.count++;
      acc.grossTotal += (sale.ticketBasePrice || 0);
      acc.fees += (sale.producerFeeAmount || 0);
      
      const net = sale.producerNetAmount || 0;
      acc.netTotal += net;

      // Lógica de disponibilidade (D+30)
      const saleDate = sale.timestamp?.toDate ? sale.timestamp.toDate() : new Date(sale.timestamp);
      const standardReleaseDate = new Date(saleDate);
      standardReleaseDate.setDate(standardReleaseDate.getDate() + 30);

      // Se foi antecipado, libera em 1 dia após a solicitação (D+1)
      const releaseDate = sale.advanceRequestedAt 
        ? new Date(new Date(sale.advanceRequestedAt).getTime() + 24 * 60 * 60 * 1000)
        : standardReleaseDate;

      if (now >= releaseDate) {
        acc.availableTotal += net;
      } else {
        acc.lockedTotal += net;
      }

      // Agrupar por evento
      if (!acc.byEvent[sale.eventId]) {
        acc.byEvent[sale.eventId] = { title: sale.eventTitle, count: 0, net: 0, gross: 0 };
      }
      acc.byEvent[sale.eventId].count++;
      acc.byEvent[sale.eventId].net += net;
      acc.byEvent[sale.eventId].gross += (sale.ticketBasePrice || 0);
      
      return acc;
    }, { netTotal: 0, availableTotal: 0, lockedTotal: 0, grossTotal: 0, count: 0, fees: 0, byEvent: {} });
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

  const handleRequestAdvance = async () => {
    if (!db || !selectedSaleForAdvance || !currentOrg) return;
    
    setIsAdvancing(true);
    try {
      const advanceFee = selectedSaleForAdvance.producerNetAmount * 0.019;
      const newNetValue = selectedSaleForAdvance.producerNetAmount - advanceFee;

      const saleRef = doc(db, "registrations", selectedSaleForAdvance.id);
      await updateDoc(saleRef, {
        advanceRequested: true,
        advanceRequestedAt: new Date().toISOString(),
        originalProducerNet: selectedSaleForAdvance.producerNetAmount,
        advanceFee: advanceFee,
        producerNetAmount: newNetValue,
        updatedAt: serverTimestamp()
      });

      toast({ 
        title: "Antecipação solicitada!", 
        description: `O valor de ${formatCurrency(newNetValue)} estará disponível em 24h.` 
      });
      setIsAdvanceModalOpen(false);
      setSelectedSaleForAdvance(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao processar antecipação" });
    } finally {
      setIsAdvancing(false);
    }
  }

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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                    <History className="w-5 h-5 text-secondary" /> 
                    Extrato de Vendas
                  </CardTitle>
                  <CardDescription className="text-xs font-medium">Lista de todos os ingressos pagos e cronograma de recebimento.</CardDescription>
                </div>
                <Badge variant="secondary" className="font-bold text-[9px] uppercase px-3 py-1">Mostrando {sales?.length || 0} registros</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {salesLoading ? (
                <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
              ) : sales && sales.length > 0 ? (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest whitespace-nowrap">Data / Hora</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest">Evento</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest">Participante</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest">Ingresso / Lote</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Bruto</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Líquido</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Disponibilidade</TableHead>
                      <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale: any) => {
                      const saleDate = sale.timestamp?.toDate ? sale.timestamp.toDate() : new Date(sale.timestamp);
                      const standardReleaseDate = new Date(saleDate);
                      standardReleaseDate.setDate(standardReleaseDate.getDate() + 30);

                      const releaseDate = sale.advanceRequestedAt 
                        ? new Date(new Date(sale.advanceRequestedAt).getTime() + 24 * 60 * 60 * 1000)
                        : standardReleaseDate;

                      const isAvailable = new Date() >= releaseDate;
                      const isAdvanced = !!sale.advanceRequested;

                      return (
                        <TableRow key={sale.id} className="hover:bg-muted/10 transition-colors">
                          <TableCell className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                            {saleDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell className="font-bold text-xs truncate max-w-[150px] uppercase italic">{sale.eventTitle}</TableCell>
                          <TableCell className="text-xs font-medium">@{sale.userName}</TableCell>
                          <TableCell>
                             <div className="flex flex-col">
                                <span className="text-[10px] font-bold">{sale.ticketTypeName}</span>
                                <span className="text-[8px] font-black text-muted-foreground uppercase opacity-40">{sale.batchName}</span>
                             </div>
                          </TableCell>
                          <TableCell className="text-right text-[10px] font-medium text-muted-foreground">
                            {formatCurrency(sale.ticketBasePrice || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-black text-xs text-primary">{formatCurrency(sale.producerNetAmount)}</span>
                          </TableCell>
                          <TableCell className="text-center">
                             <div className="flex flex-col items-center gap-1">
                                <div className={cn(
                                  "flex items-center gap-1 text-[9px] font-black uppercase",
                                  isAvailable ? "text-green-600" : "text-orange-500"
                                )}>
                                  {isAvailable ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                  {isAvailable ? "Liberado" : isAdvanced ? "D+1 Ativo" : "Bloqueado"}
                                </div>
                                <span className={cn(
                                  "font-bold uppercase",
                                  isAdvanced ? "text-[7px] text-secondary" : "text-[8px] text-muted-foreground"
                                )}>
                                  {isAdvanced 
                                    ? releaseDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                                    : releaseDate.toLocaleDateString('pt-BR')
                                  }
                                </span>
                             </div>
                          </TableCell>
                          <TableCell className="text-right">
                             {!isAvailable && !isAdvanced && (
                               <Button 
                                 size="sm" 
                                 variant="outline" 
                                 className="h-8 rounded-lg text-[8px] font-black uppercase border-secondary text-secondary hover:bg-secondary/10 gap-1.5"
                                 onClick={() => { setSelectedSaleForAdvance(sale); setIsAdvanceModalOpen(true); }}
                               >
                                  <Zap className="w-3 h-3 fill-secondary" /> Antecipar (D+1)
                               </Button>
                             )}
                             {isAdvanced && (
                               <Badge className="bg-secondary/10 text-secondary border-secondary/20 text-[8px] font-black uppercase">
                                 Antecipado
                               </Badge>
                             )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-24 text-center">
                   <Ticket className="w-12 h-12 text-muted-foreground mx-auto opacity-10 mb-4" />
                   <p className="text-muted-foreground font-bold italic text-sm">Nenhuma venda registrada até o momento.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="p-6 bg-muted/20 rounded-3xl space-y-4">
             <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest"><Info className="w-4 h-4" /> Regras de Taxas</div>
             <p className="text-[10px] text-muted-foreground leading-relaxed">As taxas são calculadas por ingresso de acordo com o plano do proprietário da marca no momento da venda. O valor líquido é transferido para sua conta PJ verificada conforme o ciclo de repasse.</p>
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
                          <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Valor da Recarga (R$)</Label>
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
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL DE ANTECIPAÇÃO */}
      <Dialog open={isAdvanceModalOpen} onOpenChange={setIsAdvanceModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-sm">
           <DialogHeader>
              <div className="mx-auto w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mb-2">
                 <Zap className="w-8 h-8 text-secondary fill-secondary" />
              </div>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center">Antecipar Recebimento</DialogTitle>
              <DialogDescription className="text-center font-medium">
                 Garante o valor líquido deste ingresso na sua conta disponível em <strong>24 horas</strong>.
              </DialogDescription>
           </DialogHeader>

           <div className="py-6 space-y-6">
              <div className="bg-muted/50 p-6 rounded-3xl space-y-4">
                 <div className="flex justify-between text-xs font-bold uppercase opacity-60">
                    <span>Líquido Original</span>
                    <span>{formatCurrency(selectedSaleForAdvance?.producerNetAmount || 0)}</span>
                 </div>
                 <div className="flex justify-between text-[10px] font-black text-red-500 uppercase">
                    <span>Taxa de Adiantamento (1.9%)</span>
                    <span>- {formatCurrency((selectedSaleForAdvance?.producerNetAmount || 0) * 0.019)}</span>
                 </div>
                 <Separator />
                 <div className="flex justify-between items-center">
                    <span className="text-sm font-black uppercase italic">Você Receberá</span>
                    <span className="text-xl font-black text-primary">
                      {formatCurrency((selectedSaleForAdvance?.producerNetAmount || 0) * 0.981)}
                    </span>
                 </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                 <Info className="w-5 h-5 text-blue-600 shrink-0" />
                 <p className="text-[9px] font-bold text-blue-800 uppercase leading-tight">
                    O valor ficará disponível para solicitação de saque no seu painel principal amanhã.
                 </p>
              </div>
           </div>

           <DialogFooter>
              <Button 
                onClick={handleRequestAdvance} 
                disabled={isAdvancing}
                className="w-full bg-secondary text-white font-black h-16 rounded-[2rem] shadow-xl shadow-secondary/20 uppercase italic text-lg"
              >
                 {isAdvancing ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <><Zap className="w-6 h-6 mr-2" /> Confirmar Antecipação</>}
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
