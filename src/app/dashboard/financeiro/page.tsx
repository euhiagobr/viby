
"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Landmark, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  DollarSign, 
  ShieldCheck, 
  ArrowLeft,
  Building2,
  ExternalLink,
  ShieldAlert,
  Wallet,
  Zap,
  ArrowUpRight,
  Lock,
  XCircle,
  RefreshCw
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth, useUser, useFirestore } from "@/firebase"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { createStripeConnectAccount, createAccountOnboardingLink } from "@/app/actions/stripe-connect"
import Link from "next/link"

export default function FinanceiroPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  const { currentOrg, loading: orgLoading, refreshOrg, userRole } = useCurrentOrganization()
  
  const [isProcessing, setIsProcessing] = React.useState(false)

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

  if (orgLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  if (!currentOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Building2 className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-bold italic uppercase tracking-tighter">Nenhuma Marca Selecionada</h2>
        <p className="text-muted-foreground font-medium max-w-sm">Selecione uma organização para gerenciar os dados de recebimento.</p>
        <Button asChild variant="outline" className="rounded-full mt-4"><Link href="/dashboard/organizacoes">Ver Minhas Marcas</Link></Button>
      </div>
    );
  }

  const isVerified = currentOrg.stripeChargesEnabled && currentOrg.stripePayoutsEnabled;
  const isPending = currentOrg.stripeAccountId && !isVerified;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/organizacoes/${currentOrg.username}/finance`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Conta de Recebimento</h1>
          <p className="text-muted-foreground font-medium">Configuração nativa Stripe Connect Express para <strong>{currentOrg.name}</strong>.</p>
        </div>
      </div>

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
                   <CardDescription className="font-medium">Gestão automatizada via Stripe.</CardDescription>
                </div>
                <Badge 
                  className={cn(
                    "uppercase text-[9px] font-black h-6 px-3",
                    isVerified ? "bg-green-500 text-white" : 
                    isPending ? "bg-blue-500 text-white" : "bg-orange-50 text-orange-600 border-orange-200"
                  )}
                  variant="default"
                >
                  {isVerified ? 'Aprovada' : isPending ? 'Em Análise' : 'Não Configurada'}
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
                       <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                         Para habilitar vendas e receber repasses automáticos, você deve conectar sua organização ao Stripe Express.
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
                       <StatusStep label="Vendas Ativas" status={currentOrg.stripeChargesEnabled} />
                       <StatusStep label="Repasses Ativos" status={currentOrg.stripePayoutsEnabled} />
                    </div>

                    {isVerified ? (
                       <div className="flex items-center gap-4 p-6 bg-green-50 rounded-[2rem] border-2 border-dashed border-green-200">
                          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white">
                             <CheckCircle2 className="w-7 h-7" />
                          </div>
                          <div className="space-y-1">
                             <p className="font-black uppercase text-xs text-green-800 italic">Pronto para vender!</p>
                             <p className="text-xs text-green-700 font-medium">Sua conta está 100% verificada e os repasses estão configurados.</p>
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
                               O Stripe está processando seus documentos. Isso pode levar alguns minutos ou horas. Você receberá um e-mail quando for concluído.
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
                    <p className="text-xl font-black italic uppercase tracking-tight">O que é o Stripe Express?</p>
                    <p className="text-sm opacity-80 leading-relaxed">
                       É uma carteira financeira conectada à Viby que permite que você receba o valor das suas vendas diretamente na sua conta bancária PJ sem necessidade de solicitar saques manuais.
                    </p>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-white/10">
                    <div className="flex items-start gap-3">
                       <div className="p-2 bg-white/10 rounded-lg"><DollarSign className="w-4 h-4 text-secondary" /></div>
                       <div>
                          <p className="font-bold text-xs">Sem Taxa de Saque</p>
                          <p className="text-[10px] opacity-60">O repasse é automático conforme as vendas ocorrem.</p>
                       </div>
                    </div>
                    <div className="flex items-start gap-3">
                       <div className="p-2 bg-white/10 rounded-lg"><Wallet className="w-4 h-4 text-secondary" /></div>
                       <div>
                          <p className="font-bold text-xs">Gestão de Saldo</p>
                          <p className="text-[10px] opacity-60">Monitore extratos e transferências diretamente pelo seu painel.</p>
                       </div>
                    </div>
                 </div>
              </CardContent>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
           </Card>

           <div className="p-4 bg-muted/20 border border-dashed rounded-2xl flex items-center gap-3">
              <Info className="w-5 h-5 text-primary opacity-40 shrink-0" />
              <p className="text-[9px] font-bold uppercase text-muted-foreground leading-tight">
                Em conformidade com as normas do BACEN, o Stripe processa os dados bancários com criptografia de ponta a ponta. A Viby não tem acesso aos seus dados de login bancário.
              </p>
           </div>
        </div>
      </div>
    </div>
  )
}

function StatusStep({ label, status }: { label: string, status: boolean }) {
  return (
    <div className="p-4 rounded-2xl border bg-white flex items-center justify-between">
       <span className="text-[10px] font-black uppercase text-muted-foreground">{label}</span>
       {status ? (
         <CheckCircle2 className="w-4 h-4 text-green-500" />
       ) : (
         <XCircle className="w-4 h-4 text-muted-foreground opacity-30" />
       )}
    </div>
  )
}
