
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
  Globe,
  Wand2,
  RefreshCw,
  Settings2
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
import { generatePendingAffiliateCodesAction, reprocessUserAffiliateAction } from "@/app/actions/affiliates"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function AdminAfiliadosPage() {
  const db = useFirestore()
  const { formatPrice } = useCurrency()
  const [search, setSearch] = React.useState("")
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [reportCurrency, setReportCurrency] = React.useState<CurrencyCode>("BRL")
  const [isGenerating, setIsGenerating] = React.useState(false)

  // Coleção de códigos (índice)
  const affiliatesQuery = useMemoFirebase(() => db ? query(collection(db, "affiliateCodes"), orderBy("createdAt", "desc")) : null, [db])
  const { data: affiliates, loading } = useCollection<any>(affiliatesQuery)

  // Coleção de comissões (snake_case conforme padrão multimoeda)
  const commissionsQuery = useMemoFirebase(() => db ? query(collection(db, "affiliate_commissions"), orderBy("createdAt", "desc"), limit(200)) : null, [db])
  const { data: commissions, loading: commissionsLoading } = useCollection<any>(commissionsQuery)

  const [stats, setStats] = React.useState<Record<string, any>>({
    BRL: { pending: 0, available: 0, total: 0 },
    USD: { pending: 0, available: 0, total: 0 },
    EUR: { pending: 0, available: 0, total: 0 },
    globalTickets: 0,
    totalAffiliates: 0
  })

  React.useEffect(() => {
    if (!commissions) return

    const newStats: any = {
      BRL: { pending: 0, available: 0, total: 0 },
      USD: { pending: 0, available: 0, total: 0 },
      EUR: { pending: 0, available: 0, total: 0 },
      globalTickets: 0,
      totalAffiliates: affiliates?.length || 0
    }

    commissions.forEach((c: any) => {
      const cur = c.currency || 'BRL'
      if (newStats[cur]) {
        if (c.status === 'pending') newStats[cur].pending += (c.amount || 0)
        if (c.status === 'available') newStats[cur].available += (c.amount || 0) 
        if (c.status !== 'cancelled' && c.status !== 'reversed') {
           newStats[cur].total += (c.amount || 0)
           newStats.globalTickets += (c.registrationIds?.length || 1)
        }
      }
    })

    setStats(newStats)
  }, [affiliates, commissions])

  const handleGenerateCodes = async () => {
    setIsGenerating(true)
    try {
      const res = await generatePendingAffiliateCodesAction();
      if (res.success) {
        toast({ title: "Processamento concluído", description: `${res.count} códigos gerados.` });
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na geração", description: e.message });
    } finally {
      setIsGenerating(false);
    }
  }

  const handleReprocessUser = async (uid: string) => {
    try {
      const res = await reprocessUserAffiliateAction(uid);
      if (res.success) {
        toast({ title: "Usuário atualizado!" });
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    }
  }

  const handleCreateAffiliate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || isSubmitting) return

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const code = (formData.get("code") as string).replace(/\s+/g, "").toUpperCase()
    const usernameInput = (formData.get("username") as string).toLowerCase().replace("@", "")

    try {
      const q = query(collection(db, "usernames"), where("__name__", "==", usernameInput), limit(1))
      const uSnap = await getDocs(q)
      
      if (uSnap.empty) throw new Error("Usuário não encontrado.")
      
      const uData = uSnap.data() || uSnap.docs[0].data()
      const uid = uData.uid

      const affiliateData = {
        code,
        userId: uid,
        userName: formData.get("name") as string,
        commissionType: "fixed",
        commissionValue: parseFloat(formData.get("value") as string),
        active: true,
        createdAt: serverTimestamp()
      }

      await setDoc(doc(db, "affiliateCodes", code), affiliateData)
      
      // Inicializar estatísticas se necessário
      const statsRef = doc(db, "affiliate_stats", uid)
      const statsSnap = await getDoc(statsRef)
      if (!statsSnap.exists()) {
        await setDoc(statsRef, {
          userId: uid,
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

  const handleToggleStatus = async (aff: any) => {
    if (!db) return
    try {
       await updateDoc(doc(db, "affiliateCodes", aff.id), { active: !aff.active })
       toast({ title: aff.active ? "Afiliado desativado" : "Afiliado ativado" })
    } catch (e) {
       toast({ variant: "destructive", title: "Erro ao atualizar status" })
    }
  }

  const filteredAffiliates = (affiliates || []).filter((a: any) => 
    (a.userName || "").toLowerCase().includes(search.toLowerCase()) || 
    (a.code || "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Users className="w-8 h-8 text-secondary" />
            Viby Affiliates Admin
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Gestão de performance e ferramentas automáticas.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
           <Button 
            variant="outline" 
            onClick={handleGenerateCodes} 
            disabled={isGenerating}
            className="rounded-full h-12 px-6 font-black uppercase text-[10px] gap-2 border-primary text-primary"
           >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              Gerar Códigos Pendentes
           </Button>
           
           <Select value={reportCurrency} onValueChange={(v:any) => setReportCurrency(v)}>
              <SelectTrigger className="w-32 rounded-xl h-12 bg-white border-secondary/20 font-black">
                 <SelectValue />
              </SelectTrigger>
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
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Novo Afiliado</DialogTitle>
                  <DialogDescription className="font-medium">O usuário deve estar cadastrado previamente na Viby.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Nome Completo</Label>
                      <Input name="name" required className="rounded-xl h-11" placeholder="Ex: Julia Silva" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase opacity-60">Código Único</Label>
                         <Input name="code" required placeholder="10 DÍGITOS" className="rounded-xl h-11 uppercase font-bold" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase opacity-60">Comissão ({reportCurrency})</Label>
                         <Input name="value" type="number" step="0.01" defaultValue="0.50" required className="rounded-xl h-11 font-black" />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Username na Viby (@)</Label>
                      <Input name="username" required placeholder="ex: ju_vibe" className="rounded-xl h-11" />
                   </div>
                </div>
                <DialogFooter>
                   <Button type="submit" disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                      {isSubmitting ? <Loader2 className="animate-spin" /> : "Ativar Afiliado"}
                   </Button>
                </DialogFooter>
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
        <KPI title={`Pago / Disp. (${reportCurrency})`} value={formatPrice(stats[reportCurrency].available, reportCurrency)} icon={CheckCircle2} color="green" />
      </div>

      <Tabs defaultValue="affiliates" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12">
          <TabsTrigger value="affiliates" className="rounded-lg px-8 font-bold gap-2 data-[state=active]:bg-white">
            <Users className="w-4 h-4" /> Afiliados Ativos
          </TabsTrigger>
          <TabsTrigger value="commissions" className="rounded-lg px-8 font-bold gap-2 data-[state=active]:bg-white">
            <ArrowUpRight className="w-4 h-4" /> Últimas Comissões
          </TabsTrigger>
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
                ) : filteredAffiliates.length > 0 ? (
                  filteredAffiliates.map(aff => (
                    <TableRow key={aff.id} className={cn("hover:bg-muted/5 transition-colors", !aff.active && "opacity-60")}>
                      <TableCell className="p-6">
                         <div className="flex flex-col">
                            <span className="font-black text-sm uppercase italic text-primary">{aff.userName}</span>
                            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">{aff.code}</span>
                         </div>
                      </TableCell>
                      <TableCell><span className="font-black text-primary">{formatCurrency(aff.commissionValue || 0)}</span></TableCell>
                      <TableCell className="text-center">
                         <Badge className={cn("uppercase text-[8px] font-black h-5", aff.active ? "bg-green-600 text-white" : "bg-red-500 text-white")}>
                            {aff.active ? "ATIVO" : "INATIVO"}
                         </Badge>
                      </TableCell>
                      <TableCell className="p-6 text-right">
                         <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-lg" onClick={() => handleReprocessUser(aff.userId)} title="Sincronizar Código">
                               <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="rounded-xl h-8 font-bold text-[9px] uppercase border" onClick={() => handleToggleStatus(aff)}>
                               {aff.active ? "Pausar" : "Ativar"}
                            </Button>
                         </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                     <TableCell colSpan={4} className="py-20 text-center">
                        <Inbox className="w-12 h-12 text-muted-foreground opacity-10 mx-auto mb-4" />
                        <p className="text-[10px] font-black uppercase text-muted-foreground">Nenhum afiliado localizado.</p>
                     </TableCell>
                  </TableRow>
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
                       <TableHead className="p-6 font-black uppercase text-[9px]">Data / Ref</TableHead>
                       <TableHead className="font-black uppercase text-[9px]">Afiliado</TableHead>
                       <TableHead className="font-black uppercase text-[9px] text-center">Moeda</TableHead>
                       <TableHead className="text-right font-black uppercase text-[9px] p-6">Valor Comissão</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {commissionsLoading ? (
                      <TableRow><TableCell colSpan={4} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
                    ) : (commissions || []).length > 0 ? (
                      commissions.map(comm => (
                        <TableRow key={comm.id} className={cn("hover:bg-muted/10", (comm.status === 'reversed' || comm.status === 'cancelled') && "opacity-40 line-through")}>
                           <TableCell className="p-6 text-[10px] font-bold">
                              {comm.createdAt?.toDate ? comm.createdAt.toDate().toLocaleString('pt-BR') : 'agora'}
                           </TableCell>
                           <TableCell><span className="text-[10px] font-black uppercase text-secondary">{comm.affiliateId?.slice(0,8)}...</span></TableCell>
                           <TableCell className="text-center"><Badge variant="outline" className="text-[8px] font-black border-secondary/20 text-secondary">{comm.currency || 'BRL'}</Badge></TableCell>
                           <TableCell className="text-right p-6 font-black text-green-600">{formatPrice(comm.amount || 0, comm.currency)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                         <TableCell colSpan={4} className="py-20 text-center">
                            <Inbox className="w-12 h-12 text-muted-foreground opacity-10 mx-auto mb-4" />
                            <p className="text-[10px] font-black uppercase text-muted-foreground">Nenhuma comissão registrada.</p>
                         </TableCell>
                      </TableRow>
                    )}
                 </TableBody>
              </Table>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function KPI({ title, value, icon: Icon, color }: any) {
  const colors: any = { 
    blue: "bg-blue-50 text-blue-600", 
    secondary: "bg-secondary/5 text-secondary", 
    orange: "bg-orange-50 text-orange-600", 
    red: "bg-red-50 text-red-600", 
    green: "bg-green-50 text-green-600" 
  };
  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden">
       <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className={cn("p-2.5 rounded-xl", colors[color])}><Icon className="w-4 h-4" /></div>
          </div>
          <div className="space-y-1">
             <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.1em]">{title}</p>
             <div className="text-xl font-black text-primary">{value}</div>
          </div>
       </CardContent>
    </Card>
  )
}
