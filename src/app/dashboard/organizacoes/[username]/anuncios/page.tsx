"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Megaphone, 
  Plus, 
  TrendingUp, 
  Eye, 
  Target, 
  Loader2, 
  Calendar,
  AlertCircle,
  BarChart3,
  Search,
  Filter,
  CreditCard,
  Info,
  Pause,
  Play,
  Users,
  MoreHorizontal,
  Coins,
  ShieldCheck,
  AlertTriangle,
  Clock
} from "lucide-react"
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { createAdCheckoutSession } from "@/app/actions/stripe"
import { formatCurrency } from "@/lib/financial-utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"

export default function OrganizationAdsPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  const params = useParams()
  const { currentOrg, userRole, loading: orgLoading } = useCurrentOrganization()

  const adsQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null
    return query(collection(db, "ads"), where("organizationId", "==", currentOrg.id))
  }, [db, currentOrg?.id])

  const { data: rawAds, loading: adsLoading, error: adsError } = useCollection<any>(adsQuery)

  const ads = React.useMemo(() => {
    if (!rawAds) return []
    return [...rawAds].sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0
      const timeB = b.createdAt?.seconds || 0
      return timeB - timeA
    })
  }, [rawAds])

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null
    return query(collection(db, "events"), where("organizationId", "==", currentOrg.id), where("status", "==", "Ativo"))
  }, [db, currentOrg?.id])

  const { data: myEvents } = useCollection<any>(eventsQuery)

  const adsSettingsRef = React.useMemo(() => db ? doc(db, 'settings', 'ads') : null, [db])
  const { data: adsSettings } = useDoc<any>(adsSettingsRef)

  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [selectedEventId, setSelectedEventId] = React.useState("")
  const [adType, setAdType] = React.useState("feed")
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null)
  const [selectedAdForMetrics, setSelectedAdForMetrics] = React.useState<any>(null)

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

  const handleCreateAd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !currentOrg || !selectedEventId) return

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const event = myEvents?.find(ev => ev.id === selectedEventId)
    
    const dailyBudget = parseFloat(formData.get("budget") as string) || 0
    const startDateStr = formData.get("startDate") as string
    const endDateStr = formData.get("endDate") as string

    const start = new Date(startDateStr)
    const end = new Date(endDateStr)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
    
    const totalBudget = dailyBudget * days

    const adData = {
      eventId: selectedEventId,
      eventTitle: event?.title || "Evento",
      organizationId: currentOrg.id,
      organizerId: user.uid,
      type: adType,
      status: "Pendente Pagamento",
      dailyBudget: dailyBudget,
      budget: totalBudget, 
      durationDays: days,
      startDate: startDateStr,
      endDate: endDateStr,
      reach: 0,
      clicks: 0,
      createdAt: serverTimestamp()
    }

    try {
      const docRef = await addDoc(collection(db, "ads"), adData)
      
      if (totalBudget > 0) {
        const { url } = await createAdCheckoutSession({
          adId: docRef.id,
          eventTitle: adData.eventTitle,
          userId: user.uid,
          userEmail: user.email!,
          totalAmount: totalBudget * 100
        });

        if (url) {
          window.location.href = url;
          return;
        }
      } else {
        await updateDoc(doc(db, "ads", docRef.id), { status: "Ativo" });
      }

      toast({ title: "Campanha ativa!" })
      setIsCreateDialogOpen(false)
      setSelectedEventId("")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao criar", description: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async (adId: string, currentStatus: string) => {
    if (!db) return
    const newStatus = currentStatus === 'Ativo' ? 'Pausado' : 'Ativo'
    setActionLoadingId(adId)
    try {
      await updateDoc(doc(db, "ads", adId), { status: newStatus, updatedAt: serverTimestamp() })
      toast({ title: `Campanha ${newStatus.toLowerCase()}!` })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar" })
    } finally {
      setActionLoadingId(null)
    }
  }

  const stats = React.useMemo(() => {
    if (!ads) return { reach: 0, clicks: 0, active: 0 }
    return ads.reduce((acc, ad) => {
      acc.reach += (ad.reach || 0)
      acc.clicks += (ad.clicks || 0)
      if (ad.status === 'Ativo') acc.active++
      return acc
    }, { reach: 0, clicks: 0, active: 0 })
  }, [ads])

  const calculateRemainingDaily = (ad: any) => {
    if (!ad.budget || ad.budget <= 0) return 0;
    const now = new Date();
    const end = new Date(ad.endDate);
    end.setHours(23, 59, 59, 999);
    if (now > end) return 0;
    const diffTime = end.getTime() - now.getTime();
    const daysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    return ad.budget / daysRemaining;
  }

  if (orgLoading || adsLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  if (!isAtLeastEditor) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <AlertTriangle className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-bold uppercase italic">Acesso Restrito</h2>
        <p className="text-muted-foreground">Você não tem permissão para gerenciar anúncios nesta marca.</p>
        <Button asChild variant="outline" className="rounded-full mt-4"><Link href={`/dashboard/organizacoes/${currentOrg?.username}`}>Voltar</Link></Button>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-secondary" />
            Anúncios: {currentOrg?.name}
          </h1>
          <p className="text-muted-foreground font-medium">Impulsione seus eventos e alcance o público ideal da plataforma.</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg hover:scale-105 transition-transform gap-2 uppercase italic">
              <Plus className="w-5 h-5" />
              Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-[2rem]">
            <form onSubmit={handleCreateAd} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Criar Anúncio</DialogTitle>
                <DialogDescription>Seu anúncio será exibido para todos os usuários do Viby Club.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Evento a Impulsionar</Label>
                  <Select value={selectedEventId} onValueChange={setSelectedEventId} required>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione um evento ativo" /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {myEvents?.map((event: any) => (
                        <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Tipo de Campanha</Label>
                   <Select value={adType} onValueChange={setAdType}>
                      <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                         <SelectItem value="feed">Destaque no Feed</SelectItem>
                         <SelectItem value="top">Destaque de Topo</SelectItem>
                      </SelectContent>
                   </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Início</Label>
                    <Input name="startDate" type="date" required className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Fim</Label>
                    <Input name="endDate" type="date" required className="rounded-xl" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Orçamento Diário (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-secondary">R$</span>
                    <Input name="budget" type="number" step="0.01" placeholder="50.00" required className="rounded-xl h-12 pl-10 text-lg font-black" />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isSubmitting || !selectedEventId} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <><CreditCard className="w-5 h-5 mr-2" /> Pagar e Ativar</>}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative group">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Alcance Total</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{stats.reach.toLocaleString()} <span className="text-[10px] opacity-40 uppercase">Vozes Impactadas</span></div>
          </CardContent>
          <Eye className="absolute -bottom-2 -right-2 w-20 h-20 opacity-5 rotate-12" />
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cliques em Ingressos</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-foreground">{stats.clicks.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-secondary/10 border-2 border-dashed border-secondary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-secondary tracking-widest flex justify-between">
              Saldo p/ Anúncios
              <Coins className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-primary">{formatCurrency(currentOrg?.adBalance || 0)}</div>
            <Link href={`/dashboard/organizacoes/${currentOrg.username}/finance`} className="text-[9px] font-black uppercase text-secondary hover:underline mt-1 block">Recarregar Saldo</Link>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b pb-6">
           <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2"><BarChart3 className="w-5 h-5 text-secondary" /> Campanhas Ativas</CardTitle>
                <CardDescription>Acompanhe o consumo e performance de cada impulsionamento.</CardDescription>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          {adsError && <div className="p-10 text-center text-destructive">Erro ao carregar dados.</div>}
          {ads.length > 0 ? (
            <div className="divide-y">
              {ads.map((ad: any) => {
                const remainingDaily = calculateRemainingDaily(ad);
                const displayDaily = Math.min(remainingDaily, ad.dailyBudget || Infinity);
                
                return (
                  <div key={ad.id} className="p-6 flex flex-col gap-6 transition-colors lg:flex-row lg:items-center lg:justify-between hover:bg-muted/10">
                    <div className="flex gap-4 min-w-[250px]">
                      <div className="p-3 rounded-2xl bg-secondary/10 h-fit"><Megaphone className="w-5 h-5 text-secondary" /></div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm uppercase">{ad.eventTitle}</h4>
                          <Badge className={cn("text-[8px] font-black uppercase h-4", ad.status === 'Ativo' ? "bg-green-500" : "bg-orange-500")}>{ad.status}</Badge>
                        </div>
                        <div className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-3">
                           <span><Target className="w-2.5 h-2.5 inline mr-1" /> {ad.type}</span>
                           <span><Calendar className="w-2.5 h-2.5 inline mr-1" /> {new Date(ad.startDate).toLocaleDateString('pt-BR')} - {new Date(ad.endDate).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 flex-1 text-center">
                       <div><p className="text-[10px] font-black opacity-40 uppercase">Impactos</p><p className="font-black">{ad.reach?.toLocaleString()}</p></div>
                       <div><p className="text-[10px] font-black opacity-40 uppercase">Cliques</p><p className="font-black">{ad.clicks?.toLocaleString()}</p></div>
                       <div><p className="text-[10px] font-black text-secondary uppercase">Budget Hoje</p><p className="font-black text-secondary">{formatCurrency(displayDaily)}</p></div>
                    </div>

                    <div className="flex gap-2">
                       <Button variant="outline" size="sm" className="h-9 rounded-xl border-secondary/20 text-secondary" onClick={() => setSelectedAdForMetrics(ad)}><Eye className="w-4 h-4" /></Button>
                       {(ad.status === 'Ativo' || ad.status === 'Pausado') && (
                         <Button 
                           variant="outline" 
                           size="sm" 
                           className="h-9 rounded-xl uppercase font-bold text-[10px] gap-2"
                           onClick={() => handleToggleStatus(ad.id, ad.status)}
                           disabled={actionLoadingId === ad.id}
                         >
                            {ad.status === 'Ativo' ? <><Pause className="w-3 h-3" /> Pausar</> : <><Play className="w-3 h-3" /> Reativar</>}
                         </Button>
                       )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-24 text-center">
               <Megaphone className="w-12 h-12 text-muted-foreground opacity-10 mx-auto mb-4" />
               <p className="text-muted-foreground font-bold italic">Nenhum anúncio criado para esta marca.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedAdForMetrics} onOpenChange={(o) => !o && setSelectedAdForMetrics(null)}>
        <DialogContent className="max-w-2xl rounded-[2.5rem]">
           <DialogHeader>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Insights da Campanha</DialogTitle>
              <DialogDescription className="font-medium">{selectedAdForMetrics?.eventTitle}</DialogDescription>
           </DialogHeader>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
              <div className="space-y-6">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Users className="w-4 h-4" /> Distribuição por Sexo</h4>
                 <div className="space-y-4">
                    <DemographicBar label="Masculino" value={selectedAdForMetrics?.stats_gender_masculino || 0} total={selectedAdForMetrics?.reach || 1} color="bg-blue-500" />
                    <DemographicBar label="Feminino" value={selectedAdForMetrics?.stats_gender_feminino || 0} total={selectedAdForMetrics?.reach || 1} color="bg-pink-500" />
                    <DemographicBar label="Outros" value={selectedAdForMetrics?.stats_gender_outros || 0} total={selectedAdForMetrics?.reach || 1} color="bg-purple-500" />
                 </div>
              </div>
              <div className="space-y-6">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4" /> Faixa Etária</h4>
                 <div className="space-y-4">
                    <DemographicBar label="18 - 24" value={selectedAdForMetrics?.stats_age_18_24 || 0} total={selectedAdForMetrics?.reach || 1} color="bg-secondary" />
                    <DemographicBar label="25 - 34" value={selectedAdForMetrics?.stats_age_25_34 || 0} total={selectedAdForMetrics?.reach || 1} color="bg-primary" />
                    <DemographicBar label="35+" value={((selectedAdForMetrics?.stats_age_35_44 || 0) + (selectedAdForMetrics?.stats_age_45plus || 0))} total={selectedAdForMetrics?.reach || 1} color="bg-muted-foreground" />
                 </div>
              </div>
           </div>
           
           <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex gap-3">
              <Info className="w-5 h-5 text-secondary shrink-0" />
              <p className="text-[9px] text-muted-foreground font-medium italic">Dados baseados em usuários logados. Visualizações de visitantes anônimos são contabilizadas no alcance total, mas não no detalhamento demográfico.</p>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DemographicBar({ label, value, total, color }: { label: string, value: number, total: number, color: string }) {
  const percentage = Math.round((value / total) * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-[9px] font-black uppercase">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-primary">{percentage}% ({value})</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full transition-all duration-1000", color)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}
