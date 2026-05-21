
"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase, useFirebaseApp } from "@/firebase"
import { collection, query, where, addDoc, serverTimestamp, doc, updateDoc, increment, writeBatch, getDoc, setDoc } from "firebase/firestore"
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
  ImageIcon,
  Camera,
  Layout,
  RefreshCw,
  Wallet,
  Undo2,
  MousePointer2
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
  const app = useFirebaseApp()
  const { user } = useUser(auth)
  const router = useRouter()
  const params = useParams()
  const { currentOrg, userRole, loading: orgLoading, refreshOrg } = useCurrentOrganization()

  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app, "gs://viby");
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
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [selectedEventId, setSelectedEventId] = React.useState("")
  const [adType, setAdType] = React.useState("evento")
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null)
  const [selectedAdForMetrics, setSelectedAdForMetrics] = React.useState<any>(null)
  const [adToCancel, setAdToCancel] = React.useState<any>(null)

  const [adImageUrl, setAdImageUrl] = React.useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

  React.useEffect(() => {
    if (!db || !rawAds || !currentOrg || isSubmitting) return;

    const finalizeExpiredAds = async () => {
      const now = new Date();
      const expired = rawAds.filter((ad: any) => {
        if (ad.status !== 'Ativo') return false;
        const end = ad.endDate?.toDate ? ad.endDate.toDate() : new Date(ad.endDate);
        return end < now;
      });

      if (expired.length === 0) return;

      const batch = writeBatch(db);
      let totalRefund = 0;

      for (const ad of expired) {
        const refund = Math.max(0, ad.remainingBudget || 0);
        totalRefund += refund;
        batch.update(doc(db, "ads", ad.id), { status: "Finalizado", remainingBudget: 0, refundedAmount: refund, updatedAt: serverTimestamp() });
        batch.set(doc(collection(db, 'organizations', currentOrg.id, 'transactions')), {
          type: 'ad_refund',
          description: `Expirado: ${ad.eventTitle}`,
          amount: refund,
          status: 'completed',
          createdAt: serverTimestamp(),
          userId: user?.uid
        });
      }

      if (totalRefund > 0 || expired.length > 0) {
        batch.update(doc(db, "organizations", currentOrg.id), { adBalance: increment(totalRefund), blockedBalance: increment(-totalRefund), updatedAt: serverTimestamp() });
        try {
          await batch.commit();
          await refreshOrg();
          toast({ title: "Campanhas encerradas", description: `Finalizamos ${expired.length} anúncios que atingiram o prazo. O saldo foi devolvido.` });
        } catch (e) {}
      }
    };
    finalizeExpiredAds();
  }, [rawAds, db, currentOrg?.id, user?.uid, refreshOrg, isSubmitting]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage || !currentOrg) return;
    setUploadProgress(0);
    try {
      const fileName = `ads/${currentOrg.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), () => setUploadProgress(null), async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setAdImageUrl(downloadURL); setUploadProgress(null); toast({ title: "Imagem carregada!" });
      });
    } catch (err) { setUploadProgress(null); }
  };

  const handleCreateAd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !currentOrg) return
    const formData = new FormData(e.currentTarget)
    const dailyBudget = parseFloat(formData.get("budget") as string) || 0
    const start = new Date(formData.get("startDate") as string)
    const end = new Date(formData.get("endDate") as string)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) { toast({ variant: "destructive", title: "Datas inválidas" }); return; }
    const days = Math.max(1, Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    const totalBudget = dailyBudget * days
    if (totalBudget > (currentOrg.adBalance || 0)) { toast({ variant: "destructive", title: "Saldo Insuficiente" }); return; }
    if ((adType === 'banner' || adType === 'site') && !adImageUrl) { toast({ variant: "destructive", title: "Imagem necessária" }); return; }

    setIsSubmitting(true)
    const event = myEvents?.find(ev => ev.id === selectedEventId)
    // Eventos e Páginas são auto-aprovados para o protótipo, mas Banners e Links requerem aprovação
    const status = (adType === 'evento' || adType === 'pagina') ? 'Ativo' : 'Pendente'
    const adData = {
      eventId: adType === 'evento' ? selectedEventId : null,
      eventTitle: adType === 'evento' ? (event?.title || "Evento") : (adType === 'pagina' ? `Promover: ${currentOrg.name}` : (formData.get("title") as string)),
      externalUrl: (adType === 'site' || adType === 'banner') ? (formData.get("url") as string) : null,
      adImage: adImageUrl || (adType === 'pagina' ? currentOrg.avatar : null),
      organizationId: currentOrg.id, organizerId: user.uid,
      type: adType, status: status, dailyBudget, initialBudget: totalBudget, remainingBudget: totalBudget, budget: totalBudget, 
      durationDays: days, startDate: start, endDate: end, reach: 0, uniqueReach: 0, clicks: 0, createdAt: serverTimestamp()
    }

    try {
      const batch = writeBatch(db)
      const adRef = doc(collection(db, "ads"))
      batch.set(adRef, adData)
      batch.update(doc(db, "organizations", currentOrg.id), { adBalance: increment(-totalBudget), blockedBalance: increment(totalBudget), updatedAt: serverTimestamp() })
      batch.set(doc(collection(db, 'organizations', currentOrg.id, 'transactions')), {
        type: 'ad_reservation', description: `Reserva: ${adData.eventTitle}`, amount: totalBudget, status: 'completed', createdAt: serverTimestamp(), userId: user.uid
      })
      await batch.commit(); await refreshOrg();
      toast({ title: status === 'Ativo' ? "Campanha Ativa!" : "Enviado para Aprovação" })
      setIsCreateDialogOpen(false); setSelectedEventId(""); setAdImageUrl(null);
    } catch (error: any) { toast({ variant: "destructive", title: "Erro ao criar" }) }
    finally { setIsSubmitting(false) }
  }

  const handleToggleStatus = async (adId: string, currentStatus: string) => {
    if (!db) return
    
    // Bloqueio de segurança: o usuário não pode ativar campanhas pendentes
    if (currentStatus !== 'Ativo' && currentStatus !== 'Pausado') {
      toast({ 
        variant: "destructive", 
        title: "Ação não permitida", 
        description: "Campanhas pendentes só podem ser ativadas após aprovação administrativa." 
      });
      return;
    }

    const newStatus = currentStatus === 'Ativo' ? 'Pausado' : 'Ativo'
    setActionLoadingId(adId)
    try { 
      await updateDoc(doc(db, "ads", adId), { status: newStatus, updatedAt: serverTimestamp() }); 
      toast({ title: `Campanha ${newStatus.toLowerCase()}!` }) 
    }
    catch (e) { toast({ variant: "destructive", title: "Erro ao atualizar" }) }
    finally { setActionLoadingId(null) }
  }

  const handleCancelAd = async () => {
    if (!db || !adToCancel || !currentOrg) return
    setActionLoadingId(adToCancel.id)
    try {
      const batch = writeBatch(db)
      const refundAmount = adToCancel.remainingBudget || 0
      batch.update(doc(db, "ads", adToCancel.id), { status: "Cancelado", remainingBudget: 0, refundedAmount: refundAmount, updatedAt: serverTimestamp() })
      if (refundAmount > 0) {
        batch.update(doc(db, "organizations", currentOrg.id), { adBalance: increment(refundAmount), blockedBalance: increment(-refundAmount), updatedAt: serverTimestamp() })
        batch.set(doc(collection(db, 'organizations', currentOrg.id, 'transactions')), {
          type: 'ad_refund', description: `Estorno: ${adToCancel.eventTitle}`, amount: refundAmount, status: 'completed', createdAt: serverTimestamp(), userId: user?.uid
        })
      }
      await batch.commit(); await refreshOrg(); toast({ title: "Campanha cancelada" })
    } catch (e) { toast({ variant: "destructive", title: "Erro ao cancelar" }) }
    finally { setActionLoadingId(null); setAdToCancel(null) }
  }

  const formatAdDate = (dateVal: any) => {
    if (!dateVal) return "---";
    try {
      const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return "---"; }
  }

  const stats = React.useMemo(() => {
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

  if (orgLoading || adsLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

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
             <Link href={`/dashboard/organizacoes/${currentOrg?.username}/anuncios/valores`}><Coins className="w-4 h-4" /> Valores</Link>
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild><Button className="bg-secondary text-white font-black rounded-full px-8 h-11 shadow-lg gap-2 uppercase italic"><Plus className="w-5 h-5" /> Nova Campanha</Button></DialogTrigger>
            <DialogContent className="max-w-md h-[90vh] p-0 overflow-hidden rounded-[2.5rem] flex flex-col">
              <DialogHeader className="p-8 border-b bg-muted/30"><DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Lançar Campanha</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateAd} className="flex-1 overflow-y-auto p-8 space-y-8">
                  <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Objetivo</Label>
                     <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant={adType === 'evento' ? 'secondary' : 'outline'} className="h-16 flex-col text-[8px] font-black uppercase gap-1" onClick={() => setAdType('evento')}><Calendar className="w-4 h-4" /> Evento</Button>
                        <Button type="button" variant={adType === 'pagina' ? 'secondary' : 'outline'} className="h-16 flex-col text-[8px] font-black uppercase gap-1" onClick={() => setAdType('pagina')}><Layout className="w-4 h-4" /> Perfil</Button>
                        <Button type="button" variant={adType === 'banner' ? 'secondary' : 'outline'} className="h-16 flex-col text-[8px] font-black uppercase gap-1" onClick={() => setAdType('banner')}><ImageIcon className="w-4 h-4" /> Banner</Button>
                        <Button type="button" variant={adType === 'site' ? 'secondary' : 'outline'} className="h-16 flex-col text-[8px] font-black uppercase gap-1" onClick={() => setAdType('site')}><Globe className="w-4 h-4" /> Link</Button>
                     </div>
                  </div>
                  {adType === 'evento' ? (
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Evento</Label>
                    <Select value={selectedEventId} onValueChange={setSelectedEventId} required><SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Escolha um evento" /></SelectTrigger><SelectContent className="rounded-xl">{myEvents?.map((ev: any) => (<SelectItem key={ev.id} value={ev.id}>{ev.title}</SelectItem>))}</SelectContent></Select></div>
                  ) : adType === 'pagina' ? (
                    <div className="p-4 bg-muted/50 rounded-2xl border border-dashed flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500" /><p className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">Promoveremos @{currentOrg.username} no feed.</p></div>
                  ) : (
                    <><div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Título</Label><Input name="title" required className="rounded-xl h-11" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Link</Label><Input name="url" type="url" className="rounded-xl h-11" /></div>
                    <div className="space-y-3"><Label className="text-[10px] font-black uppercase opacity-60">Imagem</Label><div className="relative aspect-video bg-muted rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden cursor-pointer" onClick={() => document.getElementById('ad-image-up')?.click()}>
                    {adImageUrl ? <img src={adImageUrl} className="w-full h-full object-cover" /> : <div className="text-center opacity-40"><Camera className="w-8 h-8 mx-auto mb-2" /><p className="text-[8px] font-black uppercase">Carregar mídia</p></div>}
                    <input id="ad-image-up" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} /></div>{uploadProgress !== null && <Progress value={uploadProgress} className="h-1" />}</div></>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Início</Label><Input name="startDate" type="datetime-local" required className="rounded-xl h-11 text-xs" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Término</Label><Input name="endDate" type="datetime-local" required className="rounded-xl h-11 text-xs" /></div>
                  </div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Orçamento Diário (R$)</Label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-secondary">R$</span><Input name="budget" type="number" step="0.01" placeholder="50,00" required className="rounded-2xl h-14 pl-12 text-xl font-black border-secondary/20" /></div></div>
              </form>
              <div className="p-8 border-t bg-muted/30"><Button onClick={(e:any) => e.target.closest('div').previousSibling.requestSubmit()} type="submit" disabled={isSubmitting || uploadProgress !== null} className="w-full bg-secondary text-white font-black h-16 rounded-[2rem] shadow-xl uppercase italic text-lg">{isSubmitting ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <><Target className="w-6 h-6 mr-2" /> Iniciar Impulsionamento</>}</Button></div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative group">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Visualizações</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black">{(stats.reach).toLocaleString()}</div></CardContent>
          <Eye className="absolute -bottom-2 -right-2 w-20 h-20 opacity-5 rotate-12" />
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-secondary">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Alcance Único</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-secondary">{(stats.uniqueReach).toLocaleString()}</div></CardContent>
          <Users className="absolute -bottom-2 -right-2 w-16 h-16 opacity-5 rotate-12" />
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-primary">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cliques</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-primary">{(stats.clicks).toLocaleString()}</div></CardContent>
          <MousePointer2 className="absolute -bottom-2 -right-2 w-16 h-16 opacity-5 rotate-12" />
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">CTR Médio</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black">{stats.avgCtr.toFixed(2)}%</div></CardContent>
          <TrendingUp className="absolute -bottom-2 -right-2 w-16 h-16 opacity-5 rotate-12" />
        </Card>
        <Card className="border-none shadow-sm bg-secondary text-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Saldo Livre</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-black">{formatCurrency(currentOrg?.adBalance || 0)}</div></CardContent>
          <Wallet className="absolute -bottom-2 -right-2 w-16 h-16 opacity-5 rotate-12" />
        </Card>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b pb-6 p-8">
           <CardTitle className="text-xl flex items-center gap-2"><BarChart3 className="w-5 h-5 text-secondary" /> Histórico de Impulsionamento</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ads.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <div className="min-w-[1000px]">
                <div className="bg-muted/30 px-8 py-4 grid grid-cols-12 gap-4 border-b">
                   <div className="col-span-3 text-[10px] font-black uppercase tracking-widest opacity-40">Campanha / Vigência</div>
                   <div className="col-span-1 text-[10px] font-black uppercase tracking-widest opacity-40 text-center">Visu.</div>
                   <div className="col-span-1 text-[10px] font-black uppercase tracking-widest opacity-40 text-center">Alcance</div>
                   <div className="col-span-1 text-[10px] font-black uppercase tracking-widest opacity-40 text-center">Cliques</div>
                   <div className="col-span-1 text-[10px] font-black uppercase tracking-widest opacity-40 text-center">CTR</div>
                   <div className="col-span-2 text-[10px] font-black uppercase tracking-widest opacity-40 text-right">Investimento</div>
                   <div className="col-span-3 text-[10px] font-black uppercase tracking-widest opacity-40 text-right">Ações</div>
                </div>

                <div className="divide-y">
                   {ads.map((ad: any) => {
                     const isFinished = ad.status === 'Finalizado' || ad.status === 'Cancelado';
                     const canToggle = ad.status === 'Ativo' || ad.status === 'Pausado';
                     const ctr = ad.reach > 0 ? (ad.clicks / ad.reach) * 100 : 0;
                     
                     return (
                       <div key={ad.id} className={cn("px-8 py-6 grid grid-cols-12 gap-4 items-center transition-colors hover:bg-muted/5", isFinished && "opacity-60")}>
                         <div className="col-span-3 flex gap-3">
                           <div className="p-2.5 rounded-xl bg-secondary/10 h-fit">
                             {ad.type === 'evento' ? <Calendar className="w-4 h-4 text-secondary" /> : ad.type === 'pagina' ? <Layout className="w-4 h-4 text-secondary" /> : <Megaphone className="w-4 h-4 text-secondary" />}
                           </div>
                           <div className="space-y-1">
                             <div className="flex items-center gap-2">
                               <h4 className="font-bold text-xs uppercase truncate max-w-[150px]">{ad.eventTitle}</h4>
                               <Badge className={cn("text-[7px] font-black uppercase h-3.5 px-1", ad.status === 'Ativo' ? "bg-green-500" : ad.status === 'Pendente' ? "bg-orange-500" : "bg-muted")}>{ad.status}</Badge>
                             </div>
                             <div className="flex flex-col gap-0.5 text-[8px] font-bold text-muted-foreground uppercase">
                               <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5 text-green-500" /> {formatAdDate(ad.startDate)}</span>
                               <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5 text-red-500" /> {formatAdDate(ad.endDate)}</span>
                             </div>
                           </div>
                         </div>

                         <div className="col-span-1 text-center">
                            <span className="font-black text-sm">{ad.reach?.toLocaleString() || 0}</span>
                         </div>
                         <div className="col-span-1 text-center">
                            <span className="font-black text-sm text-secondary">{ad.uniqueReach?.toLocaleString() || 0}</span>
                         </div>
                         <div className="col-span-1 text-center">
                            <span className="font-black text-sm text-primary">{ad.clicks?.toLocaleString() || 0}</span>
                         </div>
                         <div className="col-span-1 text-center">
                            <span className="font-black text-xs bg-muted px-2 py-0.5 rounded-full">{ctr.toFixed(2)}%</span>
                         </div>

                         <div className="col-span-2 text-right space-y-0.5">
                            <p className="font-black text-xs">{formatCurrency(ad.initialBudget || ad.budget || 0)}</p>
                            <p className="text-[8px] font-bold text-secondary uppercase">Saldo: {formatCurrency(isFinished ? ad.refundedAmount || 0 : ad.remainingBudget || 0)}</p>
                         </div>

                         <div className="col-span-3 flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" className="h-8 rounded-lg border-secondary/20 text-secondary gap-1.5 font-bold text-[9px] uppercase" onClick={() => setSelectedAdForMetrics(ad)}>
                               <TrendingUp className="w-3.5 h-3.5" /> Métricas
                            </Button>
                            {!isFinished && (
                              <div className="flex items-center gap-1">
                                 <Button 
                                   variant="outline" 
                                   size="icon" 
                                   className={cn(
                                     "h-8 w-8 rounded-lg border-secondary/20 text-secondary transition-opacity",
                                     !canToggle && "opacity-30 cursor-not-allowed"
                                   )} 
                                   onClick={() => canToggle && handleToggleStatus(ad.id, ad.status)} 
                                   disabled={actionLoadingId === ad.id || !canToggle}
                                   title={ad.status === 'Pendente' ? "Aguardando aprovação administrativa" : (ad.status === 'Ativo' ? "Pausar" : "Retomar")}
                                 >
                                    {ad.status === 'Ativo' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                 </Button>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => setAdToCancel(ad)} disabled={actionLoadingId === ad.id}>
                                    <XCircle className="w-3.5 h-3.5" />
                                 </Button>
                              </div>
                            )}
                         </div>
                       </div>
                     );
                   })}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-24 text-center"><Megaphone className="w-16 h-16 text-muted-foreground opacity-10 mx-auto mb-4" /><p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-xs">Nenhuma campanha registrada.</p></div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedAdForMetrics} onOpenChange={(o) => !o && setSelectedAdForMetrics(null)}>
        <DialogContent className="max-w-2xl rounded-[2.5rem]">
           <DialogHeader>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Métricas de Performance</DialogTitle>
              <DialogDescription className="font-bold text-secondary uppercase">{selectedAdForMetrics?.eventTitle}</DialogDescription>
           </DialogHeader>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-muted/30 rounded-2xl text-center">
                 <p className="text-[9px] font-black uppercase opacity-40">Visu. Totais</p>
                 <p className="text-xl font-black">{selectedAdForMetrics?.reach?.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-secondary/10 rounded-2xl text-center">
                 <p className="text-[9px] font-black uppercase text-secondary">Alcance Único</p>
                 <p className="text-xl font-black text-secondary">{selectedAdForMetrics?.uniqueReach?.toLocaleString() || 0}</p>
              </div>
              <div className="p-4 bg-primary/10 rounded-2xl text-center">
                 <p className="text-[9px] font-black uppercase text-primary">Cliques Reais</p>
                 <p className="text-xl font-black text-primary">{selectedAdForMetrics?.clicks?.toLocaleString()}</p>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
              <div className="space-y-6">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Users className="w-4 h-4" /> Perfil de Gênero</h4>
                 <div className="space-y-4">
                    <DemographicBar label="Masculino" value={selectedAdForMetrics?.stats_gender_masculino || 0} total={selectedAdForMetrics?.uniqueReach || 1} color="bg-blue-500" />
                    <DemographicBar label="Feminino" value={selectedAdForMetrics?.stats_gender_feminino || 0} total={selectedAdForMetrics?.uniqueReach || 1} color="bg-pink-500" />
                    <DemographicBar label="Homem Trans" value={selectedAdForMetrics?.stats_gender_homem_trans || 0} total={selectedAdForMetrics?.uniqueReach || 1} color="bg-indigo-400" />
                    <DemographicBar label="Mulher Trans" value={selectedAdForMetrics?.stats_gender_mulher_trans || 0} total={selectedAdForMetrics?.uniqueReach || 1} color="bg-rose-400" />
                    <DemographicBar label="Agênero" value={selectedAdForMetrics?.stats_gender_agenero || 0} total={selectedAdForMetrics?.uniqueReach || 1} color="bg-gray-400" />
                    <DemographicBar label="Outro" value={selectedAdForMetrics?.stats_gender_outro || 0} total={selectedAdForMetrics?.uniqueReach || 1} color="bg-purple-400" />
                 </div>
              </div>
              <div className="space-y-6">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4" /> Distribuição de Idade</h4>
                 <div className="space-y-4">
                    <DemographicBar label="0 - 18 anos" value={selectedAdForMetrics?.stats_age_0_18 || 0} total={selectedAdForMetrics?.uniqueReach || 1} color="bg-teal-400" />
                    <DemographicBar label="19 - 24" value={selectedAdForMetrics?.stats_age_19_24 || 0} total={selectedAdForMetrics?.uniqueReach || 1} color="bg-emerald-400" />
                    <DemographicBar label="25 - 30" value={selectedAdForMetrics?.stats_age_25_30 || 0} total={selectedAdForMetrics?.uniqueReach || 1} color="bg-sky-400" />
                    <DemographicBar label="31 - 34" value={selectedAdForMetrics?.stats_age_31_34 || 0} total={selectedAdForMetrics?.uniqueReach || 1} color="bg-blue-400" />
                    <DemographicBar label="35 - 40" value={selectedAdForMetrics?.stats_age_35_40 || 0} total={selectedAdForMetrics?.uniqueReach || 1} color="bg-indigo-400" />
                    <DemographicBar label="41 - 44" value={selectedAdForMetrics?.stats_age_41_44 || 0} total={selectedAdForMetrics?.uniqueReach || 1} color="bg-violet-400" />
                    <DemographicBar label="45 - 50" value={selectedAdForMetrics?.stats_age_45_50 || 0} total={selectedAdForMetrics?.uniqueReach || 1} color="bg-purple-400" />
                    <DemographicBar label="50 - 75" value={selectedAdForMetrics?.stats_age_51_75 || 0} total={selectedAdForMetrics?.uniqueReach || 1} color="bg-pink-400" />
                    <DemographicBar label="+75 anos" value={selectedAdForMetrics?.stats_age_75plus || 0} total={selectedAdForMetrics?.uniqueReach || 1} color="bg-slate-400" />
                 </div>
              </div>
           </div>
           <div className="p-4 bg-muted/30 rounded-2xl flex gap-3"><Info className="w-5 h-5 text-secondary shrink-0" /><p className="text-[9px] text-muted-foreground font-bold uppercase leading-tight">Métricas baseadas em usuários logados. O Alcance Único identifica indivíduos únicos, enquanto as Visualizações contam cada exibição do card. Porcentagens calculadas sobre o Alcance Único Identificado.</p></div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!adToCancel} onOpenChange={(o) => !o && setAdToCancel(null)}>
        <AlertDialogContent className="rounded-[2.5rem]">
          <AlertDialogHeader><AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter">Confirmar Cancelamento?</AlertDialogTitle><AlertDialogDescription>Esta ação encerrará a campanha e devolverá <strong>{formatCurrency(adToCancel?.remainingBudget || 0)}</strong> ao saldo da marca.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Não</AlertDialogCancel><AlertDialogAction onClick={handleCancelAd} className="bg-destructive text-white rounded-xl font-black uppercase text-[10px] px-8">Encerrar e Estornar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function DemographicBar({ label, value, total, color }: { label: string, value: number, total: number, color: string }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-[9px] font-black uppercase">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-primary">{percentage}% ({value})</span>
      </div>
      <div className="h-1 w-full bg-muted rounded-full overflow-hidden"><div className={cn("h-full transition-all duration-1000", color)} style={{ width: `${percentage}%` }} /></div>
    </div>
  )
}
