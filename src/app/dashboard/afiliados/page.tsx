
"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, orderBy, limit, doc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Handshake, 
  Copy, 
  TrendingUp, 
  Users, 
  Building2, 
  Ticket, 
  Wallet, 
  ArrowUpRight, 
  Loader2, 
  Zap, 
  ShieldCheck, 
  History, 
  ChevronRight,
  Info,
  ExternalLink,
  Target
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import { getAffiliateLevel, getNextLevel, AFFILIATE_LEVELS } from "@/lib/affiliate-utils"
import { formatCurrency } from "@/lib/financial-utils"
import Link from "next/link"
import { requestAffiliatePayout } from "@/app/actions/affiliates"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function AffiliateDashboard() {
  const db = useFirestore()
  const auth = useAuth()
  const { user, profile } = useUser(auth)
  
  const statsRef = React.useMemo(() => (db && user) ? doc(db, "affiliate_stats", user.uid) : null, [db, user])
  const { data: stats, loading: statsLoading } = useDoc<any>(statsRef)

  const commissionsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "affiliate_commissions"), where("affiliateId", "==", user.uid), orderBy("createdAt", "desc"), limit(20))
  }, [db, user])
  const { data: commissions } = useCollection<any>(commissionsQuery)

  const payoutsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "affiliate_payouts"), where("userId", "==", user.uid), orderBy("createdAt", "desc"), limit(10))
  }, [db, user])
  const { data: payouts } = useCollection<any>(payoutsQuery)

  const [isPayoutDialogOpen, setIsPayoutDialogOpen] = React.useState(false)
  const [payoutAmount, setPayoutAmount] = React.useState("")
  const [pixKey, setPixKey] = React.useState("")
  const [pixType, setPixType] = React.useState("cpf")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const affiliateLink = typeof window !== 'undefined' ? `${window.location.origin}/cadastro?ref=${profile?.affiliateCode}` : ""

  const handleCopyLink = () => {
    navigator.clipboard.writeText(affiliateLink)
    toast({ title: "Link copiado!", description: "Agora é só compartilhar e começar a ganhar." })
  }

  const handlePayoutRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || isSubmitting) return
    setIsSubmitting(true)
    try {
      const res = await requestAffiliatePayout({
        userId: user.uid,
        amount: parseFloat(payoutAmount),
        pixKey,
        pixType
      })
      if (res.success) {
        toast({ title: "Saque solicitado!", description: "Nossa equipe analisará o pedido em até 48h." })
        setIsPayoutDialogOpen(false)
      } else throw new Error(res.error)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro no saque", description: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (statsLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-secondary" /></div>

  const currentLevel = getAffiliateLevel(stats?.totalTicketsSold || 0)
  const nextLevel = getNextLevel(stats?.totalTicketsSold || 0)
  const progress = nextLevel ? ((stats?.totalTicketsSold || 0) / nextLevel.minSales) * 100 : 100

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Handshake className="w-8 h-8 text-secondary" />
            Programa de Afiliados
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Sua central de ganhos e indicações Viby.</p>
        </div>
        <Button onClick={handleCopyLink} className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg hover:scale-105 transition-transform gap-2 uppercase italic">
          <Copy className="w-4 h-4" /> Copiar Meu Link
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LADO ESQUERDO: PROGRESSO E LINK */}
        <div className="lg:col-span-8 space-y-8">
           <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden p-1">
              <div className="grid grid-cols-1 md:grid-cols-12">
                 <div className="md:col-span-4 bg-primary p-10 text-white flex flex-col items-center justify-center text-center gap-6 rounded-[2.3rem] relative overflow-hidden">
                    <div className="relative z-10 space-y-2">
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Nível Atual</p>
                       <div className="text-8xl font-black italic tracking-tighter">{currentLevel.level}</div>
                       <Badge className="bg-secondary text-white font-black uppercase italic px-4 py-1 text-[10px] tracking-widest border-none shadow-lg">{currentLevel.label}</Badge>
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
                 </div>
                 <div className="md:col-span-8 p-10 flex flex-col justify-center gap-8">
                    <div className="space-y-4">
                       <div className="flex justify-between items-end">
                          <div className="space-y-1">
                             <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sua Comissão</p>
                             <p className="text-2xl font-black text-primary italic uppercase tracking-tighter">
                                {formatCurrency(currentLevel.commission)} / ingresso
                             </p>
                          </div>
                          {nextLevel && (
                             <div className="text-right">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Próximo Nível</p>
                                <p className="text-xs font-bold text-secondary">{nextLevel.minSales - (stats?.totalTicketsSold || 0)} vendas para {formatCurrency(nextLevel.commission)}</p>
                             </div>
                          )}
                       </div>
                       <Progress value={progress} className="h-3" />
                    </div>
                 </div>
              </div>
           </Card>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard label="Indicados" value={stats?.totalUsersReferred || 0} icon={Users} color="blue" />
              <MetricCard label="Marcas Ativas" value={stats?.totalOrgsLinked || 0} icon={Building2} color="secondary" />
              <MetricCard label="Vendas Totais" value={stats?.totalTicketsSold || 0} icon={Ticket} color="orange" />
           </div>

           <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <CardHeader className="p-8 border-b flex flex-row items-center justify-between">
                 <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                    <History className="w-5 h-5 text-secondary" /> Histórico de Ganhos
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                 <ScrollArea className="h-[400px]">
                    {commissions && commissions.length > 0 ? (
                      <div className="divide-y">
                         {commissions.map((c: any) => (
                           <div key={c.id} className="p-6 flex items-center justify-between hover:bg-muted/5 transition-colors">
                              <div className="flex items-center gap-4">
                                 <div className={cn("p-2 rounded-xl", c.status === 'available' ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600")}>
                                    {c.status === 'available' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                 </div>
                                 <div>
                                    <p className="text-xs font-bold text-primary uppercase">Comissão por Venda</p>
                                    <p className="text-[9px] font-black text-muted-foreground uppercase opacity-60">ID: {c.registrationId?.slice(0, 8)} • {new Date(c.createdAt?.seconds * 1000).toLocaleDateString('pt-BR')}</p>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <p className="text-sm font-black text-primary">{formatCurrency(c.amount)}</p>
                                 <Badge variant="outline" className="text-[7px] font-black uppercase h-4 px-1.5">{c.status}</Badge>
                              </div>
                           </div>
                         ))}
                      </div>
                    ) : (
                      <div className="p-20 text-center space-y-4">
                         <Inbox className="w-12 h-12 mx-auto opacity-10" />
                         <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nenhuma comissão registrada.</p>
                      </div>
                    )}
                 </ScrollArea>
              </CardContent>
           </Card>
        </div>

        {/* LADO DIREITO: CARTEIRA E SAQUE */}
        <div className="lg:col-span-4 space-y-8">
           <Card className="border-none shadow-2xl rounded-[2.5rem] bg-primary text-white p-8 relative overflow-hidden">
              <div className="relative z-10 space-y-10">
                 <div className="flex justify-between items-start">
                    <div className="p-3 bg-white/10 rounded-2xl"><Wallet className="w-6 h-6 text-secondary" /></div>
                    <Badge className="bg-secondary text-white font-black uppercase text-[8px] border-none px-2 h-5">Viby Pay</Badge>
                 </div>
                 
                 <div className="space-y-6">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black uppercase opacity-40 tracking-widest">Saldo Disponível</p>
                       <p className="text-4xl font-black italic tracking-tighter">{formatCurrency(stats?.balanceAvailable || 0)}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] font-black uppercase opacity-40 tracking-widest">Saldo Pendente</p>
                       <p className="text-xl font-bold opacity-80">{formatCurrency(stats?.balancePending || 0)}</p>
                    </div>
                 </div>

                 <Dialog open={isPayoutDialogOpen} onOpenChange={setIsPayoutDialogOpen}>
                    <DialogTrigger asChild>
                       <Button className="w-full bg-white text-primary font-black h-14 rounded-2xl shadow-xl uppercase italic text-sm hover:bg-secondary hover:text-white transition-all">Solicitar Saque</Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[2.5rem] max-w-sm">
                       <form onSubmit={handlePayoutRequest} className="space-y-6">
                          <DialogHeader>
                             <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Resgatar Saldo</DialogTitle>
                             <DialogDescription>O valor será enviado via PIX para sua conta.</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                             <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase opacity-60">Valor do Saque</Label>
                                <Input type="number" step="0.01" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} required className="h-12 rounded-xl text-lg font-black" placeholder="R$ 0,00" />
                             </div>
                             <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase opacity-60">Chave PIX</Label>
                                <Input value={pixKey} onChange={e => setPixKey(e.target.value)} required className="h-12 rounded-xl" />
                             </div>
                             <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase opacity-60">Tipo de Chave</Label>
                                <Select value={pixType} onValueChange={setPixType}>
                                   <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                                   <SelectContent className="rounded-xl">
                                      <SelectItem value="cpf">CPF</SelectItem>
                                      <SelectItem value="email">E-mail</SelectItem>
                                      <SelectItem value="phone">Celular</SelectItem>
                                      <SelectItem value="random">Chave Aleatória</SelectItem>
                                   </SelectContent>
                                </Select>
                             </div>
                          </div>
                          <DialogFooter>
                             <Button type="submit" disabled={isSubmitting || !payoutAmount} className="w-full h-14 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirmar Saque"}
                             </Button>
                          </DialogFooter>
                       </form>
                    </DialogContent>
                 </Dialog>
              </div>
              <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-secondary/10 rounded-full blur-3xl" />
           </Card>

           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-6">Pedidos Recentes</h3>
              <div className="space-y-4">
                 {payouts && payouts.length > 0 ? payouts.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-dashed">
                       <div className="space-y-1">
                          <p className="text-sm font-black text-primary">{formatCurrency(p.amount)}</p>
                          <p className="text-[8px] font-bold text-muted-foreground uppercase">{new Date(p.createdAt?.seconds * 1000).toLocaleDateString('pt-BR')}</p>
                       </div>
                       <Badge className={cn(
                         "text-[7px] font-black uppercase h-5",
                         p.status === 'Pago' ? "bg-green-500" : p.status === 'Pendente' ? "bg-orange-500" : "bg-muted"
                       )}>{p.status}</Badge>
                    </div>
                 )) : (
                   <p className="text-[10px] font-bold text-muted-foreground uppercase italic text-center opacity-40">Nenhum saque solicitado.</p>
                 )}
              </div>
           </Card>

           <div className="p-6 bg-secondary/5 rounded-3xl border-2 border-dashed border-secondary/10 space-y-3">
              <div className="flex items-center gap-2 text-secondary font-black text-[10px] uppercase"><Info className="w-4 h-4" /> Regras de Pagamento</div>
              <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase">As comissões ficam pendentes por 7 dias para segurança contra reembolsos. Saque mínimo de R$ 50,00.</p>
           </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, color }: any) {
   const colors: any = { blue: "bg-blue-50 text-blue-600", secondary: "bg-secondary/5 text-secondary", orange: "bg-orange-50 text-orange-600" };
   return (
      <Card className="border-none shadow-sm bg-white">
         <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
               <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
               <div className={cn("p-2 rounded-xl", colors[color])}><Icon className="w-3.5 h-3.5" /></div>
            </div>
            <div className="text-xl font-black text-primary">{value.toLocaleString()}</div>
         </CardContent>
      </Card>
   )
}
