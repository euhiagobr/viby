"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { CreditCard, CheckCircle2, Zap, ShieldCheck, Loader2, Sparkles, Star, XCircle, Info } from "lucide-react"
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

  // Atualmente simulamos que todos começam no Start
  const currentPlan = "start" 

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Meu Plano</h1>
        <p className="text-muted-foreground font-medium">Escolha o nível de visibilidade e economia para seus eventos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Plano Start - Grátis */}
        <Card className={cn(
          "border-none shadow-sm rounded-[2.5rem] overflow-hidden relative transition-all",
          currentPlan === "start" ? "ring-4 ring-secondary/20 bg-white" : "bg-muted/30 opacity-80"
        )}>
          <CardHeader className="p-8 pb-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                   <Badge className="bg-muted text-muted-foreground border-none text-[10px] font-black uppercase px-3 py-1">Gratuito</Badge>
                   {currentPlan === "start" && <Badge className="bg-green-500 text-white border-none text-[10px] font-black uppercase px-3 py-1">Plano Atual</Badge>}
                </div>
                <CardTitle className="text-4xl font-black italic tracking-tighter uppercase">Viby Start</CardTitle>
              </div>
              <div className="p-3 bg-muted rounded-2xl">
                <Zap className="w-8 h-8 text-muted-foreground" />
              </div>
            </div>
            <CardDescription className="text-muted-foreground font-medium mt-2">Perfeito para quem está começando agora.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-4 space-y-6">
            <div className="text-2xl font-black">R$ 0,00 <span className="text-xs font-bold text-muted-foreground uppercase">/sempre</span></div>
            <div className="space-y-3">
              {[
                { text: "Criar 1 evento por vez", check: true },
                { text: "Taxa de Ingressos: 16%", check: true },
                { text: "Até 10 ingressos grátis por evento", check: true },
                { text: "Sem IA Booster", check: false },
                { text: "Sem Selo Verificado", check: false },
                { text: "Divulgação básica", check: true }
              ].map((feature, i) => (
                <div key={i} className={cn("flex items-center gap-3 text-sm font-bold", feature.check ? "text-foreground" : "text-muted-foreground/60")}>
                  {feature.check ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-muted-foreground/30" />}
                  {feature.text}
                </div>
              ))}
            </div>
          </CardContent>
          {currentPlan !== "start" && (
            <CardFooter className="p-8 pt-0">
               <Button variant="outline" className="w-full h-12 rounded-xl font-bold uppercase tracking-widest text-xs">Migrar para Start</Button>
            </CardFooter>
          )}
        </Card>

        {/* Plano Pro - Pago */}
        <Card className={cn(
          "border-none shadow-xl rounded-[2.5rem] overflow-hidden relative transition-all group",
          currentPlan === "pro" ? "ring-4 ring-secondary/20 bg-primary text-white" : "bg-primary text-white hover:scale-[1.02]"
        )}>
          <CardHeader className="p-8 pb-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <Badge className="bg-secondary text-white border-none text-[10px] font-black uppercase px-3 py-1 animate-pulse">Recomendado</Badge>
                <CardTitle className="text-4xl font-black italic tracking-tighter uppercase">Viby Pro</CardTitle>
              </div>
              <div className="p-3 bg-secondary rounded-2xl shadow-lg shadow-secondary/20">
                <Sparkles className="w-8 h-8 text-white fill-white" />
              </div>
            </div>
            <CardDescription className="text-white/60 font-medium mt-2">Destaque máximo e as menores taxas do mercado.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-4 space-y-6">
            <div className="space-y-1">
               <div className="text-3xl font-black text-secondary">R$ 99,90 <span className="text-xs font-bold text-white/40 uppercase">/mês</span></div>
               <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Total: R$ 1.198,80 ao ano</p>
            </div>
            <div className="space-y-3">
              {[
                { text: "Eventos Ilimitados", check: true },
                { text: "Taxa de Ingressos: 8% (Economia de 50%)", check: true },
                { text: "Ingressos grátis ilimitados", check: true },
                { text: "IA Booster (Gerar descrições e propostas)", check: true },
                { text: "Selo de Verificado no perfil", check: true },
                { text: "Destaque nas buscas e feed", check: true }
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-sm font-bold">
                  <CheckCircle2 className="w-4 h-4 text-secondary fill-secondary" />
                  {feature.text}
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="p-8 pt-0">
             <Button className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl shadow-secondary/20 uppercase italic tracking-tighter text-lg group-hover:scale-105 transition-transform">
               Fazer Upgrade Agora
             </Button>
          </CardFooter>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
        </Card>
      </div>

      <div className="max-w-2xl mx-auto">
         <Card className="border-none shadow-sm rounded-3xl bg-muted/30">
            <CardContent className="p-6 flex items-start gap-4">
               <Info className="w-6 h-6 text-secondary shrink-0 mt-1" />
               <div className="space-y-1">
                  <h4 className="font-bold text-sm">Sobre as taxas de serviço</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    As taxas são aplicadas apenas sobre ingressos pagos. Eventos gratuitos no plano <strong>Start</strong> têm limite de 10 vouchers. No plano <strong>Pro</strong>, você pode emitir quantos vouchers quiser com taxa zero.
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
