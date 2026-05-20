"use client"

import * as React from "react"
import { useFirestore, useDoc, useAuth, useUser } from "@/firebase"
import { doc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  ArrowLeft, 
  Coins, 
  MousePointer2, 
  TrendingUp, 
  Info, 
  Zap, 
  ShieldCheck,
  Megaphone,
  Loader2
} from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/financial-utils"
import { useRouter } from "next/navigation"

export default function ValoresAnunciosPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading: profileLoading } = useDoc<any>(userDocRef)

  const adsSettingsRef = React.useMemo(() => db ? doc(db, 'settings', 'ads') : null, [db])
  const { data: adsSettings, loading: settingsLoading } = useDoc<any>(adsSettingsRef)

  React.useEffect(() => {
    if (!profileLoading && profile && profile.accountType !== 'Empresa') {
      router.push('/dashboard')
    }
  }, [profile, profileLoading, router])

  if (profileLoading || settingsLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  const cpcValue = adsSettings?.cpcValue || 0
  const cpmValue = adsSettings?.cpmValue || 0

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/anuncios">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Tabela de Valores</h1>
          <p className="text-muted-foreground font-medium">Entenda como sua campanha performa e como os custos são calculados.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white group hover:shadow-md transition-all">
          <CardHeader className="bg-secondary/5 border-b border-secondary/10 p-8">
            <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <MousePointer2 className="w-6 h-6 text-secondary" />
            </div>
            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">Custo por Clique (CPC)</CardTitle>
            <CardDescription className="font-medium text-muted-foreground">Valor debitado a cada clique único no seu anúncio.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="text-4xl font-black text-primary">
              {formatCurrency(cpcValue)}
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-2">/clique</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              O CPC é ideal para quem busca tráfego direto para a página do evento. Você só paga quando alguém de fato demonstra interesse e clica para ver mais detalhes.
            </p>
            <div className="p-4 bg-muted/30 rounded-xl flex gap-3 items-start">
               <Zap className="w-4 h-4 text-secondary shrink-0 mt-1" />
               <p className="text-xs font-medium">Cliques repetidos do mesmo usuário em um curto período não são cobrados duplicadamente.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white group hover:shadow-md transition-all">
          <CardHeader className="bg-primary/5 border-b border-primary/10 p-8">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">Mil Impressões (CPM)</CardTitle>
            <CardDescription className="font-medium text-muted-foreground">Valor para cada 1.000 vezes que o anúncio é exibido.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="text-4xl font-black text-primary">
              {formatCurrency(cpmValue)}
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-2">/1k views</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              O CPM foca em branding e reconhecimento. A cada vez que seu card de evento aparece na tela de um usuário, uma fração mínima deste valor é descontada do seu saldo.
            </p>
            <div className="p-4 bg-muted/30 rounded-xl flex gap-3 items-start">
               <Info className="w-4 h-4 text-primary shrink-0 mt-1" />
               <p className="text-xs font-medium">O desconto por visualização ocorre de forma fracionada: R$ {(cpmValue / 1000).toFixed(4)} por exibição.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-lg rounded-[2.5rem] bg-primary text-white overflow-hidden relative">
        <CardContent className="p-10 md:p-16 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1 space-y-6">
            <h3 className="text-3xl font-black italic uppercase tracking-tighter">Como seu saldo é consumido?</h3>
            <div className="space-y-4 text-sm opacity-90 font-medium leading-relaxed">
              <p>Ao criar uma campanha, você define um orçamento total para o período. Este saldo fica disponível em uma "carteira virtual" vinculada ao anúncio.</p>
              <p>Nosso algoritmo gerencia a entrega para que seu orçamento dure por todo o tempo contratado, priorizando os horários de maior pico na plataforma.</p>
              <p>Assim que o saldo chega a zero, o anúncio perde o selo "Patrocinado" e volta a ser um card orgânico comum na listagem geral.</p>
            </div>
            <div className="flex flex-wrap gap-4 pt-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full">
                <ShieldCheck className="w-4 h-4 text-secondary" />
                <span className="text-[10px] font-black uppercase tracking-widest">Antifraude Ativo</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full">
                <Megaphone className="w-4 h-4 text-secondary" />
                <span className="text-[10px] font-black uppercase tracking-widest">Entrega Inteligente</span>
              </div>
            </div>
          </div>
          <div className="shrink-0">
             <div className="w-40 h-40 bg-secondary rounded-full flex items-center justify-center shadow-2xl shadow-secondary/20">
                <Coins className="w-20 h-20 text-white animate-bounce" />
             </div>
          </div>
        </CardContent>
        <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full -mr-32 -mt-32 blur-3xl" />
      </Card>

      <div className="text-center pt-4">
        <Button variant="ghost" asChild className="font-bold text-muted-foreground uppercase text-xs tracking-widest hover:text-secondary">
          <Link href="/dashboard/suporte">Dúvidas sobre cobrança? Fale conosco</Link>
        </Button>
      </div>
    </div>
  )
}
