"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Landmark, 
  Loader2, 
  CheckCircle2, 
  Info, 
  DollarSign, 
  ShieldCheck, 
  ArrowLeft,
  Building2,
  BadgeCheck,
  Zap,
  Wallet,
  Clock,
  XCircle,
  RefreshCw,
  Search,
  Terminal,
  AlertTriangle,
  ShieldAlert,
  Globe
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp, getDoc, limit } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { createStripeConnectAccount, createAccountOnboardingLink, retrieveStripeAccount } from "@/app/actions/stripe-connect"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"

export default function FinanceiroPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  const { currentOrg, userRole, loading: orgLoading, refreshOrg } = useCurrentOrganization()
  const { formatPrice, convertValue } = useCurrency()
  
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [isDiagnosing, setIsDiagnosing] = React.useState(false)
  const [diagnosticResult, setDiagnosticResult] = React.useState<any>(null)

  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole || '')

  const regsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "registrations"), where("paymentStatus", "in", ["Pago", "Disponível"]))
  }, [db])

  const { data: regs, loading: loadingRegs } = useCollection<any>(regsQuery)

  const globalBalances = React.useMemo(() => {
    if (!regs) return { available: 0, locked: 0 };
    
    return regs.reduce((acc: any, reg: any) => {
      const cur = (reg.currency || 'BRL') as CurrencyCode;
      const normalize = (val: number) => convertValue(val, cur, 'BRL');
      
      const now = new Date();
      const saleDate = reg.timestamp?.toDate ? reg.timestamp.toDate() : new Date(reg.timestamp);
      const releaseDate = reg.advanceRequestedAt 
        ? new Date(new Date(reg.advanceRequestedAt).getTime() + 24 * 60 * 60 * 1000)
        : new Date(saleDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      const net = reg.producerNetAmount || 0;

      if (now >= releaseDate) {
        acc.available += normalize(net);
      } else {
        acc.locked += normalize(net);
      }
      return acc;
    }, { available: 0, locked: 0 });
  }, [regs, convertValue]);

  const handleStartOnboarding = async () => {
    if (!currentOrg || !isOwnerOrAdmin) return;
    setIsProcessing(true);
    try {
      const accountRes = await createStripeConnectAccount(currentOrg.id);
      if (!accountRes.success) throw new Error(accountRes.error);

      const linkRes = await createAccountOnboardingLink(currentOrg.id, accountRes.accountId!);
      if (!linkRes.success) throw new Error(linkRes.error);

      window.location.href = linkRes.url!;
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na conexão", description: e.message });
      setIsProcessing(false);
    }
  }

  const handleRunDiagnostic = async () => {
    if (!currentOrg?.stripeAccountId) return;
    setIsDiagnosing(true);
    try {
      const result = await retrieveStripeAccount(currentOrg.stripeAccountId, currentOrg.id);
      if (result.success) {
        setDiagnosticResult(result.data);
        await refreshOrg();
        toast({ title: "Sincronização concluída!" });
      }
    } finally {
      setIsDiagnosing(false);
    }
  }

  if (orgLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  if (!currentOrg) return null;

  const isVerified = currentOrg.stripeChargesEnabled && currentOrg.stripePayoutsEnabled;
  const isPending = currentOrg.stripeAccountId && !isVerified;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/organizacoes/${currentOrg.username}`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Conta de Recebimento</h1>
            <p className="text-muted-foreground font-medium">Consolidado Financeiro (Normalizado em BRL).</p>
          </div>
        </div>
        <div className="flex gap-2">
           {currentOrg.stripeAccountId && (
             <Button variant="outline" onClick={handleRunDiagnostic} disabled={isDiagnosing} className="rounded-full h-11 px-6 font-black uppercase text-[10px] gap-2 border-primary text-primary">
                {isDiagnosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sincronizar
             </Button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm bg-primary text-white border-l-4 border-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest flex justify-between">
              Total Disponível para Saque (BRL)
              <Wallet className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">
              {formatPrice(globalBalances.available, 'BRL')}
            </div>
            <div className="flex items-center gap-2 mt-1 opacity-40">
               <Globe className="w-3 h-3" />
               <p className="text-[8px] font-bold uppercase">Soma consolidada de todas as marcas e moedas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
              Total Bloqueado (BRL)
              <Clock className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-orange-600">
              {formatPrice(globalBalances.locked, 'BRL')}
            </div>
            <p className="text-[9px] mt-1 font-bold text-muted-foreground uppercase">Valores em período de D+30 (Normalizados)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12 space-y-8">
          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="bg-muted/30 p-8">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                   <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2 text-primary">
                     <Landmark className="w-5 h-5 text-secondary" /> 
                     Status: {currentOrg.name}
                   </CardTitle>
                   <CardDescription className="font-medium">Gestão automatizada via Stripe Connect.</CardDescription>
                </div>
                <Badge className={cn("uppercase text-[9px] font-black h-6 px-3", isVerified ? "bg-green-500 text-white" : isPending ? "bg-blue-500 text-white" : "bg-orange-50 text-orange-600 border-orange-200")}>
                  {isVerified ? 'APROVADA' : isPending ? 'EM ANÁLISE' : 'NÃO CONFIGURADA'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8">
               {!currentOrg.stripeAccountId ? (
                 <div className="py-12 text-center space-y-6">
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto"><Zap className="w-10 h-10 text-muted-foreground opacity-30" /></div>
                    <div className="space-y-2">
                       <h3 className="font-bold text-lg">Habilite seus recebimentos</h3>
                       <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">Conecte sua organização ao Stripe Express para permitir vendas em BRL, USD ou EUR e receber repasses automáticos.</p>
                    </div>
                    <Button onClick={handleStartOnboarding} disabled={isProcessing} className="bg-secondary text-white font-black rounded-xl h-14 px-10 shadow-xl uppercase italic">
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <><ShieldCheck className="w-5 h-5 mr-2" /> Conectar com Stripe</>}
                    </Button>
                 </div>
               ) : (
                 <div className="space-y-8">
                    <div className="p-6 bg-muted/20 rounded-3xl border flex items-center justify-between">
                       <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground">ID Stripe Connect</p>
                          <p className="font-mono text-xs font-bold text-primary">{currentOrg.stripeAccountId}</p>
                       </div>
                       <Button variant="ghost" className="rounded-xl font-black uppercase italic text-[9px] gap-2" onClick={handleStartOnboarding}>
                          <RefreshCw className="w-3.5 h-3.5" /> Atualizar Dados
                       </Button>
                    </div>
                    <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
                       <Info className="w-5 h-5 text-secondary shrink-0" />
                       <p className="text-[10px] text-secondary font-bold uppercase leading-tight italic">Os repasses ocorrerão na moeda oficial de cada evento, depositados conforme as regras da sua conta Stripe Express.</p>
                    </div>
                 </div>
               )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
