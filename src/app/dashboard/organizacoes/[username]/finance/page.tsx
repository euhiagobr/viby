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
  addDoc, 
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
import { formatCurrency, calculateFinancialBreakdown } from '@/lib/financial-utils';
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

      toast({ title: "Antecipação solicitada!", description: `O valor de ${formatCurrency(newNetValue)} estará disponível em 24h.` });
      setIsAdvanceModalOpen(false);
      setSelectedSaleForAdvance(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao processar antecipação" });
    } finally {
      setIsAdvancing(false);
    }
  }

  if (orgLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

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
           {/* Conteúdo de Anúncios */}
           <div className="p-8 text-center bg-white rounded-3xl border-2 border-dashed border-border opacity-50">
              <Coins className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-bold">Gerencie seu saldo de publicidade nesta aba.</p>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
