"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { CreditCard, CheckCircle2, Zap, ShieldCheck, Loader2, Sparkles, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { useRouter } from "next/navigation"

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Meu Plano</h1>
        <p className="text-muted-foreground font-medium">Gerencie sua assinatura e turbine sua visibilidade no Viby Club.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-xl bg-primary text-white rounded-[2.5rem] overflow-hidden relative">
            <CardHeader className="p-8 pb-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <Badge className="bg-white/20 text-white border-none text-[10px] font-black uppercase px-3 py-1">Plano Atual</Badge>
                  <CardTitle className="text-4xl font-black italic tracking-tighter uppercase">Viby Start</CardTitle>
                </div>
                <Zap className="w-12 h-12 text-secondary fill-secondary" />
              </div>
              <CardDescription className="text-white/60 font-medium">Ideal para organizadores independentes e pequenas produtoras.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  "Eventos Ilimitados",
                  "Taxa de Serviço: 10%",
                  "Suporte Prioritário",
                  "Dashboard de Público",
                  "Divulgação no Feed",
                  "IA Booster (10 créditos/mês)"
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm font-bold">
                    <CheckCircle2 className="w-4 h-4 text-secondary" />
                    {feature}
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="p-8 pt-0 flex justify-between items-center bg-white/5">
              <p className="text-xs font-bold uppercase tracking-widest opacity-60">Próxima renovação: 12/04/2024</p>
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 font-bold rounded-xl">Alterar Cartão</Button>
            </CardFooter>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
          </Card>

          <div className="space-y-4">
             <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground ml-4">Upgrade para o Viby Pro</h3>
             <Card className="border-none shadow-sm rounded-[2rem] border-l-8 border-secondary overflow-hidden group hover:shadow-lg transition-all">
                <CardContent className="p-8 flex items-center justify-between">
                   <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-2xl font-black italic uppercase tracking-tighter">Viby PRO</h4>
                        <Sparkles className="w-5 h-5 text-secondary" />
                      </div>
                      <p className="text-xs text-muted-foreground font-medium max-w-sm">
                        Reduza as taxas de serviço para 7%, ganhe o selo azul de verificado e tenha destaque máximo em todas as buscas por cidade.
                      </p>
                   </div>
                   <div className="text-right">
                      <p className="text-3xl font-black text-secondary">R$ 97<span className="text-sm font-bold text-muted-foreground">/mês</span></p>
                      <Button className="mt-4 bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg hover:scale-105 transition-transform">Quero o PRO</Button>
                   </div>
                </CardContent>
             </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm rounded-[2rem]">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Star className="w-5 h-5 text-secondary" />
                Destaques
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-2xl space-y-1">
                <p className="text-[10px] font-black uppercase opacity-60">Taxa Atual</p>
                <p className="text-lg font-bold">10% por ingresso</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-2xl space-y-1">
                <p className="text-[10px] font-black uppercase opacity-60">Selo Verificado</p>
                <Badge variant="outline" className="mt-1 opacity-50">Indisponível no Start</Badge>
              </div>
              <div className="p-4 bg-muted/50 rounded-2xl space-y-1">
                <p className="text-[10px] font-black uppercase opacity-60">IA Booster</p>
                <p className="text-lg font-bold">10 créditos restantes</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-[2rem] bg-secondary text-white">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Segurança
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs font-medium leading-relaxed">
                Seus dados de pagamento são processados de forma criptografada pelo nosso parceiro Stripe. O Viby não armazena os dados do seu cartão de crédito.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
