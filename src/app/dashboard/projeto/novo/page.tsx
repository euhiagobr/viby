
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useFirebaseApp, useCollection, useMemoFirebase } from "@/firebase"
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, query, where, getDocs, limit, deleteField, updateDoc, writeBatch } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "@/hooks/use-toast"
import { 
  Loader2, 
  ArrowLeft, 
  Plus, 
  Upload, 
  Calendar, 
  Ticket, 
  ImageIcon,
  Save,
  Map as MapIcon,
  X,
  Sparkles,
  Layers,
  Users,
  AtSign,
  XCircle,
  ArrowDown,
  InfoIcon,
  Layout,
  Armchair,
  Grid3X3,
  Clock,
  Info
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
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

export default function NovoEventoPage() {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg, userRole, loading: orgLoading, refreshOrg } = useCurrentOrganization()

  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app, "gs://viby");
  }, [app])

  const categoriesQuery = useMemoFirebase(() => db ? collection(db, "categories") : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  
  const [selectedCategory, setSelectedCategory] = useState("")
  
  const [ticketMode, setTicketMode] = useState<'none' | 'free' | 'paid_single' | 'batches'>('free')
  const [mapMode, setMapMode] = useState<'none' | 'setores' | 'assentos' | 'mesas'>('none')
  
  // Datas globais de venda para modos simples
  const [globalSalesStart, setGlobalSalesStart] = useState("")
  const [globalSalesEnd, setGlobalSalesEnd] = useState("")

  // Lotes (Modo Batches)
  const [batches, setBatches] = useState<Batch[]>([
    { 
      id: crypto.randomUUID(),
      name: "Lote 1", 
      description: "", 
      startDate: "", 
      endDate: "", 
      capacidadeInicial: 100,
      capacidadeAtual: 100,
      vendidos: 0,
      restantes: 100,
      migradosDoLoteAnterior: 0,
      ticketTypes: [
        { id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }
      ] 
    }
  ])

  // Valor Único
  const [singleCapacity, setSingleCapacity] = useState<number>(100)
  const [singleTicketTypes, setSingleTicketTypes] = useState<TicketType[]>([
    { id: crypto.randomUUID(), name: "Inteira", price: 50, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }
  ])

  // Gratuito
  const [freeCapacity, setFreeCapacity] = useState<number>(100)

  const [address, setAddress] = useState({ street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "" })
  
  const [isDistributeOpen, setIsDistributeOpen] = useState(false)
  const [distributeBatchIdx, setDistributeBatchIdx] = useState<number | null>(null)
  const [totalToDistribute, setTotalToDistribute] = useState("")

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

  useEffect(() => {
    if (!orgLoading && (!currentOrg || !isAtLeastEditor)) {
      toast({ variant: "destructive", title: "Acesso Restrito" })
      router.push("/dashboard/organizacoes")
    }
  }, [currentOrg, isAtLeastEditor, orgLoading, router])

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

  const handleCepBlur = async () => {
    const cleanCep = address.cep.replace(/\D/g, "")
    if (cleanCep.length !== 8) return
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await response.json()
      if (!data.erro) {
        setAddress(prev => ({
          ...prev,
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || ""
        }))
      }
    } catch (e) {}
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
    if(batches.length > 1) {
      setBatches(recalculateBatches(batches.filter((_, idx) => idx !== i)))
    }
  }

  const updateBatchField = (i: number, f: keyof Batch, v: any) => { 
    const n = [...batches]; 
    n[i] = { ...n[i], [f]: v } as any; 
    if (f === 'capacidadeInicial') setBatches(recalculateBatches(n)); else setBatches(n);
  }

  const updateTicketTypeField = (bi: number, ti: number, f: string, v: any) => { 
    const n = [...batches]; 
    n[bi].ticketTypes[ti] = { ...n[bi].ticketTypes[ti], [f]: v }; 
    setBatches(n); 
  }

  const addTicketType = (bi: number) => { 
    const n = [...batches]; 
    n[bi].ticketTypes.push({ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }); 
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
    if (!db || !user || !currentOrg || !isAtLeastEditor) return

    // Validar datas para modos simples
    if ((ticketMode === 'free' || ticketMode === 'paid_single') && (!globalSalesStart || !globalSalesEnd)) {
      toast({ variant: "destructive", title: "Datas de venda obrigatórias" })
      return
    }

    setLoading(true)
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
          startDate: globalSalesStart,
          endDate: globalSalesEnd,
          capacidadeInicial: singleCapacity,
          capacidadeAtual: singleCapacity,
          vendidos: 0,
          restantes: singleCapacity,
          migradosDoLoteAnterior: 0,
          ticketTypes: singleTicketTypes
        }]
      } else if (ticketMode === 'free') {
        totalCapacity = freeCapacity
        finalBatches = [{
          id: 'free',
          name: 'Ingresso Gratuito',
          description: '',
          startDate: globalSalesStart,
          endDate: globalSalesEnd,
          capacidadeInicial: freeCapacity,
          capacidadeAtual: freeCapacity,
          vendidos: 0,
          restantes: freeCapacity,
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
        address, image: uploadedImageUrl || "",
        organizationId: currentOrg.id, 
        organizerId: user.uid,
        organizer: {
          id: currentOrg.id,
          name: currentOrg.name,
          username: currentOrg.username,
          avatar: currentOrg.avatar || "",
          isVerified: currentOrg.verified || false
        },
        status: "Ativo", city: address.city, createdAt: serverTimestamp()
      }

      const docRef = await addDoc(collection(db, "events"), eventData)
      
      toast({ title: "Evento Publicado!" })
      router.push("/dashboard/organizacoes")
    } catch (error: any) { 
      toast({ variant: "destructive", title: "Erro ao publicar", description: error.message }) 
    } finally { 
      setLoading(false) 
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 text-foreground">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <h1 className="text-3xl font-black italic tracking-tighter text-primary uppercase">Publicar Novo Evento</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="overflow-hidden border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="w-5 h-5 text-secondary" /> Capa</CardTitle></CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="relative aspect-video rounded-[1.5rem] bg-muted overflow-hidden cursor-pointer" onClick={() => document.getElementById('img-up')?.click()}>
              {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" /> : <div className="flex flex-col items-center justify-center h-full opacity-20"><Upload className="w-10 h-10 mb-2" /><p className="text-xs font-bold uppercase tracking-widest">Carregar Imagem</p></div>}
              <input id="img-up" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
            </div>
            {uploadProgress !== null && <Progress value={uploadProgress} className="h-1 mt-4" />}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5 text-secondary" /> Informações Básicas</CardTitle></CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><Label>Título</Label><Input name="title" required className="rounded-xl h-11" placeholder="Nome do seu evento" /></div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="rounded-xl">{categories?.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
             </div>
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><Label>Início do Evento</Label><Input name="startDate" type="datetime-local" required className="rounded-xl h-11 text-xs" /></div>
                <div className="space-y-2"><Label>Término do Evento</Label><Input name="endDate" type="datetime-local" required className="rounded-xl h-11 text-xs" /></div>
             </div>
             <div className="space-y-2"><Label>Descrição</Label><Textarea name="description" className="min-h-[120px] rounded-xl border-dashed border-secondary/30" required placeholder="Fale tudo sobre a experiência..." /></div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden">
           <CardHeader className="bg-primary/5">
              <CardTitle className="text-lg flex items-center gap-2"><MapIcon className="w-5 h-5 text-primary" /> Estrutura do Evento (Mapa)</CardTitle>
              <CardDescription>O mapa visual é opcional e independente do tipo de ingresso.</CardDescription>
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
          <CardContent className="p-6 space-y-8">
             {ticketMode === 'none' && (
               <div className="py-12 text-center space-y-4">
                  <InfoIcon className="w-12 h-12 mx-auto text-muted-foreground opacity-20" />
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Evento Informativo</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">Este evento não terá venda de ingressos. O público verá apenas as informações e localização.</p>
               </div>
             )}

             {(ticketMode === 'free' || ticketMode === 'paid_single') && (
                <div className="p-6 bg-muted/20 rounded-[1.5rem] border-2 border-dashed border-border space-y-6">
                   <div className="flex items-center gap-2 text-secondary font-black uppercase text-[10px] tracking-widest">
                      <Clock className="w-4 h-4" /> Janela de Venda dos Ingressos
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60">Início das Vendas</Label>
                        <Input type="datetime-local" value={globalSalesStart} onChange={e => setGlobalSalesStart(e.target.value)} required className="rounded-xl h-11 text-xs" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60">Fim das Vendas</Label>
                        <Input type="datetime-local" value={globalSalesEnd} onChange={e => setGlobalSalesEnd(e.target.value)} required className="rounded-xl h-11 text-xs" />
                      </div>
                   </div>
                   <p className="text-[9px] text-muted-foreground uppercase font-bold">* Fora deste período, o botão de compra ficará desabilitado.</p>
                </div>
             )}

             {ticketMode === 'free' && (
               <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="p-6 bg-white rounded-2xl border flex flex-col items-center gap-4">
                     <Label className="text-xs font-black uppercase tracking-widest">Quantidade de Ingressos Gratuitos</Label>
                     <Input 
                       type="number" 
                       value={freeCapacity} 
                       onChange={e => setFreeCapacity(parseInt(e.target.value) || 0)} 
                       className="h-14 text-2xl font-black rounded-xl text-center border-secondary/20 max-w-[200px]" 
                     />
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
                        <div key={t.id} className="p-4 bg-white rounded-2xl border shadow-sm grid grid-cols-12 gap-4 items-end transition-all hover:border-secondary/20">
                           <div className="col-span-6 space-y-2">
                              <Label className="text-[9px] uppercase font-black opacity-40">Título do Ingresso</Label>
                              <Input value={t.name} onChange={e => { const n = [...singleTicketTypes]; n[ti].name = e.target.value; setSingleTicketTypes(n); }} className="rounded-xl h-10 font-bold" />
                           </div>
                           <div className="col-span-4 space-y-2">
                              <Label className="text-[9px] uppercase font-black opacity-40">Preço (R$)</Label>
                              <Input type="number" step="0.01" value={t.price} onChange={e => { const n = [...singleTicketTypes]; n[ti].price = parseFloat(e.target.value) || 0; setSingleTicketTypes(n); }} className="rounded-xl h-10 font-black text-secondary" />
                           </div>
                           <div className="col-span-2 flex justify-end pb-1">
                              <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => { if(singleTicketTypes.length > 1) setSingleTicketTypes(singleTicketTypes.filter((_, idx) => idx !== ti)) }}><X className="w-4 h-4" /></Button>
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
                      <div className="flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-3">
                           <h3 className="font-black italic uppercase text-secondary text-xl">{batch.name}</h3>
                           <Badge variant="outline" className="text-[10px] font-bold uppercase">Janela #{bi+1}</Badge>
                        </div>
                        <div className="flex gap-2">
                           <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase border-secondary text-secondary gap-1.5" onClick={() => { setDistributeBatchIdx(bi); setTotalToDistribute(batch.capacidadeInicial.toString()); setIsDistributeOpen(true); }}>
                              <Sparkles className="w-3 h-3" /> Gerar Meia
                           </Button>
                           <Button type="button" variant="ghost" size="icon" className="text-destructive rounded-full" onClick={() => removeBatch(bi)} disabled={batches.length === 1}><X className="w-4 h-4" /></Button>
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
                            <Label className="text-[10px] font-black uppercase opacity-60">Nome do Lote</Label>
                            <Input value={batch.name} onChange={e => updateBatchField(bi, 'name', e.target.value)} className="rounded-xl h-11" />
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Início das Vendas</Label><Input type="datetime-local" value={batch.startDate} onChange={e => updateBatchField(bi, 'startDate', e.target.value)} required className="rounded-xl h-11 text-xs" /></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Fim das Vendas</Label><Input type="datetime-local" value={batch.endDate} onChange={e => updateBatchField(bi, 'endDate', e.target.value)} required className="rounded-xl h-11 text-xs" /></div>
                      </div>

                      <div className="space-y-4">
                         {batch.ticketTypes.map((t, ti) => (
                           <div key={t.id} className="p-4 bg-white rounded-2xl border shadow-sm grid grid-cols-12 gap-4 items-end">
                              <div className="col-span-6 space-y-2">
                                 <Label className="text-[9px] uppercase font-black opacity-40">Título</Label>
                                 <Input value={t.name} onChange={e => updateTicketTypeField(bi, ti, 'name', e.target.value)} className="rounded-xl h-10 font-bold" />
                              </div>
                              <div className="col-span-4 space-y-2">
                                <Label className="text-[9px] uppercase font-black opacity-40">Preço (R$)</Label>
                                <Input type="number" step="0.01" value={t.price} onChange={e => updateTicketTypeField(bi, ti, 'price', parseFloat(e.target.value) || 0)} className="rounded-xl h-10 font-black text-secondary" />
                              </div>
                              <div className="col-span-2 flex justify-end pb-1"><Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeTicketType(bi, ti)} disabled={batch.ticketTypes.length === 1}><X className="w-4 h-4" /></Button></div>
                           </div>
                         ))}
                         <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase gap-1.5" onClick={() => addTicketType(bi)}><Plus className="w-3 h-3" /> Adicionar Categoria</Button>
                      </div>

                      {bi < batches.length - 1 && (
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20">
                           <div className="bg-secondary text-white p-1 rounded-full shadow-lg"><ArrowDown className="w-4 h-4" /></div>
                        </div>
                      )}
                   </div>
                 ))}
                 <Button type="button" variant="outline" className="w-full h-14 rounded-2xl border-dashed font-black uppercase italic" onClick={addBatch}><Plus className="w-5 h-5 mr-2" /> Adicionar Lote</Button>

                 <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
                    <Info className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase">
                      As sobras de cada lote migram automaticamente para o próximo. A capacidade total do evento será a soma das cargas iniciais de todos os lotes.
                    </p>
                 </div>
               </div>
             )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading} className="w-full h-16 rounded-[2rem] bg-secondary text-white font-black text-xl shadow-xl uppercase italic hover:scale-[1.02] transition-transform">
          {loading ? <Loader2 className="animate-spin mr-2" /> : <><Save className="mr-2 w-6 h-6" /> Publicar Evento</>}
        </Button>
      </form>

      <Dialog open={isDistributeOpen} onOpenChange={setIsDistributeOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Gerar Meia-Entrada</DialogTitle>
            <DialogDescription>O sistema criará as cotas automáticas baseadas na carga definida.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
             <Label className="text-[10px] font-black uppercase opacity-60">Capacidade da Janela (Ex: 200)</Label>
             <Input 
               type="number" 
               placeholder="Ex: 200"
               value={totalToDistribute} 
               onChange={e => setTotalToDistribute(e.target.value)} 
               className="h-14 text-2xl font-black rounded-xl text-center border-secondary/20" 
             />
             <div className="p-4 bg-muted/30 rounded-2xl flex gap-3">
                <Info className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                <p className="text-[9px] font-bold text-muted-foreground uppercase leading-tight">
                  Inteira e Meias compartilharão o mesmo estoque (Pool). A venda de uma meia reduzirá o total disponível da janela.
                </p>
             </div>
          </div>
          <DialogFooter>
            <Button onClick={handleDistribute} disabled={!totalToDistribute} className="w-full bg-secondary text-white font-black h-12 rounded-xl shadow-lg uppercase italic">Confirmar Carga</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
