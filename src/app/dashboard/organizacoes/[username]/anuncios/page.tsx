
"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, addDoc, serverTimestamp, doc, updateDoc, increment, writeBatch } from "firebase/firestore"
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
  BarChart3,
  CreditCard,
  Info,
  Pause,
  Play,
  Users,
  Coins,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ArrowRight,
  XCircle,
  CheckCircle2,
  Lock,
  Globe,
  ImageIcon
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { formatCurrency } from "@/lib/financial-utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"

export default function OrganizationAdsPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  const params = useParams()
  const { currentOrg, userRole, loading: orgLoading, refreshOrg } = useCurrentOrganization()

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

  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [selectedEventId, setSelectedEventId] = React.useState("")
  const [adType, setAdType] = React.useState("evento")
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null)
  const [selectedAdForMetrics, setSelectedAdForMetrics] = React.useState<any>(null)
  const [adToCancel, setAdToCancel] = React.useState<any>(null)

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

  const handleCreateAd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !currentOrg) return

    const formData = new FormData(e.currentTarget)
    const dailyBudget = parseFloat(formData.get("budget") as string) || 0
    const startDateStr = formData.get("startDate") as string
    const endDateStr = formData.get("endDate") as string

    const start = new Date(startDateStr)
    const end = new Date(endDateStr)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
    
    const totalBudget = dailyBudget * days
    const currentBalance = currentOrg.adBalance || 0

    if (totalBudget > currentBalance) {
      toast({ 
        variant: "destructive", 
        title: "Saldo Insuficiente", 
        description: `Esta campanha custará ${formatCurrency(totalBudget)}, mas seu saldo é ${formatCurrency(currentBalance)}.` 
      })
      return
    }

    setIsSubmitting(true)
    const event = myEvents?.find(ev => ev.id === selectedEventId)
    
    // Status baseado no tipo de anúncio
    const status = adType === 'evento' ? 'Ativo' : 'Pendente'

    const adData = {
      eventId: adType === 'evento' ? selectedEventId : null,
      eventTitle: adType === 'evento' ? (event?.title || "Evento") : (formData.get("title") as string),
      externalUrl: adType === 'site' ? (formData.get("url") as string) : null,
      organizationId: currentOrg.id,
      organizerId: user.uid,
      type: adType,
      status: status,
      dailyBudget: dailyBudget,
      initialBudget: totalBudget,
      remainingBudget: totalBudget,
      budget: totalBudget, 
      durationDays: days,
      startDate: startDateStr,
      endDate: endDateStr,
      reach: 0,
      clicks: 0,
      createdAt: serverTimestamp()
    }

    try {
      const batch = writeBatch(db)
      
      // 1. Criar o anúncio
      const adRef = doc(collection(db, "ads"))
      batch.set(adRef, adData)

      // 2. Bloquear o saldo na organização
      const orgRef = doc(db, "organizations", currentOrg.id)
      batch.update(orgRef, {
        adBalance: increment(-totalBudget),
        blockedBalance: increment(totalBudget),
        updatedAt: serverTimestamp()
      })

      // 3. Registrar no histórico financeiro
      const txRef = doc(collection(db, 'organizations', currentOrg.id, 'transactions'))
      batch.set(txRef, {
        type: 'ad_reservation',
        description: `Reserva: ${adData.eventTitle}`,
        amount: totalBudget,
        status: 'completed',
        createdAt: serverTimestamp(),
        userId: user.uid
      })

      await batch.commit()
      await refreshOrg()
      
      toast({ 
        title: status === 'Ativo' ? "Campanha Ativa!" : "Enviado para Aprovação",
        description: status === 'Ativo' ? "Seu evento já está sendo impulsionado." : "Campanhas de banners e sites são revisadas em até 24h."
      })
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

  const handleCancelAd = async () => {
    if (!db || !adToCancel || !currentOrg) return
    
    setActionLoadingId(adToCancel.id)
    try {
      const batch = writeBatch(db)
      const adRef = doc(db, "ads", adToCancel.id)
      const orgRef = doc(db, "organizations", currentOrg.id)
      
      const refundAmount = adToCancel.remainingBudget || 0

      // 1. Marcar anúncio como cancelado
      batch.update(adRef, { 
        status: "Cancelado", 
        remainingBudget: 0,
        updatedAt: serverTimestamp() 
      })

      // 2. Devolver saldo remanescente
      if (refundAmount > 0) {
        batch.update(orgRef, {
          adBalance: increment(refundAmount),
          blockedBalance: increment(-refundAmount),
          updatedAt: serverTimestamp()
        })

        // 3. Registrar estorno no histórico
        const txRef = doc(collection(db, 'organizations', currentOrg.id, 'transactions'))
        batch.set(txRef, {
          type: 'ad_refund',
          description: `Estorno: ${adToCancel.eventTitle}`,
          amount: refundAmount,
          status: 'completed',
          createdAt: serverTimestamp(),
          userId: user?.uid
        })
      } else {
        // Se não tem saldo a devolver, apenas limpa o bloqueado se houver erro de sync
        batch.update(orgRef, {
          blockedBalance: increment(-(adToCancel.remainingBudget || 0))
        })
      }

      await batch.commit()
      await refreshOrg()
      toast({ title: "Campanha cancelada", description: "O saldo remanescente foi devolvido à sua conta." })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao cancelar" })
    } finally {
      setActionLoadingId(null)
      setAdToCancel(null)
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

  if (orgLoading || adsLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-secondary" />
            Conta de Anúncios
          </h1>
          <p className="text-muted-foreground font-medium">Gestão de tráfego para <strong>{currentOrg?.name}</strong>.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" asChild className="rounded-full h-11 px-6 font-bold gap-2 text-xs uppercase border-secondary/20 text-secondary hover:bg-secondary/5">
             <Link href={`/dashboard/organizacoes/${currentOrg?.username}/anuncios/valores`}>
                <Coins className="w-4 h-4" /> Valores
             </Link>
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-secondary text-white font-black rounded-full px-8 h-11 shadow-lg hover:scale-105 transition-transform gap-2 uppercase italic">
                <Plus className="w-5 h-5" /> Nova Campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-[2rem]">
              <form onSubmit={handleCreateAd} className="space-y-6">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Criar Anúncio</DialogTitle>
                  <DialogDescription>Use seu saldo de anúncios para impulsionar sua marca.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">O que deseja divulgar?</Label>
                     <div className="grid grid-cols-3 gap-2">
                        <Button type="button" variant={adType === 'evento' ? 'secondary' : 'outline'} className="h-14 flex-col text-[8px] font-black uppercase gap-1 rounded-xl" onClick={() => setAdType('evento')}>
                           <Calendar className="w-4 h-4" /> Evento
                        </Button>
                        <Button type="button" variant={adType === 'banner' ? 'secondary' : 'outline'} className="h-14 flex-col text-[8px] font-black uppercase gap-1 rounded-xl" onClick={() => setAdType('banner')}>
                           <ImageIcon className="w-4 h-4" /> Banner
                        </Button>
                        <Button type="button" variant={adType === 'site' ? 'secondary' : 'outline'} className="h-14 flex-col text-[8px] font-black uppercase gap-1 rounded-xl" onClick={() => setAdType('site')}>
                           <Globe className="w-4 h-4" /> Site
                        </Button>
                     </div>
                  </div>

                  {adType === 'evento' ? (
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Selecione o Evento</Label>
                      <Select value={selectedEventId} onValueChange={setSelectedEventId} required>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione um evento ativo" /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {myEvents?.map((event: any) => (
                            <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[8px] text-green-600 font-bold uppercase flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> Aprovação Automática</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Título da Campanha</Label>
                        <Input name="title" required className="rounded-xl h-11" placeholder="Ex: Nova Coleção Inverno" />
                      </div>
                      {adType === 'site' && (
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">URL de Destino</Label>
                          <Input name="url" type="url" required className="rounded-xl h-11" placeholder="https://seu-site.com" />
                        </div>
                      )}
                      <p className="text-[8px] text-orange-500 font-bold uppercase flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Requer Aprovação do Admin</p>
                    </>
                  )}

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

                  <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-center justify-between">
                     <div className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase text-muted-foreground">Saldo Disponível</p>
                        <p className="text-sm font-black text-primary">{formatCurrency(currentOrg?.adBalance || 0)}</p>
                     </div>
                     <Link href={`/dashboard/organizacoes/${currentOrg.username}/finance`} className="p-2 bg-white rounded-lg border shadow-sm"><Plus className="w-4 h-4 text-secondary" /></Link>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <><Target className="w-5 h-5 mr-2" /> Lançar Campanha</>}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative group">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Acessos Acumulados</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{(stats.reach + stats.clicks).toLocaleString()}</div>
          </CardContent>
          <Eye className="absolute -bottom-2 -right-2 w-20 h-20 opacity-5 rotate-12" />
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Saldo Disponível</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-foreground">{formatCurrency(currentOrg?.adBalance || 0)}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-secondary">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Saldo em Campanha</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-secondary">{formatCurrency(currentOrg?.blockedBalance || 0)}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Campanhas Ativas</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-primary">{stats.active}</div></CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b pb-6">
           <CardTitle className="text-xl flex items-center gap-2"><BarChart3 className="w-5 h-5 text-secondary" /> Minhas Campanhas</CardTitle>
           <CardDescription>Acompanhe o consumo e performance em tempo real.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {ads.length > 0 ? (
            <div className="divide-y">
              {ads.map((ad: any) => {
                const isFinished = ad.status === 'Finalizado' || ad.status === 'Cancelado';
                return (
                  <div key={ad.id} className={cn(
                    "p-6 flex flex-col gap-6 transition-colors lg:flex-row lg:items-center lg:justify-between hover:bg-muted/10",
                    isFinished && "opacity-50"
                  )}>
                    <div className="flex gap-4 min-w-[250px]">
                      <div className="p-3 rounded-2xl bg-secondary/10 h-fit"><Megaphone className="w-5 h-5 text-secondary" /></div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm uppercase">{ad.eventTitle}</h4>
                          <Badge className={cn(
                            "text-[8px] font-black uppercase h-4", 
                            ad.status === 'Ativo' ? "bg-green-500" : 
                            ad.status === 'Pendente' ? "bg-orange-500" :
                            "bg-muted"
                          )}>{ad.status}</Badge>
                        </div>
                        <div className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-3">
                           <span><Target className="w-2.5 h-2.5 inline mr-1" /> {ad.type}</span>
                           <span><Calendar className="w-2.5 h-2.5 inline mr-1" /> {new Date(ad.startDate).toLocaleDateString('pt-BR')} - {new Date(ad.endDate).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 flex-1 text-center">
                       <div><p className="text-[10px] font-black opacity-40 uppercase">Alcance</p><p className="font-black">{ad.reach?.toLocaleString()}</p></div>
                       <div><p className="text-[10px] font-black opacity-40 uppercase">Cliques</p><p className="font-black">{ad.clicks?.toLocaleString()}</p></div>
                       <div>
                          <p className="text-[10px] font-black text-secondary uppercase">Saldo Restante</p>
                          <p className="font-black text-secondary">{formatCurrency(ad.remainingBudget || 0)}</p>
                       </div>
                    </div>

                    <div className="flex gap-2">
                       <Button variant="outline" size="sm" className="h-9 rounded-xl border-secondary/20 text-secondary" onClick={() => setSelectedAdForMetrics(ad)}><Eye className="w-4 h-4" /></Button>
                       
                       {!isFinished && (
                         <>
                           <Button 
                             variant="outline" 
                             size="sm" 
                             className="h-9 rounded-xl uppercase font-bold text-[10px] gap-2"
                             onClick={() => handleToggleStatus(ad.id, ad.status)}
                             disabled={actionLoadingId === ad.id}
                           >
                              {ad.status === 'Ativo' ? <><Pause className="w-3 h-3" /> Pausar</> : <><Play className="w-3 h-3" /> Ativar</>}
                           </Button>
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10"
                             onClick={() => setAdToCancel(ad)}
                             disabled={actionLoadingId === ad.id}
                           >
                              <XCircle className="w-4 h-4" />
                           </Button>
                         </>
                       )}
                    </div>
                  </div>
                );
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

      {/* MODAL DE MÉTRICAS */}
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
              <p className="text-[9px] text-muted-foreground font-medium italic">Dados baseados em usuários logados. O alcance total inclui visitantes anônimos.</p>
           </div>
        </DialogContent>
      </Dialog>

      {/* ALERT DE CANCELAMENTO COM ESTORNO */}
      <AlertDialog open={!!adToCancel} onOpenChange={(o) => !o && setAdToCancel(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
             <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-destructive/10 rounded-lg text-destructive"><AlertTriangle className="w-6 h-6" /></div>
                <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter">Cancelar Campanha?</AlertDialogTitle>
             </div>
             <AlertDialogDescription className="font-medium">
                Ao cancelar, o anúncio para de ser veiculado e o saldo restante de <strong>{formatCurrency(adToCancel?.remainingBudget || 0)}</strong> será devolvido à conta da marca imediatamente.
             </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
             <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Não, manter</AlertDialogCancel>
             <AlertDialogAction onClick={handleCancelAd} className="bg-destructive text-white rounded-xl font-black uppercase text-[10px] px-8">Confirmar Cancelamento e Estorno</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
