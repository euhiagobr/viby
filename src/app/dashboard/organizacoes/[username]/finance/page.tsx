
'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  doc, 
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
  Lock,
  Search,
  Landmark
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
import { createAdBalanceTopUpSession, finalizeAdTopUpSession } from '@/app/actions/stripe';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSearchParams, useRouter } from 'next/navigation';

export default function OrganizationFinancePage() {
  const { currentOrg, userRole, refreshOrg, loading: orgLoading } = useCurrentOrganization();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [topUpAmount, setTopUpAmount] = React.useState<string>("50.00");
  const [isTopUpLoading, setIsTopUpLoading] = React.useState(false);
  const [salesSearch, setSalesSearch] = React.useState("");
  const [isProcessingSession, setIsProcessingSession] = React.useState(false);

  const sessionId = searchParams.get('session_id');

  // Processar finalização de recarga se houver session_id
  React.useEffect(() => {
    if (!sessionId || isProcessingSession || !currentOrg) return;

    const completeTopUp = async () => {
      setIsProcessingSession(true);
      try {
        const result = await finalizeAdTopUpSession(sessionId);
        if (result.success) {
          toast({ title: "Saldo Recarregado!", description: "Seu crédito já está disponível para uso." });
          await refreshOrg();
          // Limpa a URL
          const newParams = new URLSearchParams(searchParams.toString());
          newParams.delete('session_id');
          newParams.delete('success');
          router.replace(`${window.location.pathname}?${newParams.toString()}`);
        }
      } catch (e) {
        console.error(e);
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

  const isFinanceManager = ['owner', 'admin', 'finance'].includes(userRole || '');
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

  const handleTopUp = async () => {
    if (!currentOrg || !user || !db) return;
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount < 10) {
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
        baseAmount: amount, 
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
          {isProcessingSession ? "Confirmando recarga de saldo..." : "Sincronizando finanças..."}
        </p>
      </div>
    );
  }

  if (!currentOrg) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Wallet className="w-8 h-8 text-secondary" /> Finanças da Marca
        </h1>
        <p className="text-muted-foreground font-medium">Gestão automatizada via Stripe Connect para <strong>{currentOrg.name}</strong>.</p>
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
              <div className="text-2xl font-black">{formatCurrency(currentOrg.adBalance || 0)}</div>
              <p className="text-[8px] font-bold text-muted-foreground uppercase mt-1">Disponível para impulsionamento</p>
           </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="vendas" className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12">
          <TabsTrigger value="vendas" className="rounded-lg px-8 font-bold gap-2"><Ticket className="w-4 h-4" /> Histórico de Vendas</TabsTrigger>
          <TabsTrigger value="anuncios" className="rounded-lg px-8 font-bold gap-2"><Coins className="w-4 h-4" /> Conta de Anúncios</TabsTrigger>
        </TabsList>

        <TabsContent value="vendas" className="space-y-6 animate-in slide-in-from-top-2">
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
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8">
              <div className="flex flex-col md:flex-row gap-10">
                 <div className="flex-1 space-y-6">
                    <h3 className="text-xl font-black italic uppercase tracking-tighter">Recarregar Saldo Ads</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">Adicione crédito para promover sua marca e eventos. Recargas via cartão ou PIX.</p>
                    <div className="space-y-4">
                       <Label className="text-[10px] font-black uppercase opacity-60">Valor da Recarga</Label>
                       <div className="flex gap-2">
                          <Input type="number" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} className="h-12 text-xl font-black rounded-xl border-secondary/20" />
                          <Button onClick={handleTopUp} disabled={isTopUpLoading} className="h-12 bg-secondary text-white font-black px-8 rounded-xl uppercase italic">
                            {isTopUpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Recarregar"}
                          </Button>
                       </div>
                    </div>
                 </div>
                 <div className="w-full md:w-1/3 p-6 bg-muted/30 rounded-3xl space-y-4">
                    <div className="flex items-center gap-3 text-secondary"><Zap className="w-5 h-5" /><span className="text-[10px] font-black uppercase">Entrega Imediata</span></div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed uppercase italic">O saldo para anúncios é independente das vendas de ingressos e deve ser gerenciado por aqui. Uma taxa de 5% (processamento) será somada ao valor final no checkout.</p>
                 </div>
              </div>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
