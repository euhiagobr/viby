
"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { 
  CheckCircle2, 
  Zap, 
  Loader2, 
  Sparkles, 
  Trophy, 
  Info, 
  ShieldCheck, 
  Building2, 
  CalendarDays, 
  Ticket, 
  BarChart3,
  Percent,
  Coins,
  ArrowRight
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import Link from "next/link"

export default function PlanoPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  const { currentOrg, loading: orgLoading } = useCurrentOrganization()
  
  const feesRef = React.useMemo(() => db ? doc(db, 'settings', 'fees') : null, [db])
  const { data: feesSettings, loading: feesLoading } = useDoc<any>(feesRef)

  if (orgLoading || feesLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Regras da Plataforma</h1>
        <p className="text-muted-foreground font-medium">Informações sobre taxas, recebimentos e funcionalidades liberadas.</p>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary text-white overflow-hidden relative">
        <CardContent className="p-10 md:p-16 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1 space-y-6">
            <Badge className="bg-secondary text-white font-black uppercase text-[10px] px-3">Acesso Total Liberado</Badge>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-tight">A Viby agora é para todos.</h2>
            <p className="text-lg opacity-80 leading-relaxed font-medium">
              Removemos os limites de planos. Agora você pode criar quantas marcas e eventos desejar, sem custos fixos mensais. Você paga apenas quando vende.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full">
                <CheckCircle2 className="w-4 h-4 text-secondary" />
                <span className="text-[10px] font-black uppercase tracking-widest">Organizações Ilimitadas</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full">
                <CheckCircle2 className="w-4 h-4 text-secondary" />
                <span className="text-[10px] font-black uppercase tracking-widest">Eventos Ilimitados</span>
              </div>
            </div>
          </div>
          <div className="shrink-0">
             <div className="w-40 h-40 bg-secondary rounded-full flex items-center justify-center shadow-2xl shadow-secondary/20">
                <Sparkles className="w-20 h-20 text-white animate-pulse" />
             </div>
          </div>
        </CardContent>
        <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full -mr-32 -mt-32 blur-3xl" />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <Card className="border-none shadow-sm rounded-[2rem] bg-white">
            <CardHeader className="p-8 pb-4">
               <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center mb-4 text-secondary">
                  <Percent className="w-6 h-6" />
               </div>
               <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Taxa de Venda</CardTitle>
               <CardDescription className="font-medium">O que é cobrado por ingresso vendido.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-6">
               <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-dashed">
                     <span className="text-sm font-bold opacity-60">Porcentagem</span>
                     <span className="font-black text-primary">{feesSettings?.organizerFeePercent || 10}%</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-dashed">
                     <span className="text-sm font-bold opacity-60">Valor Mínimo</span>
                     <span className="font-black text-primary">{feesSettings?.organizerMinFee?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 9,99'}</span>
                  </div>
               </div>
               <div className="p-4 bg-muted/30 rounded-2xl flex gap-3">
                  <Info className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase">
                    A plataforma aplica automaticamente o maior valor entre a porcentagem e o mínimo. Ingressos grátis não possuem taxa de serviço.
                  </p>
               </div>
            </CardContent>
         </Card>

         <Card className="border-none shadow-sm rounded-[2rem] bg-white">
            <CardHeader className="p-8 pb-4">
               <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center mb-4 text-primary">
                  <Building2 className="w-6 h-6" />
               </div>
               <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Recursos da Conta</CardTitle>
               <CardDescription className="font-medium">Funcionalidades inclusas para todas as marcas.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-4">
               {[
                 "Acesso a métricas de visualização em tempo real",
                 "Gestão de equipe ilimitada (Admin, Editor, Financeiro)",
                 "Check-in integrado via QR Code",
                 "Link de perfil personalizado (@suamarca)",
                 "Solicitação de parcerias e co-organização",
                 "Selo de verificação (após validação de CNPJ)"
               ].map((feat, i) => (
                 <div key={i} className="flex items-center gap-3 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>{feat}</span>
                 </div>
               ))}
            </CardContent>
         </Card>
      </div>

      <div className="flex justify-center">
         <Button asChild className="bg-secondary text-white font-black h-14 rounded-2xl px-12 shadow-xl shadow-secondary/20 uppercase italic transition-all hover:scale-105 gap-2">
            <Link href="/dashboard/projetos/novo">Criar Meu Próximo Evento <ArrowRight className="w-5 h-5" /></Link>
         </Button>
      </div>
    </div>
  )
}
