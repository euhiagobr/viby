
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, doc, setDoc, serverTimestamp, where, getDocs, limit, updateDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Users, 
  Plus, 
  Search, 
  Loader2, 
  Ticket, 
  Building2, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  ArrowUpRight,
  Inbox,
  Coins,
  Globe
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import { AffiliateCode, AffiliateCommission } from "@/types/affiliate"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"

export default function AdminAfiliadosPage() {
  const db = useFirestore()
  const { formatPrice } = useCurrency()
  const [search, setSearch] = React.useState("")
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [reportCurrency, setReportCurrency] = React.useState<CurrencyCode>("BRL")

  const affiliatesQuery = useMemoFirebase(() => db ? query(collection(db, "affiliateCodes"), orderBy("createdAt", "desc")) : null, [db])
  const { data: affiliates, loading } = useCollection<AffiliateCode>(affiliatesQuery)

  const commissionsQuery = useMemoFirebase(() => db ? query(collection(db, "affiliate_commissions"), orderBy("createdAt", "desc"), limit(200)) : null, [db])
  const { data: commissions } = useCollection<any>(commissionsQuery)

  const [stats, setStats] = React.useState<Record<string, any>>({
    BRL: { pending: 0, paid: 0, total: 0 },
    USD: { pending: 0, paid: 0, total: 0 },
    EUR: { pending: 0, paid: 0, total: 0 },
    globalTickets: 0,
    totalAffiliates: 0
  })

  React.useEffect(() => {
    if (!commissions) return

    const newStats: any = {
      BRL: { pending: 0, paid: 0, total: 0 },
      USD: { pending: 0, paid: 0, total: 0 },
      EUR: { pending: 0, paid: 0, total: 0 },
      globalTickets: 0,
      totalAffiliates: affiliates?.length || 0
    }

    commissions.forEach((c: any) => {
      const cur = c.currency || 'BRL'
      if (newStats[cur]) {
        if (c.status === 'pending') newStats[cur].pending += c.amount
        if (c.status === 'available') newStats[cur].paid += c.amount // available means earner can use it
        newStats[cur].total += c.amount
      }
      if (c.status !== 'cancelled' && c.status !== 'reversed') {
        newStats.globalTickets += (c.registrationIds?.length || 1)
      }
    })

    setStats(newStats)
  }, [affiliates, commissions])

  const handleCreateAffiliate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || isSubmitting) return

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const code = (formData.get("code") as string).toUpperCase().replace(/\s+/g, "")
    const usernameInput = (formData.get("username") as string).toLowerCase().replace("@", "")

    try {
      const usernameRef = doc(db, "usernames", usernameInput)
      const uSnap = await getDocs(query(collection(db, "usernames"), where("__name__", "==", usernameInput), limit(1)))
      
      if (uSnap.empty) throw new Error("Usuário não encontrado.")
      
      const uData = uSnap.docs[0].data()
      const affiliateData = {
        code,
        userId: uData.uid,
        userName: formData.get("name") as string,
        commissionType: "fixed",
        commissionValue: parseFloat(formData.get("value") as string),
        active: true,
        createdAt: serverTimestamp()
      }

      await setDoc(doc(db, "affiliateCodes", code), affiliateData)
      
      // Inicializa stats se não houver
      const statsRef = doc(db, "affiliate_stats", uData.uid)
      const sSnap = await getDocs(query(collection(db, "affiliate_stats"), where("userId", "==", uData.uid), limit(1)))
      if (sSnap.empty) {
        await setDoc(statsRef, {
          userId: uData.uid,
          totalTicketsSold: 0,
          totalUsersReferred: 0,
          totalOrgsLinked: 0,
          currentLevel: 0,
          balances: {
            BRL: { available: 0, pending: 0, totalEarned: 0, totalWithdrawn: 0 },
            USD: { available: 0, pending: 0, totalEarned: 0, totalWithdrawn: 0 },
            EUR: { available: 0, pending: 0, totalEarned: 0, totalWithdrawn: 0 }
          },
          updatedAt: serverTimestamp()
        })
      }

      toast({ title: "Afiliado cadastrado!" })
      setIsCreateOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async (aff: AffiliateCode) => {
    if (!db) return
    await updateDoc(doc(db, "affiliateCodes", aff.id), { active: !aff.active })
    toast({ title: aff.active ? "Afiliado desativado" : "Afiliado ativado" })
  }

  const filteredAffiliates = (affiliates || []).filter(a => 
    a.userName.toLowerCase().includes(search.toLowerCase()) || 
    a.code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Users className="w-8 h-8 text-secondary" />
            Viby Affiliates Admin
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Gestão de performance e finanças multimoeda.</p>
        </div>
        <div className="flex gap-2">
           <Select value={reportCurrency} onValueChange={(v:any) => setReportCurrency(v)}>
              <SelectTrigger className="w-32 rounded-xl h-12 bg-white border-secondary/20 font-black"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                 <SelectItem value="BRL">BRL (R$)</SelectItem>
                 <SelectItem value="USD">USD ($)</SelectItem>
                 <SelectItem value="EUR">EUR (€)</SelectItem>
              </SelectContent>
           </Select>
           <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg uppercase italic gap-2">
                <Plus className="w-5 h-5" /> Criar Afiliado
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] max-w-md">
              <form onSubmit={handleCreateAffiliate} className="space-y-6">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Novo Afiliado</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                   <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nome Completo</Label><Input name="name" required className="rounded-xl h-11" /></div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Código Único</Label><Input name="code" required placeholder="EX: JU_VIBY" className="rounded-xl h-11 uppercase font-bold" /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Comissão (R$)</Label><Input name="value" type="number" step="0.01" defaultValue="0.50" required className="rounded-xl h-11 font-black" /></div>
                   </div>
                   <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Username na Viby (@)</Label><Input name="username" required placeholder="ex: jureal" className="rounded-xl h-11" /></div>
                </div>
                <DialogFooter><Button type="submit" disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">{isSubmitting ? <Loader2 className="animate-spin" /> : "Ativar Afiliado"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <KPI title="Total Afiliados" value={stats.totalAffiliates} icon={Users} color="blue" />
        <KPI title="Ingressos (Global)" value={stats.globalTickets} icon={Ticket} color="orange" />
        <KPI title={`Bruto (${reportCurrency})`} value={formatPrice(stats[reportCurrency].total, reportCurrency)} icon={Coins} color="secondary" />
        <KPI title={`Pendente (${reportCurrency})`} value={formatPrice(stats[reportCurrency].pending, reportCurrency)} icon={Clock} color="red" />
        <KPI title={`Disponível (${reportCurrency})`} value={formatPrice(stats[reportCurrency].paid, reportCurrency)} icon={CheckCircle2} color="green" />
      </div>

      <Tabs defaultValue="affiliates" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12">
          <TabsTrigger value="affiliates" className="rounded-lg px-8 font-bold gap-2"><Users className="w-4 h-4" /> Afiliados Ativos</TabsTrigger>
          <TabsTrigger value="commissions" className="rounded-lg px-8 font-bold gap-2"><ArrowUpRight className="w-4 h-4" /> Últimas Comissões</TabsTrigger>
        </TabsList>

        <TabsContent value="affiliates">
          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px] p-6">Afiliado / Código</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Comissão Base</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-center">Status</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] p-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
                ) : filteredAffiliates.map(aff => (
                  <TableRow key={aff.id} className="hover:bg-muted/5">
                    <TableCell className="p-6">
                       <div className="flex flex-col">
                          <span className="font-black text-sm uppercase italic text-primary">{aff.userName}</span>
                          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">{aff.code}</span>
                       </div>
                    </TableCell>
                    <TableCell><span className="font-black text-primary">{formatCurrency(aff.commissionValue)}</span></TableCell>
                    <TableCell className="text-center">
                       <Badge className={cn("uppercase text-[8px] font-black h-5", aff.active ? "bg-green-500" : "bg-red-500")}>
                          {aff.active ? "ATIVO" : "INATIVO"}
                       </Badge>
                    </TableCell>
                    <TableCell className="p-6 text-right">
                       <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" className="rounded-xl h-8 font-bold text-[9px] uppercase border" onClick={() => handleToggleStatus(aff)}>
                             {aff.active ? "Pausar" : "Ativar"}
                          </Button>
                       </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="commissions">
           <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <Table>
                 <TableHeader className="bg-muted/30">
                    <TableRow>
                       <TableHead className="p-6 font-black uppercase text-[9px]">Data / Ref</TableHead>
                       <TableHead className="font-black uppercase text-[9px]">Afiliado</TableHead>
                       <TableHead className="font-black uppercase text-[9px] text-center">Moeda</TableHead>
                       <TableHead className="text-right font-black uppercase text-[9px] p-6">Valor Comissão</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {(commissions || []).map(comm => (
                      <TableRow key={comm.id} className={cn("hover:bg-muted/10", (comm.status === 'reversed' || comm.status === 'cancelled') && "opacity-40 line-through")}>
                         <TableCell className="p-6 text-[10px] font-bold">
                            {comm.createdAt?.toDate ? comm.createdAt.toDate().toLocaleString('pt-BR') : 'agora'}
                         </TableCell>
                         <TableCell><span className="text-[10px] font-black uppercase text-secondary">{comm.affiliateId?.slice(0,8)}...</span></TableCell>
                         <TableCell className="text-center"><Badge variant="outline" className="text-[8px] font-black">{comm.currency || 'BRL'}</Badge></TableCell>
                         <TableCell className="text-right p-6 font-black text-green-600">{formatPrice(comm.amount, comm.currency)}</TableCell>
                      </TableRow>
                    ))}
                 </TableBody>
              </Table>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function KPI({ title, value, icon: Icon, color }: any) {
  const colors: any = { blue: "bg-blue-50 text-blue-600", secondary: "bg-secondary/5 text-secondary", orange: "bg-orange-50 text-orange-600", red: "bg-red-50 text-red-600", green: "bg-green-50 text-green-600" };
  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden">
       <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
             <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{title}</p>
             <div className={cn("p-2 rounded-xl", colors[color])}><Icon className="w-3.5 h-3.5" /></div>
          </div>
          <div className="text-lg font-black text-primary">{value}</div>
       </CardContent>
    </Card>
  )
}
