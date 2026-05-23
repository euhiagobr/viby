
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useFirebaseApp, useCollection, useMemoFirebase } from "@/firebase"
import { updateDoc, doc, collection, serverTimestamp, deleteField } from "firebase/firestore"
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
  Calendar, 
  Plus, 
  Trash2, 
  Loader2, 
  ImageIcon,
  Save,
  Ticket,
  Map as MapIcon,
  X,
  InfoIcon,
  Clock,
  Layout,
  Armchair,
  Grid3X3,
  ArrowDown,
  Sparkles,
  Info
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
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

  const eventRef = React.useMemo(() => (db && eventId) ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const storage = React.useMemo(() => app ? getStorage(app, "gs://viby") : null, [app])
  const categoriesQuery = useMemoFirebase(() => db ? collection(db, "categories") : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  
  const [ticketMode, setTicketMode] = useState<'none' | 'free' | 'paid_single' | 'batches'>('free')
  const [mapMode, setMapMode] = useState<'none' | 'setores' | 'assentos' | 'mesas'>('none')
  
  const [selectedCategory, setSelectedCategory] = useState("")
  
  // Datas globais para modos simples
  const [globalSalesStart, setGlobalSalesStart] = useState("")
  const [globalSalesEnd, setGlobalSalesEnd] = useState("")

  // Lotes
  const [batches, setBatches] = useState<Batch[]>([])
  
  // Valor Único
  const [singleCapacity, setSingleCapacity] = useState<number>(100)
  const [singleTicketTypes, setSingleTicketTypes] = useState<TicketType[]>([])

  // Gratuito
  const [freeCapacity, setFreeCapacity] = useState<number>(100)

  const [address, setAddress] = useState<any>(null)
  
  const [isDistributeOpen, setIsDistributeOpen] = useState(false)
  const [distributeBatchIdx, setDistributeBatchIdx] = useState<number | null>(null)
  const [totalToDistribute, setTotalToDistribute] = useState("")

  useEffect(() => {
    if (event) {
      setTicketMode(event.ticketMode || 'none')
      setMapMode(event.mapMode || 'none')
      setSelectedCategory(event.categoryId || "")
      setImagePreview(event.image || null)
      setAddress(event.address || { street: "", city: "", state: "", neighborhood: "", complement: "", number: "", cep: "", country: "Brasil" })
      
      if (event.ticketMode === 'free') {
        setFreeCapacity(event.capacidadeTotal || 0)
        setGlobalSalesStart(event.batches?.[0]?.startDate || "")
        setGlobalSalesEnd(event.batches?.[0]?.endDate || "")
      } else if (event.ticketMode === 'paid_single') {
        setSingleCapacity(event.capacidadeTotal || 0)
        setSingleTicketTypes(event.batches?.[0]?.ticketTypes || [])
        setGlobalSalesStart(event.batches?.[0]?.startDate || "")
        setGlobalSalesEnd(event.batches?.[0]?.endDate || "")
      } else if (event.ticketMode === 'batches') {
        setBatches(event.batches || [])
      }
    }
  }, [event])

  const recalculateBatches = (currentBatches: Batch[]) => {
    const updated = [...currentBatches];
    let carryOver = 0;
    for (let i = 0; i < updated.length; i++) {
      const b = updated[i];
      b.migradosDoLoteAnterior = carryOver;
      b.capacidadeAtual = (b.capacidadeInicial || 0) + carryOver;
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
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
    const storageRef = ref(storage, `events/${user.uid}/${fileName}`)
    const uploadTask = uploadBytesResumable(storageRef, file)
    uploadTask.on('state_changed', 
      (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100),
      () => setUploadProgress(null),
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
        setUploadedImageUrl(downloadURL)
        setUploadProgress(null)
      }
    )
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
    toast({ title: "Meia-entrada atualizada!" })
  }

  const addBatch = () => {
    const newB: Batch = { id: crypto.randomUUID(), name: `Novo Lote`, description: "", startDate: "", endDate: "", capacidadeInicial: 100, capacidadeAtual: 100, vendidos: 0, restantes: 100, migradosDoLoteAnterior: 0, ticketTypes: [{ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }] }
    setBatches(recalculateBatches([...batches, newB]))
  }

  const removeBatch = (i: number) => {
    if(batches.length > 1) {
      setBatches(recalculateBatches(batches.filter((_, idx) => idx !== i)))
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !eventRef) return
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    
    try {
      let finalBatches: Batch[] = []
      let totalCapacity = 0

      if (ticketMode === 'batches') {
        finalBatches = recalculateBatches(batches)
        totalCapacity = finalBatches.reduce((acc, b) => acc + (b.capacidadeInicial || 0), 0)
      } else if (ticketMode === 'paid_single') {
        totalCapacity = singleCapacity
        finalBatches = [{
          id: 'single', name: 'Lote Único', description: '',
          startDate: globalSalesStart, endDate: globalSalesEnd,
          capacidadeInicial: singleCapacity, capacidadeAtual: singleCapacity,
          vendidos: event.batches?.[0]?.vendidos || 0,
          restantes: singleCapacity - (event.batches?.[0]?.vendidos || 0),
          migradosDoLoteAnterior: 0, ticketTypes: singleTicketTypes
        }]
      } else if (ticketMode === 'free') {
        totalCapacity = freeCapacity
        finalBatches = [{
          id: 'free', name: 'Ingresso Gratuito', description: '',
          startDate: globalSalesStart, endDate: globalSalesEnd,
          capacidadeInicial: freeCapacity, capacidadeAtual: freeCapacity,
          vendidos: event.batches?.[0]?.vendidos || 0,
          restantes: freeCapacity - (event.batches?.[0]?.vendidos || 0),
          migradosDoLoteAnterior: 0, ticketTypes: [{ id: 'free_type', name: 'Gratuito', price: 0, quantity: freeCapacity, requiresProof: false, isLegalHalf: false, description: '' }]
        }]
      }

      const updateData: any = {
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        date: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory,
        categoryName: categories?.find(c => c.id === selectedCategory)?.name || "Outros",
        ticketMode,
        mapMode,
        possuiMapa: mapMode !== 'none',
        capacidadeTotal: totalCapacity,
        batches: ticketMode === 'none' ? [] : finalBatches,
        image: uploadedImageUrl || event.image || "",
        address: address,
        city: address.city,
        updatedAt: serverTimestamp()
      }

      await updateDoc(eventRef, updateData)
      toast({ title: "Evento Atualizado!" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message })
    } finally {
      setSaving(false)
    }
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 text-foreground">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <h1 className="text-3xl font-black italic tracking-tighter text-primary uppercase">Editar Evento</h1>
        </div>
        {mapMode !== 'none' && (
           <Button asChild className="bg-primary text-white font-black rounded-xl px-6 h-11 uppercase italic shadow-lg">
              <Link href={`/dashboard/evento/${eventId}/mapa`}><MapIcon className="w-4 h-4 mr-2" /> Planta Visual</Link>
           </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="overflow-hidden border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="w-5 h-5 text-secondary" /> Imagem de Capa</CardTitle></CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="relative aspect-video rounded-[1.5rem] bg-muted overflow-hidden cursor-pointer" onClick={() => document.getElementById('img-up')?.click()}>
              {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" /> : <div className="flex flex-col items-center justify-center h-full opacity-20"><Upload className="w-10 h-10 mb-2" /><p className="text-xs font-bold uppercase tracking-widest">Carregar Imagem</p></div>}
              <input id="img-up" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5 text-secondary" /> Informações do Evento</CardTitle></CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><Label>Título</Label><Input name="title" defaultValue={event.title} required className="rounded-xl h-11" /></div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{categories?.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
             </div>
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><Label>Início do Evento</Label><Input name="startDate" type="datetime-local" defaultValue={event.date} required className="rounded-xl h-11 text-xs" /></div>
                <div className="space-y-2"><Label>Término do Evento</Label><Input name="endDate" type="datetime-local" defaultValue={event.endDate} required className="rounded-xl h-11 text-xs" /></div>
             </div>
             <div className="space-y-2"><Label>Descrição</Label><Textarea name="description" defaultValue={event.description} className="min-h-[120px] rounded-xl" required /></div>
          </CardContent>
        </Card>

        {/* ESTRUTURA DO EVENTO (MAPA) */}
        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden">
           <CardHeader className="bg-primary/5">
              <CardTitle className="text-lg flex items-center gap-2"><MapIcon className="w-5 h-5 text-primary" /> Estrutura do Evento (Mapa)</CardTitle>
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

        {/* MODO DE BILHETERIA */}
        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Configuração Comercial</CardTitle>
              <div className="bg-white p-1 rounded-xl border flex flex-wrap gap-1">
                <Button type="button" variant={ticketMode === 'none' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-3" onClick={() => setTicketMode('none')}>Sem Ingresso</Button>
                <Button type="button" variant={ticketMode === 'free' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-3" onClick={() => setTicketMode('free')}>Grátis</Button>
                <Button type="button" variant={ticketMode === 'paid_single' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-3" onClick={() => setTicketMode('paid_single')}>Valor Único</Button>
                <Button type="button" variant={ticketMode === 'batches' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-3" onClick={() => setTicketMode('batches')}>Lotes</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
             {(ticketMode === 'free' || ticketMode === 'paid_single') && (
                <div className="p-6 bg-muted/20 rounded-[1.5rem] border-2 border-dashed border-border space-y-6 mb-6">
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
                </div>
             )}

             {ticketMode === 'free' && (
               <div className="p-6 bg-white rounded-2xl border flex flex-col items-center gap-4">
                  <Label className="text-xs font-black uppercase tracking-widest">Quantidade de Ingressos Gratuitos</Label>
                  <Input type="number" value={freeCapacity} onChange={e => setFreeCapacity(parseInt(e.target.value) || 0)} className="h-14 text-2xl font-black rounded-xl text-center border-secondary/20 max-w-[200px]" />
               </div>
             )}

             {ticketMode === 'paid_single' && (
               <div className="space-y-6">
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
                        <div className="col-span-2 flex justify-end pb-1"><Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => { if(singleTicketTypes.length > 1) setSingleTicketTypes(singleTicketTypes.filter((_, idx) => idx !== ti)) }}><Trash2 className="w-4 h-4" /></Button></div>
                      </div>
                    ))}
                  </div>
               </div>
             )}

             {ticketMode === 'batches' && (
               <div className="space-y-8">
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
                           <Button type="button" variant="ghost" size="icon" className="text-destructive rounded-full" onClick={() => removeBatch(bi)} disabled={batches.length === 1}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Início das Vendas</Label><Input type="datetime-local" value={batch.startDate} onChange={e => updateBatchField(bi, 'startDate', e.target.value)} required className="rounded-xl h-11 text-xs" /></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Fim das Vendas</Label><Input type="datetime-local" value={batch.endDate} onChange={e => updateBatchField(bi, 'endDate', e.target.value)} required className="rounded-xl h-11 text-xs" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Carga Inicial</Label><Input type="number" value={batch.capacidadeInicial} onChange={e => updateBatchField(bi, 'capacidadeInicial', parseInt(e.target.value) || 0)} className="rounded-xl h-11 font-black text-primary" /></div>
                         <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nome</Label><Input value={batch.name} onChange={e => updateBatchField(bi, 'name', e.target.value)} className="rounded-xl h-11" /></div>
                      </div>
                      <div className="space-y-4">
                         {batch.ticketTypes.map((t, ti) => (
                           <div key={t.id} className="p-4 bg-white rounded-2xl border shadow-sm grid grid-cols-12 gap-4 items-end">
                              <div className="col-span-6 space-y-2"><Label className="text-[9px] uppercase font-black opacity-40">Título</Label><Input value={t.name} onChange={e => updateTicketTypeField(bi, ti, 'name', e.target.value)} className="rounded-xl h-10 font-bold" /></div>
                              <div className="col-span-4 space-y-2"><Label className="text-[9px] uppercase font-black opacity-40">Preço (R$)</Label><Input type="number" step="0.01" value={t.price} onChange={e => updateTicketTypeField(bi, ti, 'price', parseFloat(e.target.value) || 0)} className="rounded-xl h-10 font-black text-secondary" /></div>
                              <div className="col-span-2 flex justify-end pb-1"><Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeTicketType(bi, ti)} disabled={batch.ticketTypes.length === 1}><Trash2 className="w-4 h-4" /></Button></div>
                           </div>
                         ))}
                         <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase gap-1.5" onClick={() => addTicketType(bi)}><Plus className="w-3 h-3" /> Adicionar Categoria</Button>
                      </div>
                   </div>
                 ))}
                 <Button type="button" variant="outline" className="w-full h-14 rounded-2xl border-dashed font-black uppercase italic" onClick={addBatch}><Plus className="w-5 h-5 mr-2" /> Adicionar Lote</Button>
               </div>
             )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving} className="w-full h-16 bg-secondary text-white font-black text-xl rounded-[2rem] shadow-xl uppercase italic">
          {saving ? <Loader2 className="animate-spin mr-2" /> : <><Save className="mr-2" /> Salvar Alterações</>}
        </Button>
      </form>

      <Dialog open={isDistributeOpen} onOpenChange={setIsDistributeOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Carga de Ingressos</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
             <Label className="text-[10px] font-black uppercase opacity-60">Capacidade desta Janela</Label>
             <Input type="number" value={totalToDistribute} onChange={e => setTotalToDistribute(e.target.value)} className="h-14 text-2xl font-black rounded-xl text-center" />
          </div>
          <DialogFooter><Button onClick={handleDistribute} className="w-full bg-secondary text-white font-black h-12 rounded-xl">Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function updateTicketTypeField(bi: number, ti: number, f: string, v: any) {
  throw new Error("Function not implemented.")
}

function removeTicketType(bi: number, ti: number) {
  throw new Error("Function not implemented.")
}

function addTicketType(bi: number) {
  throw new Error("Function not implemented.")
}
