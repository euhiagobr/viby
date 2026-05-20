
"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, addDoc, serverTimestamp, doc, orderBy } from "firebase/firestore"
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
  MousePointer2, 
  Target, 
  Loader2, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  Search,
  Filter
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
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function AnunciosPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading: profileLoading } = useDoc<any>(userDocRef)

  // Campanhas de anúncios do organizador
  const adsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "ads"), where("organizerId", "==", user.uid), orderBy("createdAt", "desc"))
  }, [db, user])

  const { data: ads, loading: adsLoading } = useCollection<any>(adsQuery)

  // Eventos para selecionar na criação do anúncio
  const eventsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "events"), where("organizerId", "==", user.uid), where("status", "==", "Ativo"))
  }, [db, user])

  const { data: myEvents } = useCollection<any>(eventsQuery)

  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [selectedEventId, setSelectedEventId] = React.useState("")
  const [adType, setAdType] = React.useState("feed")

  React.useEffect(() => {
    if (!profileLoading && profile && profile.accountType !== 'Empresa') {
      router.push('/dashboard')
    }
  }, [profile, profileLoading, router])

  const handleCreateAd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !selectedEventId) return

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const event = myEvents?.find(ev => ev.id === selectedEventId)

    const adData = {
      eventId: selectedEventId,
      eventTitle: event?.title || "Evento",
      organizerId: user.uid,
      type: adType,
      status: "Pendente", // Precisa de aprovação do admin em um sistema real
      budget: parseFloat(formData.get("budget") as string) || 0,
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
      reach: 0,
      clicks: 0,
      createdAt: serverTimestamp()
    }

    try {
      await addDoc(collection(db, "ads"), adData)
      toast({ title: "Campanha criada!", description: "Seu anúncio foi enviado para análise." })
      setIsCreateDialogOpen(false)
      setSelectedEventId("")
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao criar campanha" })
    } finally {
      setIsSubmitting(false)
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

  if (profileLoading || adsLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-secondary" />
            Central de Anúncios
          </h1>
          <p className="text-muted-foreground font-medium">Impulsione seus eventos para o público certo e aumente suas vendas.</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg hover:scale-105 transition-transform gap-2">
              <Plus className="w-5 h-5" />
              Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-[2.5rem]">
            <form onSubmit={handleCreateAd} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Criar Anúncio</DialogTitle>
                <DialogDescription>Escolha o evento e configure o alcance da sua divulgação.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Evento a Impulsionar</Label>
                  <Select value={selectedEventId} onValueChange={setSelectedEventId} required>
                    <SelectTrigger className="rounded-xl border-dashed border-secondary/30 h-12">
                      <SelectValue placeholder="Selecione um evento ativo" />
                    </SelectTrigger>
                    <SelectContent>
                      {myEvents?.map((event: any) => (
                        <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Tipo de Destaque</Label>
                  <Select value={adType} onValueChange={setAdType} required>
                    <SelectTrigger className="rounded-xl border-dashed border-secondary/30 h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feed">Feed Geral (Maior Alcance)</SelectItem>
                      <SelectItem value="highlight">Destaque de Topo (Banner)</SelectItem>
                      <SelectItem value="target">Público Segmentado (Interesses)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Data Início</Label>
                    <Input name="startDate" type="date" required className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Data Fim</Label>
                    <Input name="endDate" type="date" required className="rounded-xl" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Orçamento Diário (R$)</Label>
                  <Input name="budget" type="number" step="1" placeholder="Ex: 50.00" required className="rounded-xl h-12 text-lg font-bold" />
                </div>
              </div>

              <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex gap-3">
                <Target className="w-5 h-5 text-secondary shrink-0" />
                <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                  Seu anúncio será exibido para usuários com interesses similares ao seu evento na região de {profile?.city}.
                </p>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isSubmitting || !selectedEventId} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Confirmar e Publicar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative group">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-60">Alcance Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{stats.reach.toLocaleString()} <span className="text-xs opacity-40 font-bold uppercase">Impactos</span></div>
            <div className="flex items-center gap-1 mt-2 text-secondary text-[10px] font-black uppercase">
              <TrendingUp className="w-3 h-3" /> +12% esta semana
            </div>
          </CardContent>
          <Eye className="absolute -bottom-2 -right-2 w-20 h-20 opacity-5 rotate-12 group-hover:scale-110 transition-transform" />
        </Card>

        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Interações (Cliques)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{stats.clicks.toLocaleString()}</div>
            <p className="text-[10px] mt-2 font-bold text-muted-foreground uppercase">CTR Médio: {stats.reach > 0 ? ((stats.clicks / stats.reach) * 100).toFixed(1) : 0}%</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Campanhas Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{stats.active}</div>
            <p className="text-[10px] mt-2 font-bold text-muted-foreground uppercase">De {ads?.length || 0} campanhas criadas</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
        <CardHeader className="bg-white border-b pb-6">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-secondary" />
                  Minhas Campanhas
                </CardTitle>
                <CardDescription>Acompanhe o desempenho de cada impulsionamento.</CardDescription>
              </div>
              <div className="flex gap-2">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Buscar campanha..." className="pl-9 h-10 rounded-xl" />
                 </div>
                 <Button variant="outline" size="icon" className="rounded-xl h-10 w-10">
                    <Filter className="w-4 h-4" />
                 </Button>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          {ads && ads.length > 0 ? (
            <div className="divide-y">
              {ads.map((ad: any) => (
                <div key={ad.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-muted/20 transition-colors">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center shrink-0">
                       <Megaphone className="w-6 h-6 text-secondary" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm leading-tight uppercase">{ad.eventTitle}</h4>
                        <Badge className={cn(
                          "text-[8px] font-black uppercase h-4",
                          ad.status === 'Ativo' ? "bg-green-500" :
                          ad.status === 'Pendente' ? "bg-orange-500" : "bg-muted"
                        )}>
                          {ad.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {ad.type}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(ad.startDate).toLocaleDateString()} - {new Date(ad.endDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 md:gap-12">
                    <div className="text-center">
                       <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Alcance</p>
                       <p className="font-black text-sm">{ad.reach?.toLocaleString() || 0}</p>
                    </div>
                    <div className="text-center">
                       <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Cliques</p>
                       <p className="font-black text-sm">{ad.clicks?.toLocaleString() || 0}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Budget Total</p>
                       <p className="font-black text-primary">R$ {ad.budget?.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-24 text-center">
              <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-10" />
              <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Você ainda não tem anúncios ativos.</p>
              <Button variant="link" className="mt-2 text-secondary font-bold" onClick={() => setIsCreateDialogOpen(true)}>Começar meu primeiro anúncio</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="bg-white border-2 border-dashed border-secondary/20 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center gap-8">
        <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center shrink-0">
          <TrendingUp className="w-10 h-10 text-secondary" />
        </div>
        <div className="space-y-2 text-center md:text-left">
          <h3 className="text-xl font-black italic uppercase tracking-tighter">Quer vender 3x mais?</h3>
          <p className="text-sm text-muted-foreground font-medium max-w-xl">
            Anúncios com o selo <strong>Impulsionado pelo Viby</strong> aparecem no topo das buscas e são enviados via notificação push para usuários que seguem categorias similares.
          </p>
        </div>
        <Button variant="outline" className="rounded-xl border-secondary text-secondary font-black uppercase text-xs h-12 px-6 ml-auto">
          Saiba Mais
        </Button>
      </div>
    </div>
  )
}
