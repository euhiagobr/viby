
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useFirebaseApp, useCollection, useMemoFirebase } from "@/firebase"
import { updateDoc, doc, collection, serverTimestamp, getDoc, setDoc, deleteDoc, query, where, getDocs, deleteField } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import { 
  ArrowLeft, 
  Upload, 
  MapPin, 
  Calendar, 
  Plus, 
  Trash2, 
  Loader2, 
  ImageIcon,
  Save,
  Clock,
  Info,
  Ticket,
  Sparkles,
  Layers,
  ArrowDown,
  InfoIcon,
  Camera,
  Map as MapIcon,
  Layout,
  Armchair,
  Grid3X3,
  X,
  Users2
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface TicketType {
  id: string
  name: string
  price: number
  quantity: number
  requiresProof: boolean
  isLegalHalf: boolean
  description: string
  poolId?: string
  poolName?: string
}

interface Batch {
  id: string
  name: string
  description: string
  startDate: string
  endDate: string
  capacidadeInicial: number
  capacidadeAtual: number
  vendidos: number
  restantes: number
  migradosDoLoteAnterior: number
  ticketTypes: TicketType[]
}

export default function EditarEventoPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg, userRole, loading: orgLoading } = useCurrentOrganization()

  const eventRef = React.useMemo(() => (db && eventId) ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app, "gs://viby");
  }, [app])

  const categoriesQuery = useMemoFirebase(() => db ? collection(db, "categories") : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  
  const [selectedCategory, setSelectedCategory] = useState("")
  
  // DUAS CONFIGURAÇÕES INDEPENDENTES
  const [ticketMode, setTicketMode] = useState<'none' | 'free' | 'paid_single' | 'batches'>('free')
  const [mapMode, setMapMode] = useState<'none' | 'setores' | 'assentos' | 'mesas'>('none')
  
  // Estados de Bilheteria
  const [batches, setBatches] = useState<Batch[]>([])
  const [singleCapacity, setSingleCapacity] = useState<number>(100)
  const [singleTicketTypes, setSingleTicketTypes] = useState<TicketType[]>([])
  const [freeCapacity, setFreeCapacity] = useState<number>(100)

  const [address, setAddress] = useState({ street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "" })
  
  const [isDistributeOpen, setIsDistributeOpen] = useState(false)
  const [distributeBatchIdx, setDistributeBatchIdx] = useState<number | null>(null)
  const [totalToDistribute, setTotalToDistribute] = useState("")

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

  useEffect(() => {
    if (event) {
      setSelectedCategory(event.categoryId || "");
      setTicketMode(event.ticketMode || 'free');
      setMapMode(event.mapMode || (event.possuiMapa ? 'setores' : 'none'));
      setImagePreview(event.image || null);
      setAddress(event.address || { street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "" });
      
      if (event.ticketMode === 'batches') {
        setBatches(event.batches || []);
      } else if (event.ticketMode === 'paid_single') {
        const b = event.batches?.[0];
        setSingleCapacity(b?.capacidadeInicial || 100);
        setSingleTicketTypes(b?.ticketTypes || []);
      } else if (event.ticketMode === 'free') {
        setFreeCapacity(event.batches?.[0]?.capacidadeInicial || 100);
      }
    }
  }, [event]);

  const recalculateBatches = (currentBatches: Batch[]) => {
    const updated = [...currentBatches];
    let carryOver = 0;

    for (let i = 0; i < updated.length; i++) {
      const b = updated[i];
      b.migradosDoLoteAnterior = carryOver;
      b.capacidadeAtual = b.capacidadeInicial + carryOver;
      b.restantes = b.capacidadeAtual - (b.vendidos || 0);
      carryOver = Math.max(0, b.restantes);
    }
    return updated;
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return
    setImagePreview(URL.createObjectURL(file))
    setUploadProgress(0)
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      const storageRef = ref(storage, `events/${user.uid}/${fileName}`)
      const uploadTask = uploadBytesResumable(storageRef, file)
      uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), () => setUploadProgress(null), async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
        setUploadedImageUrl(downloadURL); setUploadProgress(null)
      })
    } catch (err) { setUploadProgress(null) }
  }

  const handleDistribute = () => {
    if (distributeBatchIdx === null || !totalToDistribute) return
    const total = parseInt(totalToDistribute)
    if (isNaN(total)) return

    const poolId = crypto.randomUUID()
    const meiaQuantity = Math.floor(total * 0.4)

    const newTypes: TicketType[] = [
      { id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: total, poolId, poolName: "Estoque Compartilhado", requiresProof: false, isLegalHalf: false, description: "" },
      { id: crypto.randomUUID(), name: "Meia Estudante", price: 50, quantity: meiaQuantity, poolId, poolName: "Estoque Compartilhado", requiresProof: true, isLegalHalf: true, description: "" },
      { id: crypto.randomUUID(), name: "Meia PCD", price: 50, quantity: meiaQuantity, poolId, poolName: "Estoque Compartilhado", requiresProof: true, isLegalHalf: true, description: "" },
      { id: crypto.randomUUID(), name: "Meia Idoso", price: 50, quantity: meiaQuantity, poolId, poolName: "Estoque Compartilhado", requiresProof: true, isLegalHalf: true, description: "" }
    ]

    if (ticketMode === 'batches') {
      const newBatches = [...batches]
      newBatches[distributeBatchIdx].ticketTypes = newTypes
      newBatches[distributeBatchIdx].capacidadeInicial = total
      setBatches(recalculateBatches(newBatches))
    } else if (ticketMode === 'paid_single') {
      setSingleTicketTypes(newTypes)
      setSingleCapacity(total)
    }

    setIsDistributeOpen(false)
    setTotalToDistribute("")
    toast({ title: "Meia-entrada configurada!" })
  }

  const addBatch = () => {
    const newB: Batch = { 
      id: crypto.randomUUID(), 
      name: `Lote ${batches.length + 1}`, 
      description: "", 
      startDate: "", 
      endDate: "", 
      capacidadeInicial: 100, 
      capacidadeAtual: 100,
      vendidos: 0,
      restantes: 100,
      migradosDoLoteAnterior: 0,
      ticketTypes: [{ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }] 
    }
    setBatches(recalculateBatches([...batches, newB]))
  }

  const removeBatch = (i: number) => {
    if(batches.length > 1) setBatches(recalculateBatches(batches.filter((_, idx) => idx !== i)))
  }

  const updateBatchField = (i: number, f: keyof Batch, v: any) => { 
    const n = [...batches]; 
    n[i] = { ...n[i], [f]: v } as any; 
    if (f === 'capacidadeInicial') setBatches(recalculateBatches(n)); else setBatches(n);
  }

  const addTicketType = (bi: number) => { 
    const n = [...batches]; 
    n[bi].ticketTypes.push({ id: crypto.randomUUID(), name: "Nova Categoria", price: 100, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }); 
    setBatches(n); 
  }

  const removeTicketType = (bi: number, ti: number) => { 
    const n = [...batches]; 
    if(n[bi].ticketTypes.length > 1) { 
      n[bi].ticketTypes.splice(ti, 1); 
      setBatches(n); 
    } 
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !eventRef || !isAtLeastEditor) return
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    try {
      const cat = categories?.find(c => c.id === selectedCategory)
      
      let finalBatches: Batch[] = []
      let totalCapacity = 0

      if (ticketMode === 'batches') {
        finalBatches = recalculateBatches(batches)
        totalCapacity = finalBatches.reduce((acc, b) => acc + (b.capacidadeInicial || 0), 0)
      } else if (ticketMode === 'paid_single') {
        totalCapacity = singleCapacity
        finalBatches = [{
          id: 'single',
          name: 'Lote Único',
          description: '',
          startDate: '',
          endDate: '',
          capacidadeInicial: singleCapacity,
          capacidadeAtual: singleCapacity,
          vendidos: event.batches?.[0]?.vendidos || 0,
          restantes: singleCapacity - (event.batches?.[0]?.vendidos || 0),
          migradosDoLoteAnterior: 0,
          ticketTypes: singleTicketTypes
        }]
      } else if (ticketMode === 'free') {
        totalCapacity = freeCapacity
        finalBatches = [{
          id: 'free',
          name: 'Ingresso Gratuito',
          description: '',
          startDate: '',
          endDate: '',
          capacidadeInicial: freeCapacity,
          capacidadeAtual: freeCapacity,
          vendidos: event.batches?.[0]?.vendidos || 0,
          restantes: freeCapacity - (event.batches?.[0]?.vendidos || 0),
          migradosDoLoteAnterior: 0,
          ticketTypes: [{ id: 'free_type', name: 'Gratuito', price: 0, quantity: freeCapacity, requiresProof: false, isLegalHalf: false, description: '' }]
        }]
      }

      const eventData = {
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        date: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory,
        categoryName: cat?.name || "Outros",
        ticketMode,
        mapMode,
        possuiMapa: mapMode !== 'none',
        isFree: ticketMode === 'free',
        capacidadeTotal: totalCapacity,
        batches: ticketMode === 'none' ? [] : finalBatches,
        address, 
        image: uploadedImageUrl || event.image || "",
        updatedAt: serverTimestamp()
      }

      await updateDoc(eventRef, eventData)
      toast({ title: "Evento Atualizado!" })
      router.push("/dashboard/organizacoes")
    } catch (err: any) { 
      toast({ variant: "destructive", title: "Erro ao salvar" }) 
    } finally { 
      setSaving(false) 
    }
  }

  if (eventLoading || orgLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 text-foreground">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <h1 className="text-3xl font-black italic tracking-tighter text-primary uppercase">Editar Evento</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="overflow-hidden border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="w-5 h-5 text-secondary" /> Capa</CardTitle></CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="relative aspect-video rounded-[1.5rem] bg-muted overflow-hidden cursor-pointer" onClick={() => document.getElementById('img-up')?.click()}>
              {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" /> : <div className="flex flex-col items-center justify-center h-full opacity-20"><Upload className="w-10 h-10 mb-2" /><p className="text-xs font-bold uppercase tracking-widest">Carregar Imagem</p></div>}
              <input id="img-up" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Camera className="text-white w-8 h-8" /></div>
            </div>
            {uploadProgress !== null && <Progress value={uploadProgress} className="h-1 mt-4" />}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5 text-secondary" /> Informações Básicas</CardTitle></CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><Label>Título</Label><Input name="title" defaultValue={event.title} required className="rounded-xl h-11" /></div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="rounded-xl">{categories?.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
             </div>
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><Label>Início</Label><Input name="startDate" type="datetime-local" defaultValue={event.date} required className="rounded-xl h-11 text-xs" /></div>
                <div className="space-y-2"><Label>Término</Label><Input name="endDate" type="datetime-local" defaultValue={event.endDate} required className="rounded-xl h-11 text-xs" /></div>
             </div>
             <div className="space-y-2"><Label>Descrição</Label><Textarea name="description" defaultValue={event.description} className="min-h-[120px] rounded-xl border-dashed border-secondary/30" required /></div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden">
           <CardHeader className="bg-primary/5">
              <CardTitle className="text-lg flex items-center gap-2"><MapIcon className="w-5 h-5 text-primary" /> Estrutura do Evento (Mapa)</CardTitle>
              <CardDescription>Defina se o evento terá setores ou assentos numerados independentemente da bilheteria.</CardDescription>
           </CardHeader>
           <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                 {[
                   { id: 'none', label: 'Sem Mapa', icon: X, desc: 'Lista simples' },
                   { id: 'setores', label: 'Setores', icon: Layout, desc: 'Áreas livres' },
                   { id: 'assentos', label: 'Assentos', icon: Armchair, desc: 'Cadeiras' },
                   { id: 'mesas', label: 'Mesas', icon: Grid3X3, desc: 'Numeradas' }
                 ].map((mode) => (
                   <Button 
                     key={mode.id} 
                     type="button"
                     variant={mapMode === mode.id ? 'secondary' : 'outline'}
                     className={cn("h-24 flex-col gap-2 rounded-2xl border-dashed", mapMode === mode.id && "border-solid ring-2 ring-secondary/20")}
                     onClick={() => setMapMode(mode.id as any)}
                   >
                     <mode.icon className="w-6 h-6" />
                     <div className="text-center">
                        <p className="text-[10px] font-black uppercase">{mode.label}</p>
                        <p className="text-[8px] font-bold opacity-50 uppercase">{mode.desc}</p>
                     </div>
                   </Button>
                 ))}
              </div>
              
              {mapMode !== 'none' && (
                <div className="p-6 bg-secondary/5 rounded-3xl border-2 border-dashed border-secondary/20 flex flex-col md:flex-row items-center justify-between gap-6 animate-in zoom-in-95">
                   <div className="flex items-center gap-4 text-center md:text-left">
                      <div className="p-4 bg-white rounded-2xl shadow-sm text-secondary"><MapIcon className="w-8 h-8" /></div>
                      <div>
                         <h4 className="font-black italic uppercase tracking-tighter text-primary">Planta Visual Habilitada</h4>
                         <p className="text-xs font-medium text-muted-foreground">Agora você pode desenhar seu mapa visual no editor.</p>
                      </div>
                   </div>
                   <Button asChild className="bg-primary text-white font-black rounded-xl h-12 px-8 uppercase italic shadow-lg">
                      <Link href={`/dashboard/evento/${eventId}/mapa`}>Abrir Editor de Planta</Link>
                   </Button>
                </div>
              )}
           </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Configuração Comercial</CardTitle>
                <CardDescription>Como você deseja cobrar pelos ingressos?</CardDescription>
              </div>
              <div className="bg-white p-1 rounded-xl border flex flex-wrap gap-1">
                <Button type="button" variant={ticketMode === 'none' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-3" onClick={() => setTicketMode('none')}>Sem Ingresso</Button>
                <Button type="button" variant={ticketMode === 'free' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-3" onClick={() => setTicketMode('free')}>Grátis</Button>
                <Button type="button" variant={ticketMode === 'paid_single' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-3" onClick={() => setTicketMode('paid_single')}>Valor Único</Button>
                <Button type="button" variant={ticketMode === 'batches' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-3" onClick={() => setTicketMode('batches')}>Lotes</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
             {ticketMode === 'none' && (
               <div className="py-12 text-center space-y-4">
                  <InfoIcon className="w-12 h-12 mx-auto text-muted-foreground opacity-20" />
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Apenas informativo</p>
               </div>
             )}

             {ticketMode === 'free' && (
               <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="p-6 bg-muted/20 rounded-2xl border-2 border-dashed border-border flex flex-col items-center gap-4">
                     <Label className="text-xs font-black uppercase tracking-widest">Capacidade Gratuita</Label>
                     <Input type="number" value={freeCapacity} onChange={e => setFreeCapacity(parseInt(e.target.value) || 0)} className="h-14 text-2xl font-black rounded-xl text-center border-secondary/20 max-w-[200px]" />
                  </div>
               </div>
             )}

             {ticketMode === 'paid_single' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div className="md:col-span-1 space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Capacidade Total</Label>
                      <Input type="number" value={singleCapacity} onChange={e => setSingleCapacity(parseInt(e.target.value) || 0)} className="rounded-xl h-11 font-black text-primary" />
                    </div>
                    <div className="md:col-span-2">
                       <Button type="button" variant="outline" className="w-full rounded-xl h-11 border-dashed font-bold uppercase text-[10px] gap-2" onClick={() => { setDistributeBatchIdx(0); setTotalToDistribute(singleCapacity.toString()); setIsDistributeOpen(true); }}>
                          <Sparkles className="w-4 h-4 text-secondary" /> Gerar Meias
                       </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                     {singleTicketTypes.map((t, ti) => (
                        <div key={t.id} className="p-4 bg-white rounded-2xl border shadow-sm grid grid-cols-12 gap-4 items-end">
                           <div className="col-span-6 space-y-2">
                              <Label className="text-[9px] uppercase font-black opacity-40">Título</Label>
                              <Input value={t.name} onChange={e => { const n = [...singleTicketTypes]; n[ti].name = e.target.value; setSingleTicketTypes(n); }} className="rounded-xl h-10 font-bold" />
                           </div>
                           <div className="col-span-4 space-y-2">
                              <Label className="text-[9px] uppercase font-black opacity-40">Preço (R$)</Label>
                              <Input type="number" step="0.01" value={t.price} onChange={e => { const n = [...singleTicketTypes]; n[ti].price = parseFloat(e.target.value) || 0; setSingleTicketTypes(n); }} className="rounded-xl h-10 font-black text-secondary" />
                           </div>
                           <div className="col-span-2 flex justify-end pb-1">
                              <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => { if(singleTicketTypes.length > 1) setSingleTicketTypes(singleTicketTypes.filter((_, idx) => idx !== ti)) }}><Trash2 className="w-4 h-4" /></Button>
                           </div>
                        </div>
                     ))}
                     <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl text-[9px] font-black uppercase gap-1.5 border-dashed" onClick={() => setSingleTicketTypes([...singleTicketTypes, { id: crypto.randomUUID(), name: "Nova Categoria", price: 100, quantity: singleCapacity, requiresProof: false, isLegalHalf: false, description: "" }])}>
                        <Plus className="w-3.5 h-3.5" /> Adicionar Categoria
                     </Button>
                  </div>
                </div>
             )}

             {ticketMode === 'batches' && (
               <div className="space-y-8 animate-in fade-in duration-300">
                 {batches.map((batch, bi) => (
                   <div key={batch.id} className="p-6 rounded-[1.5rem] border-2 bg-muted/10 space-y-6 relative overflow-hidden">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                           <h3 className="font-black italic uppercase text-secondary text-xl">{batch.name}</h3>
                           <Badge variant="outline" className="text-[10px] font-bold uppercase">Janela #{bi+1}</Badge>
                        </div>
                        <div className="flex gap-2">
                           <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase border-secondary text-secondary gap-1.5" onClick={() => { setDistributeBatchIdx(bi); setTotalToDistribute(batch.capacidadeInicial.toString()); setIsDistributeOpen(true); }}>
                              <Sparkles className="w-3 h-3" /> Gerar Meia
                           </Button>
                           <Button type="button" variant="ghost" size="icon" className="text-destructive rounded-full" onClick={() => removeBatch(bi)} disabled={batches.length === 1}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                         <div className="md:col-span-1 space-y-2">
                           <Label className="text-[10px] font-black uppercase opacity-60">Carga Inicial</Label>
                           <Input type="number" value={batch.capacidadeInicial} onChange={e => updateBatchField(bi, 'capacidadeInicial', parseInt(e.target.value) || 0)} className="rounded-xl h-11 font-black text-primary" />
                         </div>
                         <div className="md:col-span-1 space-y-2">
                           <Label className="text-[10px] font-black uppercase opacity-40">Carga Atual</Label>
                           <div className="h-11 flex items-center font-black text-secondary px-3 bg-white/50 rounded-xl">{batch.capacidadeAtual}</div>
                         </div>
                         <div className="md:col-span-2 space-y-2">
                            <Label className="text-[10px] font-black uppercase opacity-60">Nome da Janela</Label>
                            <Input value={batch.name} onChange={e => updateBatchField(bi, 'name', e.target.value)} className="rounded-xl h-11" />
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Início</Label><Input type="datetime-local" value={batch.startDate} onChange={e => updateBatchField(bi, 'startDate', e.target.value)} className="rounded-xl h-11 text-xs" /></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Fim</Label><Input type="datetime-local" value={batch.endDate} onChange={e => updateBatchField(bi, 'endDate', e.target.value)} className="rounded-xl h-11 text-xs" /></div>
                      </div>

                      <div className="space-y-4">
                         {batch.ticketTypes.map((t, ti) => (
                           <div key={t.id} className="p-4 bg-white rounded-2xl border shadow-sm grid grid-cols-12 gap-4 items-end">
                              <div className="col-span-6 space-y-2">
                                 <Label className="text-[9px] uppercase font-black opacity-40">Título</Label>
                                 <Input value={t.name} onChange={e => { const n = [...batches]; n[bi].ticketTypes[ti].name = e.target.value; setBatches(n); }} className="rounded-xl h-10 font-bold" />
                              </div>
                              <div className="col-span-4 space-y-2">
                                <Label className="text-[9px] uppercase font-black opacity-40">Preço (R$)</Label>
                                <Input type="number" step="0.01" value={t.price} onChange={e => { const n = [...batches]; n[bi].ticketTypes[ti].price = parseFloat(e.target.value) || 0; setBatches(n); }} className="rounded-xl h-10 font-black text-secondary" />
                              </div>
                              <div className="col-span-2 flex justify-end pb-1"><Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeTicketType(bi, ti)} disabled={batch.ticketTypes.length === 1}><Trash2 className="w-4 h-4" /></Button></div>
                           </div>
                         ))}
                         <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase gap-1.5" onClick={() => addTicketType(bi)}><Plus className="w-3 h-3" /> Adicionar Categoria</Button>
                      </div>
                   </div>
                 ))}
                 <Button type="button" variant="outline" className="w-full h-14 rounded-2xl border-dashed font-black uppercase italic" onClick={addBatch}><Plus className="w-5 h-5 mr-2" /> Adicionar Lote</Button>
                 
                 <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
                    <Info className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase">Sobras migram automaticamente para a próxima janela.</p>
                 </div>
               </div>
             )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving} className="w-full h-16 rounded-[2rem] bg-secondary text-white font-black text-xl shadow-xl uppercase italic">
          {saving ? <Loader2 className="animate-spin mr-2" /> : <><Save className="mr-2 w-6 h-6" /> Salvar Alterações</>}
        </Button>
      </form>

      <Dialog open={isDistributeOpen} onOpenChange={setIsDistributeOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Gerar Meias</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
             <Label className="text-[10px] font-black uppercase opacity-60">Carga do Lote/Geral</Label>
             <Input type="number" value={totalToDistribute} onChange={e => setTotalToDistribute(e.target.value)} className="h-14 text-2xl font-black rounded-xl text-center border-secondary/20" />
          </div>
          <DialogFooter>
            <Button onClick={handleDistribute} className="w-full bg-secondary text-white font-black h-12 rounded-xl">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
