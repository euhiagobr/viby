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
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Zap,
  CheckCircle2,
  Lock
} from "lucide-react"
import { formatCurrency } from "@/lib/financial-utils"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"

export default function CarteiraPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  // Consultar Wallet (Ledger oficial)
  const walletRef = React.useMemo(() => (db && user) ? doc(db, "wallets", user.uid) : null, [db, user])
  const { data: wallet, loading: walletLoading } = useDoc<any>(walletRef)

  // Consultar Transações
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

  if (walletLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  const balance = wallet?.balance || 0

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/perfil"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <div className="flex flex-col">
           <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
             <Wallet className="w-8 h-8 text-secondary" /> Minha Carteira
           </h1>
           <p className="text-muted-foreground font-medium">Gerencie seu saldo e histórico financeiro.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <Card className="md:col-span-5 border-none shadow-xl rounded-[2.5rem] bg-primary text-white overflow-hidden relative">
          <CardContent className="p-10 flex flex-col justify-between h-full min-h-[250px] relative z-10">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Saldo Disponível</p>
              <h2 className="text-5xl font-black italic tracking-tighter">{formatCurrency(balance)}</h2>
            </div>
            
            <div className="space-y-4">
               <p className="text-[10px] opacity-70 font-medium uppercase leading-tight">Use seu saldo para abater o valor de qualquer ingresso na plataforma Viby.</p>
               <Button asChild className="w-full bg-secondary text-white font-black h-12 rounded-xl shadow-lg hover:scale-105 transition-transform uppercase italic gap-2">
                  <Link href="/dashboard"><Zap className="w-4 h-4 fill-white" /> Explorar Eventos</Link>
               </Button>
            </div>
          </CardContent>
          <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-secondary/20 rounded-full blur-3xl" />
          <Wallet className="absolute top-8 right-8 w-12 h-12 opacity-10" />
        </Card>

        <div className="md:col-span-7 space-y-6">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
              <div className="flex items-start gap-4">
                 <div className="p-3 bg-green-50 rounded-2xl text-green-600"><RotateCcw className="w-6 h-6" /></div>
                 <div className="space-y-1">
                    <h3 className="font-bold text-sm">Estorno Automático</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Cancelamentos devolvem o valor do ingresso instantaneamente para este saldo.</p>
                 </div>
              </div>
              <Separator className="border-dashed" />
              <div className="flex items-start gap-4">
                 <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><ShieldCheck className="w-6 h-6" /></div>
                 <div className="space-y-1">
                    <h3 className="font-bold text-sm">Compra Protegida</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Utilize seu saldo como crédito em novas experiências sem burocracia.</p>
                 </div>
              </div>
           </Card>

           <div className="p-5 bg-orange-50 rounded-[1.5rem] border-2 border-dashed border-orange-200 flex items-start gap-4">
              <Info className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <h4 className="text-[10px] font-black uppercase text-orange-800 italic">Retenção Operacional</h4>
                 <p className="text-[9px] text-orange-700 font-medium leading-tight uppercase">Taxas financeiras (4.99% + R$ 1,00) são retidas pelo gateway e não são reembolsáveis em cancelamentos.</p>
              </div>
           </div>
        </div>
      </div>

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
                          <div className="space-y-0.5">
                             <p className="text-sm font-bold text-primary uppercase">{tx.description}</p>
                             <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{date.toLocaleString('pt-BR')}</span>
                                {tx.metadata?.gatewayFeeRetained > 0 && (
                                   <Badge variant="ghost" className="text-[8px] font-black uppercase opacity-40 p-0 h-auto">Taxa Retida: {formatCurrency(tx.metadata.gatewayFeeRetained)}</Badge>
                                )}
                             </div>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className={cn("text-lg font-black", isCredit ? "text-green-600" : "text-primary")}>
                             {isCredit ? "+" : "-"}{formatCurrency(tx.amount)}
                          </p>
                          <div className="flex items-center justify-end gap-1 opacity-40">
                             <CheckCircle2 className="w-3 h-3" />
                             <span className="text-[8px] font-black uppercase">Consolidado</span>
                          </div>
                       </div>
                    </div>
                  );
                })}
             </div>
           ) : (
             <div className="py-32 text-center space-y-4">
                <Inbox className="w-16 h-16 text-muted-foreground opacity-10 mx-auto" />
                <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Sua carteira ainda não possui movimentações.</p>
             </div>
           )}
        </CardContent>
      </Card>
    </div>
  )
}
