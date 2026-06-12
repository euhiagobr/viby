"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, orderBy, limit, doc, getDocs } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Star, 
  Wallet, 
  TrendingUp, 
  Users, 
  Ticket, 
  Handshake, 
  Copy, 
  Check, 
  History, 
  Inbox, 
  Loader2, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  SendHorizontal,
  Coins,
  LayoutGrid
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/financial-utils"
import { cn } from "@/lib/utils"
import { maskEmail } from "@/lib/crypto-utils"
import { requestPartnerWithdrawalAction } from "@/app/actions/partners"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts'

export default function PartnerPortalPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user, profile } = useUser(auth)
  
  const [activeTab, setActiveTab] = React.useState("overview")
  const [isWithdrawalOpen, setIsWithdrawalOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [copiedLink, setCopiedLink] = React.useState(false)

  // Consultas Principais
  const partnerRef = React.useMemo(() => (db && user) ? doc(db, "partners", user.uid) : null, [db, user])
  const { data: partner, loading: loadingPartner } = useDoc<any>(partnerRef)

  const referralsQuery = useMemoFirebase(() => (db && user) ? query(collection(db, "partner_referrals"), where("partnerId", "==", user.uid), orderBy("referredAt", "desc")) : null, [db, user])
  const { data: referrals, loading: loadingReferrals } = useCollection<any>(referralsQuery)

  const commissionsQuery = useMemoFirebase(() => (db && user) ? query(collection(db, "partner_commissions"), where("partnerId", "==", user.uid), orderBy("createdAt", "desc"), limit(50)) : null, [db, user])
  const { data: commissions, loading: loadingComms } = useCollection<any>(commissionsQuery)

  const withdrawalsQuery = useMemoFirebase(() => (db && user) ? query(collection(db, "partner_withdrawals"), where("partnerId", "==", user.uid), orderBy("requestedAt", "desc")) : null, [db, user])
  const { data: withdrawals } = useCollection<any>(withdrawalsQuery)

  // Resolução de Perfis dos Indicados
  const [referredProfiles, setReferredProfiles] = React.useState<Record<string, any>>({})
  React.useEffect(() => {
    if (!referrals || !db) return
    const fetch = async () => {
      const results: any = {}
      for (const ref of referrals) {
        const uSnap = await getDocs(query(collection(db, "users"), where("__name__", "==", ref.referredUserId), limit(1)))
        if (!uSnap.empty) results[ref.referredUserId] = uSnap.docs[0].data()
      }
      setReferredProfiles(results)
    }
    fetch()
  }, [referrals, db])

  const handleCopyLink = () => {
    if (!partner?.code) return
    const link = `${window.location.origin}/cadastro?ref=${partner.code}`
    navigator.clipboard.writeText(link)
    setCopiedLink(true)
    toast({ title: "Link copiado!" })
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleWithdrawal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || isSubmitting) return
    setIsSubmitting(true)
    
    const formData = new FormData(e.currentTarget)
    try {
      const res = await requestPartnerWithdrawalAction({
        userId: user.uid,
        amount: parseFloat(formData.get("amount") as string),
        pixKey: formData.get("pixKey") as string,
        pixType: formData.get("pixType") as string,
        bankDetails: formData.get("bankDetails") as string
      })
      if (res.success) {
        toast({ title: "Saque solicitado!", description: "Aguarde o processamento em até 48h." })
        setIsWithdrawalOpen(false)
      } else throw new Error(res.error)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro no saque", description: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadingPartner) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-secondary" /></div>
  if (!partner) return <div className="py-20 text-center text-muted-foreground">Perfil de parceiro não localizado.</div>

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Star className="w-8 h-8 text-secondary fill-secondary" />
            Portal do Parceiro
          </h1>
          <p className="text-muted-foreground font-medium">Gestão estratégica de rede e resultados.</p>
        </div>
        <Card className="border-none shadow-xl bg-white p-2 rounded-2xl flex items-center gap-4">
           <div className="px-6 py-2">
              <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1">Seu Código</p>
              <p className="text-xl font-black text-primary italic uppercase tracking-tighter">{partner.code}</p>
           </div>
           <Button onClick={handleCopyLink} className="bg-secondary text-white font-black rounded-xl h-11 px-6 shadow-lg gap-2 uppercase italic text-[10px]">
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Link de Indicação
           </Button>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <KPI label="Saldo Disponível" value={formatCurrency(partner.stats?.availableBalance || 0)} icon={Wallet} color="green" />
         <KPI label="Comissões Pendentes" value={formatCurrency(partner.stats?.pendingBalance || 0)} icon={Clock} color="orange" />
         <KPI label="Total Gerado" value={formatCurrency(partner.stats?.totalEarned || 0)} icon={TrendingUp} color="blue" />
         <KPI label="Vendas Indicadas" value={partner.stats?.salesCount || 0} icon={Ticket} color="secondary" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12 flex-wrap">
          <TabsTrigger value="overview" className="rounded-lg px-8 font-bold gap-2"><LayoutGrid className="w-4 h-4" /> Visão Geral</TabsTrigger>
          <TabsTrigger value="referrals" className="rounded-lg px-8 font-bold gap-2"><Users className="w-4 h-4" /> Meus Indicados</TabsTrigger>
          <TabsTrigger value="commissions" className="rounded-lg px-8 font-bold gap-2"><Coins className="w-4 h-4" /> Comissões</TabsTrigger>
          <TabsTrigger value="wallet" className="rounded-lg px-8 font-bold gap-2"><SendHorizontal className="w-4 h-4" /> Carteira & Saques</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 animate-in fade-in">
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <Card className="lg:col-span-8 border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                 <CardHeader className="bg-muted/30 border-b p-8">
                    <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Performance de Vendas (30 dias)</CardTitle>
                 </CardHeader>
                 <CardContent className="p-8 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={[
                         { name: 'S1', sales: 40 }, { name: 'S2', sales: 65 }, { name: 'S3', sales: 48 }, { name: 'S4', sales: 82 }
                       ]}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                          <XAxis dataKey="name" hide />
                          <YAxis hide />
                          <Tooltip cursor={{fill: 'transparent'}} />
                          <Bar dataKey="sales" fill="hsl(var(--secondary))" radius={[8, 8, 0, 0]} />
                       </BarChart>
                    </ResponsiveContainer>
                 </CardContent>
              </Card>

              <Card className="lg:col-span-4 border-none shadow-xl rounded-[2.5rem] bg-primary text-white overflow-hidden relative">
                 <CardContent className="p-10 flex flex-col justify-between h-full relative z-10">
                    <div className="space-y-6">
                       <div className="p-3 bg-white/10 rounded-2xl w-fit"><ShieldCheck className="w-6 h-6 text-secondary" /></div>
                       <div>
                          <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-tight">Ganhos em D+30</h3>
                          <p className="text-xs font-medium opacity-60 mt-2">Suas comissões seguem o ciclo financeiro oficial da Viby para total segurança operacional.</p>
                       </div>
                    </div>
                    <Button variant="secondary" className="w-full h-12 rounded-xl font-black uppercase italic mt-10" onClick={() => setActiveTab('wallet')}>
                       Acessar Minha Carteira <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                 </CardContent>
                 <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
              </Card>
           </div>
        </TabsContent>

        <TabsContent value="referrals">
           <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <Table>
                 <TableHeader className="bg-muted/30">
                    <TableRow>
                       <TableHead className="font-black uppercase text-[10px] p-6">Organizador</TableHead>
                       <TableHead className="font-black uppercase text-[10px]">Vinculação</TableHead>
                       <TableHead className="font-black uppercase text-[10px]">Expiração (1 Ano)</TableHead>
                       <TableHead className="text-center font-black uppercase text-[10px] p-6">Status</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {referrals && referrals.length > 0 ? referrals.map(ref => {
                      const profile = referredProfiles[ref.referredUserId]
                      const date = ref.referredAt?.toDate ? ref.referredAt.toDate() : new Date(ref.referredAt)
                      const expires = new Date(date)
                      expires.setFullYear(expires.getFullYear() + 1)
                      const isExpired = new Date() > expires

                      return (
                        <TableRow key={ref.id} className="hover:bg-muted/5">
                           <TableCell className="p-6">
                              <div className="flex flex-col">
                                 <span className="font-bold text-sm uppercase italic text-primary">{profile?.name || "Usuário"}</span>
                                 <span className="text-[10px] text-muted-foreground">{maskEmail(profile?.email || "")}</span>
                              </div>
                           </TableCell>
                           <TableCell className="text-xs font-medium">{date.toLocaleDateString('pt-BR')}</TableCell>
                           <TableCell className="text-xs font-medium text-muted-foreground">{expires.toLocaleDateString('pt-BR')}</TableCell>
                           <TableCell className="p-6 text-center">
                              <Badge className={cn("text-[8px] font-black uppercase h-5", isExpired ? "bg-muted" : "bg-green-600")}>{isExpired ? 'Expirado' : 'Ativo'}</Badge>
                           </TableCell>
                        </TableRow>
                      )
                    }) : (
                      <TableRow><TableCell colSpan={4} className="py-24 text-center opacity-30 italic"><Inbox className="w-12 h-12 mx-auto mb-4" />Nenhum indicado ativo.</TableCell></TableRow>
                    )}
                 </TableBody>
              </Table>
           </Card>
        </TabsContent>

        <TabsContent value="commissions">
           <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <Table>
                 <TableHeader className="bg-muted/30">
                    <TableRow>
                       <TableHead className="font-black uppercase text-[10px] p-6">Data / Evento</TableHead>
                       <TableHead className="font-black uppercase text-[10px]">Venda Original</TableHead>
                       <TableHead className="font-black uppercase text-[10px] text-right">Minha Comissão</TableHead>
                       <TableHead className="text-center font-black uppercase text-[10px] p-6">Status</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {commissions && commissions.length > 0 ? commissions.map(comm => (
                      <TableRow key={comm.id} className="hover:bg-muted/5">
                         <TableCell className="p-6">
                            <div className="flex flex-col">
                               <span className="text-[9px] font-black uppercase text-muted-foreground">{new Date(comm.createdAt?.seconds * 1000).toLocaleString('pt-BR')}</span>
                               <span className="font-bold text-xs uppercase text-primary truncate max-w-[200px]">{comm.eventTitle}</span>
                            </div>
                         </TableCell>
                         <TableCell className="text-xs font-medium">{formatCurrency(comm.ticketPrice)}</TableCell>
                         <TableCell className="text-right font-black text-sm text-primary">+{formatCurrency(comm.amount)}</TableCell>
                         <TableCell className="p-6 text-center">
                            <Badge variant="outline" className={cn(
                              "text-[8px] font-black uppercase h-5",
                              comm.status === 'PENDENTE' ? "text-orange-500 border-orange-200" : "text-green-600 border-green-200"
                            )}>{comm.status}</Badge>
                         </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={4} className="py-24 text-center opacity-30 italic"><Inbox className="w-12 h-12 mx-auto mb-4" />Sem comissões recentes.</TableCell></TableRow>
                    )}
                 </TableBody>
              </Table>
           </Card>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-8">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="border-none shadow-2xl rounded-[2.5rem] bg-primary text-white p-10 relative overflow-hidden">
                 <div className="relative z-10 space-y-12">
                    <div className="flex justify-between items-start">
                       <div className="p-4 bg-white/10 rounded-2xl"><Coins className="w-8 h-8 text-secondary" /></div>
                       <Badge className="bg-secondary text-white font-black uppercase text-[9px] h-6 px-4">Saque Mínimo R$ 50,00</Badge>
                    </div>
                    <div className="space-y-2">
                       <p className="text-[10px] font-black uppercase opacity-40 tracking-widest">Disponível para Resgate</p>
                       <p className="text-6xl font-black italic tracking-tighter">{formatCurrency(partner.stats?.availableBalance || 0)}</p>
                    </div>
                    <Dialog open={isWithdrawalOpen} onOpenChange={setIsWithdrawalOpen}>
                       <DialogTrigger asChild>
                          <Button disabled={partner.stats?.availableBalance < 50} className="w-full bg-white text-primary font-black h-16 rounded-2xl shadow-xl uppercase italic text-lg hover:scale-105 transition-all">Solicitar Saque Agora</Button>
                       </DialogTrigger>
                       <DialogContent className="rounded-[2.5rem]">
                          <form onSubmit={handleWithdrawal} className="space-y-6">
                             <DialogHeader><DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Resgatar Comissões</DialogTitle></DialogHeader>
                             <div className="space-y-4">
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Valor do Saque</Label><Input name="amount" type="number" step="0.01" max={partner.stats?.availableBalance} required className="h-12 rounded-xl" /></div>
                                <div className="space-y-2">
                                   <Label className="text-[10px] font-black uppercase opacity-60">Chave PIX</Label>
                                   <Input name="pixKey" required className="h-12 rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                   <Label className="text-[10px] font-black uppercase opacity-60">Tipo de Chave</Label>
                                   <Select name="pixType" defaultValue="cpf">
                                     <SelectTrigger className="h-12 rounded-xl">
                                       <SelectValue />
                                     </SelectTrigger>
                                     <SelectContent className="rounded-xl">
                                       <SelectItem value="cpf">CPF</SelectItem>
                                       <SelectItem value="email">E-mail</SelectItem>
                                       <SelectItem value="random">Aleatória</SelectItem>
                                     </SelectContent>
                                   </Select>
                                </div>
                             </div>
                             <DialogFooter><Button type="submit" disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">{isSubmitting ? <Loader2 className="animate-spin" /> : "Confirmar Solicitação"}</Button></DialogFooter>
                          </form>
                       </DialogContent>
                    </Dialog>
                 </div>
                 <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
              </Card>

              <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
                 <CardHeader className="bg-muted/30 border-b p-8"><CardTitle className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2"><History className="w-5 h-5 text-secondary" /> Histórico de Saques</CardTitle></CardHeader>
                 <CardContent className="p-0">
                    <ScrollArea className="h-[350px]">
                       {withdrawals && withdrawals.length > 0 ? (
                         <div className="divide-y">
                            {withdrawals.map(w => (
                              <div key={w.id} className="p-6 flex items-center justify-between hover:bg-muted/5 transition-colors">
                                 <div className="flex items-center gap-4">
                                    <div className={cn("p-3 rounded-2xl", w.status === 'paid' ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600")}>
                                       {w.status === 'paid' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                    </div>
                                    <div className="flex flex-col">
                                       <span className="text-[9px] font-black text-muted-foreground uppercase">{new Date(w.requestedAt?.seconds * 1000).toLocaleDateString('pt-BR')}</span>
                                       <span className="font-bold text-sm text-primary uppercase italic">Saque #{w.id.slice(-6)}</span>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <p className="font-black text-sm text-primary">{formatCurrency(w.amount)}</p>
                                    <Badge variant="outline" className="text-[7px] font-black uppercase h-4 px-1.5">{w.status}</Badge>
                                 </div>
                              </div>
                            ))}
                         </div>
                       ) : (
                         <div className="p-20 text-center opacity-30 italic"><Inbox className="w-12 h-12 mx-auto mb-4" />Nenhum saque realizado.</div>
                       )}
                    </ScrollArea>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function KPI({ label, value, icon: Icon, color }: any) {
  const colors: any = { 
    green: "bg-green-50 text-green-600", 
    orange: "bg-orange-50 text-orange-600", 
    blue: "bg-blue-50 text-blue-600", 
    secondary: "bg-secondary/5 text-secondary" 
  }
  return (
    <Card className="border-none shadow-sm bg-white group hover:-translate-y-1 transition-all">
       <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className={cn("p-2.5 rounded-2xl transition-transform group-hover:scale-110", colors[color])}><Icon className="w-5 h-5" /></div>
          </div>
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">{label}</p>
          <p className="text-2xl font-black text-primary">{value}</p>
       </CardContent>
    </Card>
  )
}
