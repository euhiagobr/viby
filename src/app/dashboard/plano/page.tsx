"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { CreditCard, CheckCircle2, Zap, ShieldCheck, Loader2, Sparkles, Star, XCircle, Info, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

export default function PlanoPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  
  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading } = useDoc<any>(userDocRef)

  React.useEffect(() => {
    if (!loading && profile && profile.accountType !== 'Empresa') {
      router.push('/dashboard')
    }
  }, [profile, loading, router])

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
  }

  const currentPlan = "start" 

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Meu Plano</h1>
        <p className="text-muted-foreground font-medium">Escolha o nível de visibilidade e economia para seus eventos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Plano Start - Grátis */}
        <Card className={cn(
          "border-none shadow-sm rounded-[2.5rem] overflow-hidden relative transition-all",
          currentPlan === "start" ? "ring-4 ring-secondary/20 bg-white" : "bg-muted/30 opacity-80"
        )}>
          <CardHeader className="p-6 pb-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                   <Badge className="bg-muted text-muted-foreground border-none text-[10px] font-black uppercase px-3 py-1">Gratuito</Badge>
                   {currentPlan === "start" && <Badge className="bg-green-500 text-white border-none text-[10px] font-black uppercase px-3 py-1">Plano Atual</Badge>}
                </div>
                <CardTitle className="text-3xl font-black italic tracking-tighter uppercase">Viby Start</CardTitle>
              </div>
              <Zap className="w-6 h-6 text-muted-foreground" />
            </div>
            <CardDescription className="text-muted-foreground font-medium mt-2">Para quem está testando o mercado.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-4 space-y-6">
            <div className="text-2xl font-black">R$ 0,00</div>
            <div className="space-y-3">
              {[
                { text: "1 evento ativo por vez", check: true },
                { text: "Taxa: 16% (min. R$ 9,99)", check: true },
                { text: "Até 10 ingressos grátis", check: true },
                { text: "Sem IA Booster", check: false },
                { text: "Sem Selo Verificado", check: false }
              ].map((feature, i) => (
                <div key={i} className={cn("flex items-center gap-3 text-xs font-bold", feature.check ? "text-foreground" : "text-muted-foreground/60")}>
                  {feature.check ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-muted-foreground/30" />}
                  {feature.text}
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="p-6 pt-0">
             <Button disabled={currentPlan === "start"} variant="outline" className="w-full h-10 rounded-xl font-bold uppercase tracking-widest text-[10px]">
               {currentPlan === "start" ? "Plano Ativo" : "Migrar para Start"}
             </Button>
          </CardFooter>
        </Card>

        {/* Plano Pro - Pago */}
        <Card className={cn(
          "border-none shadow-xl rounded-[2.5rem] overflow-hidden relative transition-all group",
          currentPlan === "pro" ? "ring-4 ring-secondary/20 bg-primary text-white" : "bg-primary text-white"
        )}>
          <CardHeader className="p-6 pb-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <Badge className="bg-secondary text-white border-none text-[10px] font-black uppercase px-3 py-1">Recomendado</Badge>
                <CardTitle className="text-3xl font-black italic tracking-tighter uppercase">Viby Pro</CardTitle>
              </div>
              <Sparkles className="w-6 h-6 text-secondary fill-secondary" />
            </div>
            <CardDescription className="text-white/60 font-medium mt-2">Cresça sua produção com taxas reduzidas.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-4 space-y-6">
            <div className="space-y-1">
               <div className="text-2xl font-black text-secondary">R$ 99,90 <span className="text-[10px] font-bold text-white/40 uppercase">/mês</span></div>
            </div>
            <div className="space-y-3">
              {[
                { text: "Até 5 eventos ativos", check: true },
                { text: "Taxa: 10% (min. R$ 7,49)", check: true },
                { text: "IA Booster Completo", check: true },
                { text: "Selo Verificado", check: true },
                { text: "Destaque no Feed", check: true }
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-secondary fill-secondary" />
                  {feature.text}
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="p-6 pt-0">
             <Button className="w-full bg-secondary text-white font-black h-12 rounded-xl shadow-xl shadow-secondary/20 uppercase italic tracking-tighter text-sm group-hover:scale-105 transition-transform">
               Upgrade para Pro
             </Button>
          </CardFooter>
        </Card>

        {/* Plano Top - Premium */}
        <Card className={cn(
          "border-none shadow-sm rounded-[2.5rem] overflow-hidden relative transition-all bg-white",
          currentPlan === "top" ? "ring-4 ring-secondary/20" : "hover:border-secondary/30"
        )}>
          <CardHeader className="p-6 pb-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <Badge className="bg-black text-white border-none text-[10px] font-black uppercase px-3 py-1">Premium</Badge>
                <CardTitle className="text-3xl font-black italic tracking-tighter uppercase">Viby Top</CardTitle>
              </div>
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <CardDescription className="text-muted-foreground font-medium mt-2">Poder ilimitado e as menores taxas.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-4 space-y-6">
            <div className="space-y-1">
               <div className="text-2xl font-black">R$ 199,90 <span className="text-[10px] font-bold text-muted-foreground uppercase">/mês</span></div>
            </div>
            <div className="space-y-3">
              {[
                { text: "Eventos Ilimitados", check: true },
                { text: "Taxa: 8% (min. R$ 3,99)", check: true },
                { text: "Destaque VIP Premium", check: true },
                { text: "Suporte Prioritário 24h", check: true },
                { text: "Relatórios de Audiência", check: true }
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-xs font-bold text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  {feature.text}
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="p-6 pt-0">
             <Button variant="outline" className="w-full h-12 rounded-xl font-black border-2 border-primary uppercase italic tracking-tighter text-sm">
               Falar com Especialista
             </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="max-w-2xl mx-auto">
         <Card className="border-none shadow-sm rounded-3xl bg-muted/30">
            <CardContent className="p-6 flex items-start gap-4">
               <Info className="w-6 h-6 text-secondary shrink-0 mt-1" />
               <div className="space-y-1">
                  <h4 className="font-bold text-sm">Entendendo as taxas</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A taxa de serviço é calculada sobre o valor final de cada ingresso vendido. O valor mínimo é aplicado caso a porcentagem do plano resulte em um valor inferior ao piso estabelecido (ex: no Start, o mínimo por ingresso é R$ 9,99).
                  </p>
               </div>
            </CardContent>
         </Card>
      </div>

      <div className="text-center pt-8">
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4" /> Pagamento processado de forma segura via Stripe
        </p>
      </div>
    </div>
  )
}
