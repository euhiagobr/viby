
"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, orderBy, limit, doc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  History, 
  Loader2, 
  Info,
  CreditCard,
  RefreshCw,
  Inbox,
  ArrowLeft,
  ChevronRight
} from "lucide-react"
import { formatCurrency } from "@/lib/financial-utils"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"

export default function CarteiraPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading: profileLoading } = useDoc<any>(userDocRef)

  const transactionsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(
      collection(db, "wallet_transactions"),
      where("userId", "==", user.uid),
      orderBy("timestamp", "desc"),
      limit(50)
    )
  }, [db, user])

  const { data: transactions, loading: txLoading } = useCollection<any>(transactionsQuery)

  if (profileLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  const balance = profile?.walletBalance || 0

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Wallet className="w-8 h-8 text-secondary" />
          Minha Carteira
        </h1>
        <p className="text-muted-foreground font-medium">Gerencie seus créditos e estornos para novas experiências.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* SALDO ATUAL */}
        <Card className="md:col-span-5 border-none shadow-xl rounded-[2.5rem] bg-primary text-white overflow-hidden relative">
          <CardContent className="p-10 flex flex-col justify-between h-full min-h-[250px] relative z-10">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Saldo Disponível</p>
              <h2 className="text-5xl font-black italic tracking-tighter">{formatCurrency(balance)}</h2>
            </div>
            
            <div className="space-y-4">
               <p className="text-xs opacity-70 font-medium">Use seu saldo para abater o valor de qualquer ingresso na A Viby.</p>
               <Button asChild className="w-full bg-secondary text-white font-black h-12 rounded-xl shadow-lg hover:scale-105 transition-transform uppercase italic">
                  <Link href="/dashboard">Explorar Eventos</Link>
               </Button>
            </div>
          </CardContent>
          <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-secondary/20 rounded-full blur-3xl" />
          <Wallet className="absolute top-8 right-8 w-12 h-12 opacity-10" />
        </Card>

        {/* INFO EXTRA */}
        <div className="md:col-span-7 space-y-6">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
              <div className="flex items-start gap-4">
                 <div className="p-3 bg-green-50 rounded-2xl text-green-600">
                    <RefreshCw className="w-6 h-6" />
                 </div>
                 <div className="space-y-1">
                    <h3 className="font-bold text-sm">Estornos Automáticos</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Sempre que um ingresso for estornado pelo organizador, o valor líquido retorna instantaneamente para sua carteira Viby.</p>
                 </div>
              </div>
              <Separator className="border-dashed" />
              <div className="flex items-start gap-4">
                 <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                    <ShieldCheck className="w-6 h-6" />
                 </div>
                 <div className="space-y-1">
                    <h3 className="font-bold text-sm">Compra Segura</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Ao usar o saldo da carteira, seu ingresso é gerado na hora sem depender de operadoras de cartão.</p>
                 </div>
              </div>
           </Card>

           <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
              <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase leading-relaxed">
                 O saldo da carteira não pode ser sacado para contas bancárias externas e é de uso exclusivo para aquisição de novos ingressos na plataforma.
              </p>
           </div>
        </div>
      </div>

      {/* HISTÓRICO DE TRANSAÇÕES */}
      <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="p-8 border-b">
           <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <History className="w-5 h-5 text-secondary" /> Extrato da Carteira
           </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
           {txLoading ? (
             <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
           ) : transactions && transactions.length > 0 ? (
             <div className="divide-y divide-border/50">
                {transactions.map((tx: any) => {
                  const isCredit = tx.type === 'credit';
                  const date = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date(tx.timestamp);
                  return (
                    <div key={tx.id} className="p-6 flex items-center justify-between hover:bg-muted/5 transition-colors">
                       <div className="flex items-center gap-4">
                          <div className={cn(
                            "p-3 rounded-2xl",
                            isCredit ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
                          )}>
                             {isCredit ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                          </div>
                          <div>
                             <p className="text-sm font-bold text-primary uppercase">{tx.description || (isCredit ? 'Crédito Recebido' : 'Pagamento Realizado')}</p>
                             <p className="text-[10px] font-bold text-muted-foreground uppercase">
                                {date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                             </p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className={cn(
                            "text-lg font-black",
                            isCredit ? "text-green-600" : "text-primary"
                          )}>
                             {isCredit ? "+" : "-"}{formatCurrency(tx.amount)}
                          </p>
                          <Badge variant="ghost" className="text-[8px] font-black uppercase opacity-40 p-0 h-auto">Consolidado</Badge>
                       </div>
                    </div>
                  );
                })}
             </div>
           ) : (
             <div className="py-32 text-center space-y-4">
                <Inbox className="w-12 h-12 text-muted-foreground opacity-10 mx-auto" />
                <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Nenhuma movimentação registrada.</p>
             </div>
           )}
        </CardContent>
      </Card>
    </div>
  )
}
