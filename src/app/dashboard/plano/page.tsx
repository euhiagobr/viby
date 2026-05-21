"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { 
  CheckCircle2, 
  Zap, 
  Loader2, 
  Sparkles, 
  Trophy, 
  XCircle, 
  Info, 
  ShieldCheck, 
  Building2, 
  CalendarDays, 
  Ticket, 
  BarChart3,
  Percent,
  Coins
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createPlanCheckoutSession } from "@/app/actions/stripe"
import { toast } from "@/hooks/use-toast"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"

const PLAN_INFO = {
  START: {
    label: "Gratuito",
    badge: "Básico",
    color: "muted",
    icon: Zap
  },
  PRO: {
    label: "Recomendado",
    badge: "Popular",
    color: "secondary",
    icon: Sparkles
  },
  TOP: {
    label: "Premium",
    badge: "Elite",
    color: "primary",
    icon: Trophy
  }
}

export default function PlanoPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  const { organizations, loading: orgsLoading } = useCurrentOrganization()
  
  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading: profileLoading } = useDoc<any>(userDocRef)

  const plansRef = React.useMemo(() => db ? doc(db, 'settings', 'plans') : null, [db])
  const { data: plansSettings, loading: plansLoading } = useDoc<any>(plansRef)

  const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'annual'>('annual')
  const [upgrading, setUpgrading] = React.useState<string | null>(null)

  // Redireciona se o usuário não tiver organizações (requisito para liberar a página)
  React.useEffect(() => {
    if (!orgsLoading && organizations.length === 0) {
      router.replace('/dashboard/organizacoes')
    }
  }, [organizations, orgsLoading, router])

  const handleUpgrade = async (planId: 'PRO' | 'TOP', planName: string, amount: number) => {
    if (!user) return
    
    setUpgrading(planId)
    try {
      const { url } = await createPlanCheckoutSession({
        planId,
        planName,
        billingCycle,
        userId: user.uid,
        userEmail: user.email!,
        totalAmount: Math.round(amount * 100)
      })

      if (url) {
        window.location.href = url
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao processar", description: error.message })
    } finally {
      setUpgrading(null)
    }
  }

  if (profileLoading || plansLoading || orgsLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  if (organizations.length === 0) return null;

  const currentPlan = profile?.plan?.toUpperCase() || "START"
  const override = profile?.planOverride

  const getPlanLimit = (planKey: string, field: string) => {
    const baseVal = plansSettings?.[planKey.toLowerCase()]?.[field] ?? 0;
    return baseVal === 0 ? "Ilimitado" : baseVal;
  }

  const getPlanPrice = (planKey: string) => {
    if (planKey === 'START') return 0;
    const planData = plansSettings?.[planKey.toLowerCase()];
    if (!planData) return 0;
    return billingCycle === 'monthly' ? planData.monthlyPrice : planData.annualPrice;
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Meu Plano e Benefícios</h1>
          <p className="text-muted-foreground font-medium">Escolha o nível de visibilidade e economia para seus eventos.</p>
        </div>
        
        <Tabs value={billingCycle} onValueChange={(v: any) => setBillingCycle(v)} className="w-fit">
          <TabsList className="bg-muted p-1 rounded-xl h-12">
            <TabsTrigger value="monthly" className="rounded-lg px-6 font-bold">Mensal</TabsTrigger>
            <TabsTrigger value="annual" className="rounded-lg px-6 font-bold flex items-center gap-2">
              Anual 
              <Badge className="bg-green-500 text-[8px] h-4 font-black px-1.5 uppercase">Até 23% OFF</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {override && (
        <Card className="border-none bg-secondary/10 border-2 border-dashed border-secondary/30 rounded-[2rem]">
          <CardContent className="p-6 flex items-center gap-4">
             <div className="p-3 bg-secondary/20 rounded-2xl"><ShieldCheck className="w-6 h-6 text-secondary" /></div>
             <div>
                <p className="text-xs font-black uppercase text-secondary">Plano Personalizado Ativo</p>
                <p className="text-sm font-medium text-muted-foreground">O administrador aplicou limites especiais exclusivos para sua conta.</p>
             </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {['START', 'PRO', 'TOP'].map((planId) => {
          const info = PLAN_INFO[planId as keyof typeof PLAN_INFO]
          const isCurrent = currentPlan === planId
          const planData = plansSettings?.[planId.toLowerCase()]
          const amount = getPlanPrice(planId)

          return (
            <Card key={planId} className={cn(
              "border-none shadow-xl rounded-[2.5rem] overflow-hidden relative transition-all group flex flex-col",
              isCurrent ? "ring-4 ring-secondary/20 bg-white" : planId === 'PRO' ? "bg-primary text-white" : "bg-white"
            )}>
              <CardHeader className="p-8 pb-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <Badge className={cn("border-none text-[10px] font-black uppercase px-3 py-1", planId === 'PRO' ? "bg-secondary text-white" : "bg-muted text-muted-foreground")}>{info.badge}</Badge>
                    <CardTitle className={cn("text-3xl font-black italic tracking-tighter uppercase", planId === 'PRO' ? "text-white" : "text-primary")}>Viby {planId}</CardTitle>
                  </div>
                  <info.icon className={cn("w-7 h-7", planId === 'PRO' ? "text-secondary fill-secondary" : "text-muted-foreground")} />
                </div>
                <div className="mt-6">
                   {planId === 'START' ? (
                     <div className="text-2xl font-black">Grátis</div>
                   ) : (
                     <div className="space-y-1">
                        <div className={cn("text-2xl font-black", planId === 'PRO' ? "text-secondary" : "text-primary")}>
                           {billingCycle === 'monthly' ? `R$ ${amount.toFixed(2)}` : `12x R$ ${(amount / 12).toFixed(2)}`}
                           <span className="text-[10px] font-bold opacity-40 uppercase ml-1">/{billingCycle === 'monthly' ? 'mês' : 'ano'}</span>
                        </div>
                        {billingCycle === 'annual' && <p className="text-[10px] font-bold opacity-40 uppercase">Cobrado anualmente: R$ {amount.toFixed(2)}</p>}
                     </div>
                   )}
                </div>
              </CardHeader>
              
              <CardContent className="p-8 pt-4 space-y-6 flex-1">
                <div className="space-y-4">
                   <div className="flex items-center gap-3 text-xs font-bold">
                      <Building2 className="w-4 h-4 opacity-40" />
                      <span>{getPlanLimit(planId, 'maxOrganizations')} Marca(s)</span>
                   </div>
                   <div className="flex items-center gap-3 text-xs font-bold">
                      <CalendarDays className="w-4 h-4 opacity-40" />
                      <span>{getPlanLimit(planId, 'maxActiveEvents')} Evento(s) Ativo(s)</span>
                   </div>
                   <div className="flex items-center gap-3 text-xs font-bold">
                      <Percent className="w-4 h-4 opacity-40" />
                      <span>Taxa: {planData?.feePercent}%</span>
                   </div>
                   <div className="flex items-center gap-3 text-xs font-bold">
                      <Coins className="w-4 h-4 opacity-40" />
                      <span>Mínimo: {planData?.minFeeAmount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                   </div>
                   <div className={cn("flex items-center gap-3 text-xs font-bold", planData?.isVerified ? "text-green-500" : "opacity-30")}>
                      {planData?.isVerified ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      <span>Selo Verificado</span>
                   </div>
                   <div className={cn("flex items-center gap-3 text-xs font-bold", planData?.hasReports ? "text-green-500" : "opacity-30")}>
                      {planData?.hasReports ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      <span>Métricas VIP</span>
                   </div>
                   {planData?.maxTicketsPerEvent > 0 && (
                     <div className="flex items-center gap-3 text-xs font-bold text-orange-500">
                        <Ticket className="w-4 h-4" />
                        <span>Máx {planData.maxTicketsPerEvent} ingressos/evento</span>
                     </div>
                   )}
                </div>
              </CardContent>

              <CardFooter className="p-8 pt-0">
                 {isCurrent ? (
                    <Button disabled className="w-full h-12 rounded-xl bg-green-500/20 text-green-600 font-black uppercase italic text-xs border-none">
                       Plano Atual
                    </Button>
                 ) : planId === 'START' ? (
                    <Button variant="outline" className="w-full h-12 rounded-xl font-bold uppercase text-[10px]" onClick={() => router.refresh()}>Fazer Downgrade</Button>
                 ) : (
                    <Button 
                      onClick={() => handleUpgrade(planId as 'PRO' | 'TOP', planId, amount)}
                      disabled={!!upgrading}
                      className={cn(
                        "w-full h-14 rounded-2xl font-black uppercase italic text-sm shadow-xl transition-all hover:scale-105",
                        planId === 'PRO' ? "bg-secondary text-white shadow-secondary/20" : "bg-primary text-white shadow-primary/20"
                      )}
                    >
                       {upgrading === planId ? <Loader2 className="w-5 h-5 animate-spin" /> : "Fazer Upgrade"}
                    </Button>
                 )}
              </CardFooter>
            </Card>
          )
        })}
      </div>

      <div className="max-w-2xl mx-auto p-8 bg-muted/30 rounded-[2.5rem] flex gap-6 items-start">
         <Info className="w-6 h-6 text-secondary shrink-0 mt-1" />
         <div className="space-y-2">
            <h4 className="font-black uppercase italic text-primary">Informações sobre Cobrança</h4>
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
               As taxas de serviço são aplicadas individualmente por ingresso vendido. O valor da taxa (percentual ou mínimo) é determinado pelo seu plano no momento da venda. Upgrades de plano entram em vigor instantaneamente após a confirmação do pagamento no Stripe.
            </p>
         </div>
      </div>
    </div>
  )
}
