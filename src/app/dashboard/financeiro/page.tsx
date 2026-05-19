"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, CreditCard, Landmark, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { useRouter } from "next/navigation"

export default function FinanceiroPage() {
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
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Meu Financeiro</h1>
        <p className="text-muted-foreground font-medium">Controle de receitas, repasses e faturamento dos seus eventos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-60">Saldo a Receber</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">R$ 0,00</div>
            <p className="text-[10px] mt-2 font-bold opacity-40 uppercase">Próximo repasse em: --/--</p>
          </CardContent>
          <Wallet className="absolute -bottom-2 -right-2 w-20 h-20 opacity-5 rotate-12" />
        </Card>

        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Faturamento Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">R$ 0,00</div>
            <div className="flex items-center gap-1 mt-2 text-green-500 text-[10px] font-black uppercase">
              <ArrowUpRight className="w-3 h-3" /> 0% este mês
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Ingressos Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">0</div>
            <p className="text-[10px] mt-2 font-bold text-muted-foreground uppercase">Conversão: 0%</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Ticket Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">R$ 0,00</div>
            <p className="text-[10px] mt-2 font-bold text-muted-foreground uppercase">Base: 0 vendas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-secondary" />
              Histórico de Repasses
            </CardTitle>
            <CardDescription>Visualize os pagamentos enviados para sua conta bancária.</CardDescription>
          </CardHeader>
          <CardContent className="py-10 text-center">
            <Landmark className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-10" />
            <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Nenhum repasse registrado ainda.</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] bg-secondary/5 border-2 border-dashed border-secondary/20">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-secondary" />
              Conta para Recebimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Para receber os valores das vendas dos seus ingressos, você precisa configurar uma conta bancária vinculada ao seu CNPJ.
            </p>
            <div className="p-4 bg-white rounded-2xl border border-secondary/10 flex items-center gap-4">
              <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
                <Landmark className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-tighter">Status Bancário</p>
                <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 text-[9px] uppercase font-black">Pendente</Badge>
              </div>
            </div>
            <Button className="w-full bg-secondary text-white font-black rounded-xl h-12 shadow-lg">Configurar Recebimento</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
