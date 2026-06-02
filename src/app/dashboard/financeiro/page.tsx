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
  ShieldAlert
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth, useUser, useFirestore } from "@/firebase"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { createStripeConnectAccount, createAccountOnboardingLink, retrieveStripeAccount } from "@/app/actions/stripe-connect"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"

export default function FinanceiroPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  const { currentOrg, userRole, loading: orgLoading, refreshOrg } = useCurrentOrganization()
  
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [isDiagnosing, setIsDiagnosing] = React.useState(false)
  const [diagnosticResult, setDiagnosticResult] = React.useState<any>(null)

  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole || '')

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
    if (!currentOrg?.stripeAccountId) {
      toast({ variant: "destructive", title: "Ação não permitida", description: "A organização ainda não possui uma conta Stripe criada." });
      return;
    }

    setIsDiagnosing(true);
    try {
      // Chama o diagnóstico que agora também força a sincronização
      const result = await retrieveStripeAccount(currentOrg.stripeAccountId, currentOrg.id);
      if (result.success) {
        setDiagnosticResult(result.data);
        await refreshOrg(); // Recarrega os dados da org para refletir a sincronização
        toast({ title: "Sincronização concluída!" });
      } else {
        toast({ 
          variant: "destructive", 
          title: "Erro na sincronização", 
          description: result.error || "Ocorreu um erro ao consultar a Stripe." 
        });
      }
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "Erro crítico", 
        description: "Falha na comunicação com o servidor de diagnóstico." 
      });
      console.error(e);
    } finally {
      setIsDiagnosing(false);
    }
  }

  if (orgLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  if (!currentOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Building2 className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-bold italic uppercase tracking-tighter">Nenhuma Marca Selecionada</h2>
        <p className="text-muted-foreground font-medium max-sm">Selecione uma organização para gerenciar os dados de recebimento.</p>
        <Button asChild variant="outline" className="rounded-full mt-4"><Link href="/dashboard/organizacoes">Ver Minhas Marcas</Link></Button>
      </div>
    );
  }

  const isVerified = currentOrg.stripeChargesEnabled && currentOrg.stripePayoutsEnabled;
  const isPending = currentOrg.stripeAccountId && !isVerified;

  const getStripeRealStatus = (stripeData: any) => {
    if (!stripeData) return null;
    if (stripeData.charges_enabled && stripeData.payouts_enabled) return { label: "APROVADA", color: "text-green-600", icon: CheckCircle2 };
    if (stripeData.requirements?.currently_due?.length > 0) return { label: "PENDENTE DE DOCUMENTAÇÃO", color: "text-orange-500", icon: AlertTriangle };
    if (stripeData.requirements?.disabled_reason) return { label: "BLOQUEADA", color: "text-red-600", icon: XCircle };
    return { label: "EM ANÁLISE", color: "text-blue-500", icon: Clock };
  }

  const realStatus = getStripeRealStatus(diagnosticResult);
  const hasDivergence = diagnosticResult && (
    diagnosticResult.details_submitted !== currentOrg.stripeOnboardingComplete ||
    diagnosticResult.charges_enabled !== currentOrg.stripeChargesEnabled ||
    diagnosticResult.payouts_enabled !== currentOrg.stripePayoutsEnabled
  );

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
            <p className="text-muted-foreground font-medium">Configuração nativa Stripe Connect Express para <strong>{currentOrg.name}</strong>.</p>
          </div>
        </div>
        <div className="flex gap-2">
           {currentOrg.stripeAccountId && (
             <Button 
               variant="outline" 
               onClick={handleRunDiagnostic} 
               disabled={isDiagnosing}
               className="rounded-full h-11 px-6 font-black uppercase text-[10px] gap-2 border-primary text-primary"
             >
                {isDiagnosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Sincronizar com Stripe
             </Button>
           )}
        </div>
      </div>

      {diagnosticResult && (
        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white border-t-8 border-primary overflow-hidden animate-in zoom-in-95">
           <CardHeader className="bg-muted/30 p-8 border-b">
              <div className="flex justify-between items-center">
                 <div className="space-y-1">
                    <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary">Diagnóstico em Tempo Real</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">Consulta direta via API Stripe</CardDescription>
                 </div>
                 {realStatus && (
                    <div className={cn("flex items-center gap-2 px-4 py-2 rounded-xl bg-white shadow-sm border", realStatus.color)}>
                       <realStatus.icon className="w-5 h-5" />
                       <span className="font-black italic uppercase text-xs">STATUS REAL: {realStatus.label}</span>
                    </div>
                 )}
              </div>
           </CardHeader>
           <CardContent className="p-8 space-y-8">
              {hasDivergence && (
                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200 flex items-center gap-3 text-orange-700">
                   <AlertTriangle className="w-5 h-5 animate-pulse" />
                   <p className="text-xs font-black uppercase tracking-tight">O sistema detectou mudanças e atualizou o banco de dados.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest border-b pb-2">Dados da API Stripe</h3>
                    <div className="space-y-2">
                       <div className="flex justify-between py-1">
                          <span className="text-[10px] font-bold uppercase opacity-60">Account ID:</span>
                          <span className="text-[10px] font-mono font-bold">{diagnosticResult.id}</span>
                       </div>
                       <div className="flex justify-between py-1">
                          <span className="text-[10px] font-bold uppercase opacity-60">Onboarding:</span>
                          {diagnosticResult.details_submitted ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                       </div>
                       <div className="flex justify-between py-1">
                          <span className="text-[10px] font-bold uppercase opacity-60">Vendas:</span>
                          {diagnosticResult.charges_enabled ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                       </div>
                       <div className="flex justify-between py-1">
                          <span className="text-[10px] font-bold uppercase opacity-60">Repasses:</span>
                          {diagnosticResult.payouts_enabled ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                       </div>
                       <Separator className="my-4 border-dashed" />
                       <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase opacity-40">Pendências Atuais</p>
                          <p className="text-xs font-bold text-primary">{diagnosticResult.requirements?.currently_due?.length > 0 ? diagnosticResult.requirements.currently_due.join(', ') : 'Nenhuma'}</p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest border-b pb-2">Estado no Banco de Dados</h3>
                    <div className="space-y-2">
                       <div className="flex justify-between py-1">
                          <span className="text-[10px] font-bold uppercase opacity-60">Sincronizado?</span>
                          {!hasDivergence ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <RefreshCw className="w-3.5 h-3.5 text-orange-500 animate-spin" />}
                       </div>
                       <div className="flex justify-between py-1">
                          <span className="text-[10px] font-bold uppercase opacity-60">Status Interno:</span>
                          <Badge variant="outline" className="text-[8px] font-black uppercase">{currentOrg.payoutSettings?.status || 'none'}</Badge>
                       </div>
                    </div>
                 </div>
              </div>
              <div className="pt-4 flex justify-end">
                 <Button variant="ghost" size="sm" className="rounded-xl font-bold uppercase text-[9px]" onClick={() => setDiagnosticResult(null)}>Fechar Painel</Button>
              </div>
           </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="bg-muted/30 p-8">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                   <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2 text-primary">
                     <Landmark className="w-5 h-5 text-secondary" /> 
                     Status da Conta
                   </CardTitle>
                   <CardDescription className="font-medium">Gestão automatizada via Stripe Connect.</CardDescription>
                </div>
                <Badge 
                  className={cn(
                    "uppercase text-[9px] font-black h-6 px-3",
                    isVerified ? "bg-green-500 text-white" : 
                    isPending ? "bg-blue-500 text-white" : "bg-orange-50 text-orange-600 border-orange-200"
                  )}
                  variant="default"
                >
                  {isVerified ? 'APROVADA' : isPending ? 'EM ANÁLISE' : 'NÃO CONFIGURADA'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8">
               {!currentOrg.stripeAccountId ? (
                 <div className="py-6 text-center space-y-6">
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
                       <Zap className="w-10 h-10 text-muted-foreground opacity-30" />
                    </div>
                    <div className="space-y-2">
                       <h3 className="font-bold text-lg">Inicie sua Conexão</h3>
                       <p className="text-sm text-muted-foreground max-sm mx-auto leading-relaxed">
                         Conecte sua organização ao Stripe Express para habilitar vendas pagas e repasses automáticos.
                       </p>
                    </div>
                    <Button 
                      onClick={handleStartOnboarding} 
                      disabled={isProcessing}
                      className="bg-secondary text-white font-black rounded-xl h-14 px-10 shadow-xl shadow-secondary/20 uppercase italic transition-all hover:scale-105"
                    >
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

                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 rounded-2xl border bg-white flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-muted-foreground">Vendas Ativas</span>
                          {currentOrg.stripeChargesEnabled ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-muted-foreground opacity-30" />}
                       </div>
                       <div className="p-4 rounded-2xl border bg-white flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-muted-foreground">Repasses Ativos</span>
                          {currentOrg.stripePayoutsEnabled ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-muted-foreground opacity-30" />}
                       </div>
                    </div>

                    {isVerified ? (
                       <div className="flex items-center gap-4 p-6 bg-green-50 rounded-[2rem] border-2 border-dashed border-green-200 animate-in zoom-in-95">
                          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white">
                             <CheckCircle2 className="w-7 h-7" />
                          </div>
                          <div className="space-y-1">
                             <p className="font-black uppercase text-xs text-green-800 italic">Pronto para vender!</p>
                             <p className="text-xs text-green-700 font-medium">Sua conta está verificada e sincronizada com sucesso.</p>
                          </div>
                       </div>
                    ) : (
                       <div className="flex items-center gap-4 p-6 bg-blue-50 rounded-[2rem] border-2 border-dashed border-blue-200">
                          <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white shrink-0">
                             <Clock className="w-7 h-7 animate-pulse" />
                          </div>
                          <div className="space-y-1">
                             <p className="font-black uppercase text-xs text-blue-800 italic">Informações em Análise</p>
                             <p className="text-xs text-blue-700 font-medium leading-relaxed">
                               Aguardando confirmação definitiva da Stripe. Use o botão no topo para sincronizar manualmente.
                             </p>
                          </div>
                       </div>
                    )}
                 </div>
               )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-6">
           <Card className="border-none shadow-xl rounded-[2rem] bg-primary text-white overflow-hidden relative">
              <CardHeader className="pb-2">
                 <CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> 
                    Repasses Automáticos
                 </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 relative z-10">
                 <div className="space-y-2">
                    <p className="text-xl font-black italic uppercase tracking-tight">Viby + Stripe Express</p>
                    <p className="text-sm opacity-80 leading-relaxed">
                       O valor líquido das suas vendas cai direto na sua conta bancária configurada, sem necessidade de solicitações manuais de saque.
                    </p>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-white/10">
                    <div className="flex items-start gap-3">
                       <div className="p-2 bg-white/10 rounded-lg"><DollarSign className="w-4 h-4 text-secondary" /></div>
                       <div>
                          <p className="font-bold text-xs">Taxa de Saque Zero</p>
                          <p className="text-[10px] opacity-60">O repasse é processado pelo split automático no checkout.</p>
                       </div>
                    </div>
                    <div className="flex items-start gap-3">
                       <div className="p-2 bg-white/10 rounded-lg"><ShieldCheck className="w-4 h-4 text-secondary" /></div>
                       <div>
                          <p className="font-bold text-xs">Sincronização Ativa</p>
                          <p className="text-[10px] opacity-60">Monitoramento em tempo real do status da sua conta.</p>
                       </div>
                    </div>
                 </div>
              </CardContent>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
           </Card>

           <div className="p-4 bg-muted/20 border border-dashed rounded-2xl flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-primary opacity-40 shrink-0" />
              <p className="text-[9px] font-bold uppercase text-muted-foreground leading-tight">
                Em caso de divergência entre a Stripe e seu painel, utilize o botão de sincronização no topo da página.
              </p>
           </div>
        </div>
      </div>
    </div>
  )
}
