"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase, useFirebaseApp } from "@/firebase"
import { collection, query, where, doc } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { 
  Megaphone, 
  Plus, 
  TrendingUp, 
  Eye, 
  Target, 
  Loader2, 
  Calendar,
  BarChart3,
  Coins,
  Clock,
  ArrowRight,
  XCircle,
  ImageIcon,
  Camera,
  Layout,
  Wallet,
  MousePointer2,
  Inbox,
  Info,
  Globe,
  CheckCircle2,
  Users,
  Zap,
  CreditCard,
  Edit,
  Save,
  ShieldAlert,
  ArrowUpRight,
  UserCircle
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
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { formatCurrency } from "@/lib/financial-utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { createAdAction, updateAdAction } from "@/app/actions/ads"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function OrganizationAdsPage() {
  const db = useFirestore()
  const auth = useAuth()
  const app = useFirebaseApp()
  const { user } = useUser(auth)
  const { currentOrg, loading: orgLoading, refreshOrg } = useCurrentOrganization()

  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app);
  }, [app]);

  const adsQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null
    return query(collection(db, "ads"), where("organizationId", "==", currentOrg.id))
  }, [db, currentOrg?.id])

  const { data: rawAds, loading: adsLoading } = useCollection<any>(adsQuery)

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
  const [editingAd, setEditingAd] = React.useState<any>(null)
  const [selectedAdForMetrics, setSelectedAdForMetrics] = React.useState<any>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [adType, setAdType] = React.useState("evento")
  const [selectedEventId, setSelectedEventId] = React.useState("")
  const [dailyBudgetInput, setDailyBudgetInput] = React.useState("10.00")
  const [startDateInput, setStartDateInput] = React.useState("")
  const [endDateInput, setEndDateInput] = React.useState("")
  const [adImageUrl, setAdImageUrl] = React.useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)

  const [editForm, setEditForm] = React.useState({ title: "", url: "" })

  const adPlanSummary = React.useMemo(() => {
    const daily = parseFloat(dailyBudgetInput) || 0
    if (!startDateInput || !endDateInput) return { daily, totalDays: 0, totalReserved: 0 }
    
    const start = new Date(startDateInput)
    const end = new Date(endDateInput)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return { daily, totalDays: 0, totalReserved: 0 }
    
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
    const totalReserved = daily * totalDays

    return { daily, totalDays, totalReserved }
  }, [dailyBudgetInput, startDateInput, endDateInput])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage || !currentOrg) return;
    setUploadProgress(0);
    try {
      const fileName = `ads/${currentOrg.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on('state_changed', 
        (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), 
        () => { setUploadProgress(null); toast({ variant: "destructive", title: "Erro no upload" }); },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setAdImageUrl(downloadURL); 
          setUploadProgress(null);
        }
      );
    } catch (err) { setUploadProgress(null) }
  };

  const handleCreateAd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !currentOrg) return
    const formData = new FormData(e.currentTarget)
    
    if (adPlanSummary.totalDays <= 0) { toast({ variant: "destructive", title: "Datas inválidas" }); return; }
    if (adPlanSummary.totalReserved > (currentOrg.adBalance || 0)) { toast({ variant: "destructive", title: "Saldo Insuficiente" }); return; }

    setIsSubmitting(true)
    
    try {
      const result = await createAdAction({
        orgId: currentOrg.id,
        userId: user.uid,
        title: adType === 'evento' ? (myEvents?.find(ev => ev.id === selectedEventId)?.title || "Evento") : (formData.get("title") as string),
        type: adType,
        dailyBudget: adPlanSummary.daily,
        startDate: startDateInput,
        endDate: endDateInput,
        eventId: adType === 'evento' ? selectedEventId : null,
        externalUrl: formData.get("url") as string || null,
        adImage: adImageUrl
      });

      if (result.success) {
        toast({ title: "Campanha Lançada!", description: "Aguardando aprovação administrativa." });
        setIsCreateDialogOpen(false);
        refreshOrg();
      } else {
        toast({ variant: "destructive", title: "Erro ao criar", description: result.error });
      }
    } catch (error: any) { 
      toast({ variant: "destructive", title: "Falha crítica no servidor" }) 
    } finally { 
      setIsSubmitting(false) 
    }
  }

  const handleUpdateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAd || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await updateAdAction({
        adId: editingAd.id,
        title: editForm.title,
        externalUrl: editForm.url,
        adImage: adImageUrl || editingAd.adImage
      });

      if (result.success) {
        const msg = (editingAd.type === 'banner' || editingAd.type === 'site') 
          ? "Alterações salvas. O anúncio passará por moderação novamente."
          : "Anúncio atualizado com sucesso!";
        
        toast({ title: "Sucesso!", description: msg });
        setEditingAd(null);
        refreshOrg();
      } else {
        toast({ variant: "destructive", title: "Erro ao salvar", description: result.error });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Erro no servidor" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const openEdit = (ad: any) => {
    setEditingAd(ad);
    setEditForm({ title: ad.eventTitle || "", url: ad.externalUrl || "" });
    setAdImageUrl(ad.adImage || null);
  }

  const metricsStats = React.useMemo(() => {
    if (!ads) return { reach: 0, uniqueReach: 0, clicks: 0, active: 0, avgCtr: 0 }
    const res = ads.reduce((acc, ad) => {
      acc.reach += (ad.reach || 0); 
      acc.uniqueReach += (ad.uniqueReach || 0);
      acc.clicks += (ad.clicks || 0);
      if (ad.status === 'Ativo') acc.active++; 
      return acc
    }, { reach: 0, uniqueReach: 0, clicks: 0, active: 0 })
    const ctr = res.reach > 0 ? (res.clicks / res.reach) * 100 : 0
    return { ...res, avgCtr: ctr }
  }, [ads])

  if (orgLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-secondary" /></div>

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-secondary" /> Conta de Anúncios
          </h1>
          <p className="text-muted-foreground font-medium">Gestão de tráfego para <strong>{currentOrg?.name}</strong>.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild className="rounded-full h-11 px-6 font-bold gap-2 text-xs uppercase border-secondary/20 text-secondary">
             <Link href={`/dashboard/organizacoes/${currentOrg?.username}/anuncios/valores`}><Coins className="w-4 h-4" /> Tabela de Valores</Link>
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild><Button className="bg-secondary text-white font-black rounded-full px-8 h-11 shadow-lg gap-2 uppercase italic hover:scale-105 transition-transform"><Plus className="w-5 h-5" /> Nova Campanha</Button></DialogTrigger>
            <DialogContent className="max-w-md h-[90vh] p-0 overflow-hidden rounded-[2.5rem] flex flex-col">
              <DialogHeader className="p-8 border-b bg-muted/30"><DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Lançar Campanha</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateAd} className="flex-1 overflow-y-auto p-8 space-y-8">
                  <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Objetivo do Anúncio</Label>
                     <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant={adType === 'evento' ? 'secondary' : 'outline'} className="h-16 flex-col text-[8px] font-black uppercase gap-1 rounded-xl" onClick={() => setAdType('evento')}><Calendar className="w-4 h-4" /> Evento</Button>
                        <Button type="button" variant={adType === 'pagina' ? 'secondary' : 'outline'} className="h-16 flex-col text-[8px] font-black uppercase gap-1 rounded-xl" onClick={() => setAdType('pagina')}><Layout className="w-4 h-4" /> Perfil Marca</Button>
                        <Button type="button" variant={adType === 'banner' ? 'secondary' : 'outline'} className="h-16 flex-col text-[8px] font-black uppercase gap-1 rounded-xl" onClick={() => setAdType('banner')}><ImageIcon className="w-4 h-4" /> Banner</Button>
                        <Button type="button" variant={adType === 'site' ? 'secondary' : 'outline'} className="h-16 flex-col text-[8px] font-black uppercase gap-1 rounded-xl" onClick={() => setAdType('site')}><Globe className="w-4 h-4" /> Link Externo</Button>
                     </div>
                  </div>
                  {adType === 'evento' ? (
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Escolher Evento Ativo</Label>
                    <Select value={selectedEventId} onValueChange={setSelectedEventId} required><SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Escolha um evento" /></SelectTrigger><SelectContent className="rounded-xl">{myEvents?.map((ev: any) => (<SelectItem key={ev.id} value={ev.id}>{ev.title}</SelectItem>))}</SelectContent></Select></div>
                  ) : adType === 'pagina' ? (
                    <div className="p-4 bg-muted/50 rounded-2xl border border-dashed flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500" /><p className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">Promoveremos sua página @{currentOrg?.username} no feed público.</p></div>
                  ) : (
                    <><div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Título da Campanha</Label><Input name="title" required className="rounded-xl h-11" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Link de Destino</Label><Input name="url" type="url" placeholder="https://..." className="rounded-xl h-11" /></div>
                    <div className="space-y-3"><Label className="text-[10px] font-black uppercase opacity-60">Imagem Criativa</Label><div className="relative aspect-video bg-muted rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden cursor-pointer" onClick={() => document.getElementById('ad-image-up')?.click()}>
                    {adImageUrl ? <img src={adImageUrl} className="w-full h-full object-cover" /> : <div className="text-center opacity-40"><Camera className="w-8 h-8 mx-auto mb-2" /><p className="text-[8px] font-black uppercase">Carregar mídia</p></div>}
                    <input id="ad-image-up" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} /></div>{uploadProgress !== null && <Progress value={uploadProgress} className="h-1" />}</div></>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Data de Início</Label><Input name="startDate" type="datetime-local" value={startDateInput} onChange={e => setStartDateInput(e.target.value)} required className="rounded-xl h-11 text-xs" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Data de Término</Label><Input name="endDate" type="datetime-local" value={endDateInput} onChange={e => setEndDateInput(e.target.value)} required className="rounded-xl h-11 text-xs" /></div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Orçamento Diário Pretendido</Label>
                       <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-secondary">R$</span>
                          <Input 
                            name="budget" 
                            type="number" 
                            step="0.01" 
                            value={dailyBudgetInput}
                            onChange={e => setDailyBudgetInput(e.target.value)}
                            required 
                            className="rounded-2xl h-14 pl-12 text-xl font-black border-secondary/20" 
                          />
                       </div>
                    </div>

                    <div className="p-6 bg-secondary/5 rounded-[2rem] border-2 border-dashed border-secondary/20 space-y-4 animate-in slide-in-from-top-2 duration-300">
                         <div className="flex justify-between items-center">
                            <span className="text-xs font-black uppercase italic text-primary">Reserva Total de Saldo:</span> 
                            <span className="text-2xl font-black text-secondary">{formatCurrency(adPlanSummary.totalReserved)}</span>
                         </div>
                    </div>
                  </div>
              </form>
              <div className="p-8 border-t bg-muted/30">
                <Button 
                  onClick={(e:any) => e.target.closest('div').previousSibling.requestSubmit()}
                  type="button" 
                  disabled={isSubmitting || adPlanSummary.totalReserved > (currentOrg?.adBalance || 0)} 
                  className="w-full bg-secondary text-white font-black h-16 rounded-[2rem] shadow-xl uppercase italic text-lg"
                >
                  {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : "Solicitar Campanha"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* MODAL DE EDIÇÃO */}
      <Dialog open={!!editingAd} onOpenChange={(o) => !o && setEditingAd(null)}>
         <DialogContent className="max-w-md h-[80vh] p-0 overflow-hidden rounded-[2.5rem] flex flex-col">
            <DialogHeader className="p-8 border-b bg-muted/30">
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Editar Anúncio</DialogTitle>
               <DialogDescription className="font-bold text-secondary uppercase text-[10px]">Alteração de criativos e metas</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateAd} className="flex-1 overflow-y-auto p-8 space-y-6">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Título / Nome</Label>
                  <Input 
                    value={editForm.title} 
                    onChange={e => setEditForm({...editForm, title: e.target.value})}
                    required
                    className="rounded-xl h-11"
                  />
               </div>

               {(editingAd?.type === 'banner' || editingAd?.type === 'site') && (
                 <>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Link de Destino</Label>
                       <Input 
                         value={editForm.url} 
                         onChange={e => setEditForm({...editForm, url: e.target.value})}
                         placeholder="https://..."
                         className="rounded-xl h-11"
                       />
                    </div>
                    <div className="space-y-3">
                       <Label className="text-[10px] font-black uppercase opacity-60">Imagem Criativa</Label>
                       <div className="relative aspect-video bg-muted rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden cursor-pointer" onClick={() => document.getElementById('ad-image-edit-up')?.click()}>
                          {adImageUrl ? <img src={adImageUrl} className="w-full h-full object-cover" /> : <div className="text-center opacity-40"><Camera className="w-8 h-8 mx-auto mb-2" /><p className="text-[8px] font-black uppercase">Trocar imagem</p></div>}
                          <input id="ad-image-edit-up" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                       </div>
                       {uploadProgress !== null && <Progress value={uploadProgress} className="h-1" />}
                    </div>

                    <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200 flex items-start gap-3">
                       <ShieldAlert className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                       <p className="text-[10px] text-orange-700 font-bold uppercase leading-tight">
                         Aviso: Ao editar este anúncio de divulgação, ele será pausado e enviado para nova aprovação do suporte.
                       </p>
                    </div>
                 </>
               )}

               {editingAd?.type === 'evento' && (
                  <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
                     <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                     <p className="text-[10px] text-secondary font-bold uppercase leading-tight">
                        Este anúncio está vinculado a um evento. Para mudar a imagem ou datas, edite o projeto principal.
                     </p>
                  </div>
               )}
            </form>
            <div className="p-8 border-t bg-muted/30">
               <Button type="submit" onClick={handleUpdateAd} disabled={isSubmitting || uploadProgress !== null} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Salvar Alterações"}
               </Button>
            </div>
         </DialogContent>
      </Dialog>

      {/* MODAL DE MÉTRICAS */}
      <Dialog open={!!selectedAdForMetrics} onOpenChange={(o) => !o && setSelectedAdForMetrics(null)}>
         <DialogContent className="max-w-2xl h-[85vh] p-0 overflow-hidden rounded-[2.5rem] flex flex-col">
            <DialogHeader className="p-8 border-b bg-muted/30">
               <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                     <div className="p-3 bg-secondary/10 rounded-2xl text-secondary">
                        <TrendingUp className="w-6 h-6" />
                     </div>
                     <div>
                        <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Performance: {selectedAdForMetrics?.eventTitle}</DialogTitle>
                        <DialogDescription className="font-bold text-secondary uppercase text-[10px] tracking-widest">Relatório Analítico de Campanha</DialogDescription>
                     </div>
                  </div>
                  <Badge className="bg-secondary text-white font-black uppercase text-[8px] h-5">{selectedAdForMetrics?.status}</Badge>
               </div>
            </DialogHeader>
            
            <ScrollArea className="flex-1">
               <div className="p-8 space-y-10">
                  {/* KPI Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <AdStat label="Visualizações" value={selectedAdForMetrics?.reach || 0} icon={Eye} />
                     <AdStat label="Alcance Único" value={selectedAdForMetrics?.uniqueReach || 0} icon={Users} />
                     <AdStat label="Cliques" value={selectedAdForMetrics?.clicks || 0} icon={MousePointer2} />
                     <AdStat 
                        label="Taxa (CTR)" 
                        value={((selectedAdForMetrics?.clicks || 0) / (selectedAdForMetrics?.reach || 1) * 100).toFixed(2) + "%"} 
                        icon={Zap} 
                     />
                  </div>

                  <Separator className="border-dashed" />

                  {/* Budget Health */}
                  <div className="space-y-6">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Wallet className="w-3 h-3" /> Consumo de Orçamento
                     </h4>
                     <div className="p-6 bg-muted/30 rounded-3xl border space-y-4">
                        <div className="flex justify-between items-end">
                           <div className="space-y-1">
                              <p className="text-[8px] font-black uppercase opacity-40">Saldo Restante</p>
                              <p className="text-3xl font-black text-primary">{formatCurrency(selectedAdForMetrics?.remainingBudget || 0)}</p>
                           </div>
                           <p className="text-xs font-bold text-muted-foreground">De {formatCurrency(selectedAdForMetrics?.initialBudget || 0)}</p>
                        </div>
                        <div className="space-y-2">
                           <div className="flex justify-between text-[9px] font-black uppercase">
                              <span>Consumido: {Math.round((1 - (selectedAdForMetrics?.remainingBudget / selectedAdForMetrics?.initialBudget)) * 100)}%</span>
                           </div>
                           <Progress value={(1 - (selectedAdForMetrics?.remainingBudget / selectedAdForMetrics?.initialBudget)) * 100} className="h-2" />
                        </div>
                     </div>
                  </div>

                  {/* Demographic Placeholder */}
                  <div className="space-y-6">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Target className="w-3 h-3" /> Perfil de Audiência
                     </h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl border flex items-center gap-3">
                           <div className="p-2 bg-pink-50 text-pink-500 rounded-lg"><UserCircle className="w-4 h-4" /></div>
                           <div className="flex-1">
                              <p className="text-[8px] font-black uppercase opacity-40">Masculino</p>
                              <div className="flex items-center gap-2">
                                 <span className="text-sm font-bold">{selectedAdForMetrics?.stats_gender_masculino || 0}</span>
                                 <Progress value={(selectedAdForMetrics?.stats_gender_masculino / (selectedAdForMetrics?.uniqueReach || 1)) * 100} className="h-1 flex-1" />
                              </div>
                           </div>
                        </div>
                        <div className="p-4 rounded-2xl border flex items-center gap-3">
                           <div className="p-2 bg-purple-50 text-purple-500 rounded-lg"><UserCircle className="w-4 h-4" /></div>
                           <div className="flex-1">
                              <p className="text-[8px] font-black uppercase opacity-40">Feminino</p>
                              <div className="flex items-center gap-2">
                                 <span className="text-sm font-bold">{selectedAdForMetrics?.stats_gender_feminino || 0}</span>
                                 <Progress value={(selectedAdForMetrics?.stats_gender_feminino / (selectedAdForMetrics?.uniqueReach || 1)) * 100} className="h-1 flex-1" />
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
                     <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                     <p className="text-[9px] text-secondary font-bold uppercase leading-tight italic">
                        Os dados demográficos são capturados de forma anônima com base no perfil dos usuários logados que visualizaram o anúncio.
                     </p>
                  </div>
               </div>
            </ScrollArea>
            <DialogFooter className="p-6 border-t">
               <Button onClick={() => setSelectedAdForMetrics(null)} className="w-full bg-primary text-white font-black h-12 rounded-xl uppercase italic">Fechar Relatório</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative group">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Visualizações</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black">{metricsStats.reach.toLocaleString()}</div></CardContent>
          <Eye className="absolute -bottom-2 -right-2 w-20 h-20 opacity-5 rotate-12" />
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-secondary">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Alcance Único</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-secondary">{metricsStats.uniqueReach.toLocaleString()}</div></CardContent>
          <Users className="absolute -bottom-2 -right-2 w-16 h-16 opacity-5 rotate-12" />
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-primary">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cliques</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-primary">{metricsStats.clicks.toLocaleString()}</div></CardContent>
          <MousePointer2 className="absolute -bottom-2 -right-2 w-16 h-16 opacity-5 rotate-12" />
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">CTR Médio</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black">{metricsStats.avgCtr.toFixed(2)}%</div></CardContent>
          <TrendingUp className="absolute -bottom-2 -right-2 w-16 h-16 opacity-5 rotate-12" />
        </Card>
        <Card className="border-none shadow-sm bg-secondary text-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Saldo Disponível</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-black">{formatCurrency(currentOrg?.adBalance || 0)}</div></CardContent>
          <Wallet className="absolute -bottom-2 -right-2 w-16 h-16 opacity-5 rotate-12" />
        </Card>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b pb-6 p-8">
           <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
             <BarChart3 className="w-5 h-5 text-secondary" /> Minhas Campanhas
           </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ads.length > 0 ? (
            <div className="w-full overflow-x-auto">
                <div className="divide-y">
                   {ads.map((ad: any) => {
                     const ctr = ad.reach > 0 ? (ad.clicks / ad.reach) * 100 : 0;
                     return (
                       <div key={ad.id} className="px-8 py-6 grid grid-cols-12 gap-4 items-center transition-colors hover:bg-muted/5">
                         <div className="col-span-4 flex gap-3">
                           <div className="p-2.5 rounded-xl bg-secondary/10 h-fit">
                             <Megaphone className="w-4 h-4 text-secondary" />
                           </div>
                           <div className="space-y-1">
                             <div className="flex items-center gap-2">
                               <h4 className="font-bold text-xs uppercase truncate max-w-[150px]">{ad.eventTitle}</h4>
                               <Badge className={cn("text-[7px] font-black uppercase h-3.5 px-1", ad.status === 'Ativo' ? "bg-green-50 text-green-600 border-green-200" : ad.status === 'Pendente' ? "bg-orange-50 text-orange-600 border-orange-200" : "bg-muted")}>{ad.status}</Badge>
                             </div>
                             <p className="text-[9px] font-bold text-muted-foreground uppercase">{ad.type}</p>
                           </div>
                         </div>
                         <div className="col-span-2 text-center"><p className="text-[8px] uppercase opacity-40">Visu / Cliques</p><span className="font-black text-xs">{ad.reach || 0} / {ad.clicks || 0}</span></div>
                         <div className="col-span-2 text-center"><p className="text-[8px] uppercase opacity-40">CTR</p><span className="font-black text-xs">{ctr.toFixed(2)}%</span></div>
                         <div className="col-span-2 text-right"><p className="text-[8px] uppercase opacity-40">Saldo Restante</p><p className="font-black text-xs text-primary">{formatCurrency(ad.remainingBudget || 0)}</p></div>
                         <div className="col-span-2 flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => openEdit(ad)} title="Editar"><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary" onClick={() => setSelectedAdForMetrics(ad)} title="Métricas"><TrendingUp className="w-4 h-4" /></Button>
                         </div>
                       </div>
                     );
                   })}
                </div>
            </div>
          ) : (
            <div className="py-24 text-center">
              <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-10" />
              <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-xs">Nenhuma campanha registrada.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AdStat({ label, value, icon: Icon }: { label: string, value: string | number, icon: any }) {
   return (
      <div className="p-4 bg-white rounded-2xl border shadow-sm flex flex-col items-center gap-2 text-center">
         <Icon className="w-4 h-4 text-secondary opacity-40" />
         <div>
            <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
            <p className="text-sm font-black text-primary uppercase italic">{value.toLocaleString()}</p>
         </div>
      </div>
   )
}
