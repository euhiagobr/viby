
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useFirebaseApp, useCollection, useMemoFirebase } from "@/firebase"
import { updateDoc, doc, collection, serverTimestamp, deleteField } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { 
  Loader2, 
  ArrowLeft, 
  Upload, 
  Calendar, 
  Ticket, 
  ImageIcon,
  Save,
  Map as MapIcon,
  X,
  Sparkles,
  Clock,
  Info,
  CheckCircle2
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface Batch {
  id: string
  name: string
  price: number
  initialCapacity: number
  salesStartDate: string
  salesStartTime: string
  salesEndDate: string
  salesEndTime: string
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

  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  
  const [ticketMode, setTicketMode] = useState<'none' | 'free' | 'paid_single' | 'batches'>('free')
  const [hasMap, setHasMap] = useState(false)
  const [autoHalfPrice, setAutoHalfPrice] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("")

  const [freeConfig, setFreeConfig] = useState({ name: "Ingresso Gratuito", quantity: 100, startD: "", startT: "", endD: "", endT: "" })
  const [singleConfig, setSingleConfig] = useState({ name: "Ingresso Único", quantity: 100, price: 50, startD: "", startT: "", endD: "", endT: "" })
  const [batches, setBatches] = useState<Batch[]>([])

  useEffect(() => {
    if (event) {
      setTicketMode(event.ticketMode || 'none')
      setHasMap(event.hasMap || false)
      setAutoHalfPrice(event.autoHalfPrice || false)
      setSelectedCategory(event.categoryId || "")
      setImagePreview(event.image || null)
      
      const firstBatch = event.batches?.[0];
      if (event.ticketMode === 'free' && firstBatch) {
        setFreeConfig({
          name: firstBatch.name,
          quantity: firstBatch.initialCapacity,
          startD: firstBatch.salesStart?.split('T')[0] || "",
          startT: firstBatch.salesStart?.split('T')[1] || "",
          endD: firstBatch.salesEnd?.split('T')[0] || "",
          endT: firstBatch.salesEnd?.split('T')[1] || ""
        })
      } else if (event.ticketMode === 'paid_single' && firstBatch) {
        setSingleConfig({
          name: firstBatch.name,
          quantity: firstBatch.initialCapacity,
          price: firstBatch.price,
          startD: firstBatch.salesStart?.split('T')[0] || "",
          startT: firstBatch.salesStart?.split('T')[1] || "",
          endD: firstBatch.salesEnd?.split('T')[0] || "",
          endT: firstBatch.salesEnd?.split('T')[1] || ""
        })
      } else if (event.ticketMode === 'batches') {
        setBatches(event.batches?.map((b: any) => ({
          ...b,
          salesStartDate: b.salesStart?.split('T')[0] || "",
          salesStartTime: b.salesStart?.split('T')[1] || "",
          salesEndDate: b.salesEnd?.split('T')[0] || "",
          salesEndTime: b.salesEnd?.split('T')[1] || ""
        })) || [])
      }
    }
  }, [event])

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return
    setImagePreview(URL.createObjectURL(file))
    setUploadProgress(0)
    const storageRef = ref(storage, `events/${user.uid}/${Date.now()}_${file.name}`)
    const uploadTask = uploadBytesResumable(storageRef, file)
    uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), () => setUploadProgress(null), async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref); setUploadedImageUrl(url); setUploadProgress(null)
    })
  }

  const addBatch = () => setBatches([...batches, { id: crypto.randomUUID(), name: `Lote ${batches.length + 1}`, price: 100, initialCapacity: 100, salesStartDate: "", salesStartTime: "", salesEndDate: "", salesEndTime: "" }])
  const updateBatchField = (i: number, f: keyof Batch, v: any) => { const n = [...batches]; n[i] = { ...n[i], [f]: v } as any; setBatches(n); }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !eventRef) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      let finalBatches: any[] = []
      if (ticketMode === 'free') {
        finalBatches = [{ id: 'free', name: freeConfig.name, price: 0, initialCapacity: freeConfig.quantity, currentCapacity: freeConfig.quantity, salesStart: `${freeConfig.startD}T${freeConfig.startT}`, salesEnd: `${freeConfig.endD}T${freeConfig.endT}` }]
      } else if (ticketMode === 'paid_single') {
        finalBatches = [{ id: 'single', name: singleConfig.name, price: singleConfig.price, initialCapacity: singleConfig.quantity, currentCapacity: singleConfig.quantity, salesStart: `${singleConfig.startD}T${singleConfig.startT}`, salesEnd: `${singleConfig.endD}T${singleConfig.endT}` }]
      } else if (ticketMode === 'batches') {
        finalBatches = batches.map(b => ({ ...b, initialCapacity: Number(b.initialCapacity), currentCapacity: Number(b.initialCapacity), salesStart: `${b.salesStartDate}T${b.salesStartTime}`, salesEnd: `${b.salesEndDate}T${b.salesEndTime}` }))
      }

      const updateData: any = {
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        date: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory,
        categoryName: categories?.find(c => c.id === selectedCategory)?.name || "Outros",
        ticketMode, hasMap, autoHalfPrice,
        image: uploadedImageUrl || event.image || "",
        batches: ticketMode === 'none' ? [] : finalBatches,
        updatedAt: serverTimestamp()
      }

      await updateDoc(eventRef, updateData)
      toast({ title: "Evento Atualizado!" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message })
    } finally {
      setLoading(false)
    }
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Editar Evento</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden">
          <CardHeader className="bg-muted/30"><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="w-5 h-5" /> Mídia</CardTitle></CardHeader>
          <CardContent className="p-8">
            <div className="relative aspect-video bg-muted rounded-[2rem] overflow-hidden cursor-pointer group" onClick={() => document.getElementById('edit-img-up')?.click()}>
              {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <div className="h-full flex flex-col items-center justify-center opacity-30"><Upload className="w-10 h-10 mb-2" /></div>}
              <input id="edit-img-up" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
            </div>
            {uploadProgress !== null && <Progress value={uploadProgress} className="h-1 mt-4" />}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2.5rem]">
          <CardHeader><CardTitle className="text-lg">Informações</CardTitle></CardHeader>
          <CardContent className="p-8 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Título</Label><Input name="title" defaultValue={event.title} required className="rounded-xl h-11" /></div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Categoria</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Início</Label><Input name="startDate" type="datetime-local" defaultValue={event.date} required className="rounded-xl h-11" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Fim</Label><Input name="endDate" type="datetime-local" defaultValue={event.endDate} required className="rounded-xl h-11" /></div>
             </div>
             <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Descrição</Label><Textarea name="description" defaultValue={event.description} className="min-h-[120px] rounded-xl" required /></div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-secondary/5 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria</CardTitle>
              <div className="bg-white p-1 rounded-xl border flex gap-1">
                {['none', 'free', 'paid_single', 'batches'].map((mode: any) => (
                  <Button key={mode} type="button" variant={ticketMode === mode ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[9px] font-black uppercase px-4" onClick={() => setTicketMode(mode)}>
                    {mode === 'none' ? 'Sem Ingresso' : mode === 'free' ? 'Grátis' : mode === 'paid_single' ? 'Único' : 'Lotes'}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            {ticketMode === 'free' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Nome</Label><Input value={freeConfig.name} onChange={e => setFreeConfig({...freeConfig, name: e.target.value})} /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Quantidade</Label><Input type="number" value={freeConfig.quantity} onChange={e => setFreeConfig({...freeConfig, quantity: Number(e.target.value)})} /></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-xl">
                  <div className="space-y-2"><Label className="text-[9px] uppercase">Data Início</Label><Input type="date" value={freeConfig.startD} onChange={e => setFreeConfig({...freeConfig, startD: e.target.value})} /></div>
                  <div className="space-y-2"><Label className="text-[9px] uppercase">Hora</Label><Input type="time" value={freeConfig.startT} onChange={e => setFreeConfig({...freeConfig, startT: e.target.value})} /></div>
                  <div className="space-y-2"><Label className="text-[9px] uppercase">Data Fim</Label><Input type="date" value={freeConfig.endD} onChange={e => setFreeConfig({...freeConfig, endD: e.target.value})} /></div>
                  <div className="space-y-2"><Label className="text-[9px] uppercase">Hora</Label><Input type="time" value={freeConfig.endT} onChange={e => setFreeConfig({...freeConfig, endT: e.target.value})} /></div>
                </div>
              </div>
            )}

            {ticketMode === 'paid_single' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Nome</Label><Input value={singleConfig.name} onChange={e => setSingleConfig({...singleConfig, name: e.target.value})} /></div>
                   <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Preço</Label><Input type="number" step="0.01" value={singleConfig.price} onChange={e => setSingleConfig({...singleConfig, price: Number(e.target.value)})} /></div>
                   <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Capacidade</Label><Input type="number" value={singleConfig.quantity} onChange={e => setSingleConfig({...singleConfig, quantity: Number(e.target.value)})} /></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-xl">
                  <div className="space-y-2"><Label className="text-[9px] uppercase">Data Início</Label><Input type="date" value={singleConfig.startD} onChange={e => setSingleConfig({...singleConfig, startD: e.target.value})} /></div>
                  <div className="space-y-2"><Label className="text-[9px] uppercase">Hora</Label><Input type="time" value={singleConfig.startT} onChange={e => setSingleConfig({...singleConfig, startT: e.target.value})} /></div>
                  <div className="space-y-2"><Label className="text-[9px] uppercase">Data Fim</Label><Input type="date" value={singleConfig.endD} onChange={e => setSingleConfig({...singleConfig, endD: e.target.value})} /></div>
                  <div className="space-y-2"><Label className="text-[9px] uppercase">Hora</Label><Input type="time" value={singleConfig.endT} onChange={e => setSingleConfig({...singleConfig, endT: e.target.value})} /></div>
                </div>
              </div>
            )}

            {ticketMode === 'batches' && (
              <div className="space-y-6">
                {batches.map((batch, bi) => (
                  <div key={batch.id} className="p-6 bg-muted/20 rounded-xl border border-dashed relative">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                       <Input value={batch.name} onChange={e => updateBatchField(bi, 'name', e.target.value)} placeholder="Nome do Lote" />
                       <Input type="number" step="0.01" value={batch.price} onChange={e => updateBatchField(bi, 'price', Number(e.target.value))} />
                       <Input type="number" value={batch.initialCapacity} onChange={e => updateBatchField(bi, 'initialCapacity', Number(e.target.value))} />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                       <Input type="date" value={batch.salesStartDate} onChange={e => updateBatchField(bi, 'salesStartDate', e.target.value)} />
                       <Input type="time" value={batch.salesStartTime} onChange={e => updateBatchField(bi, 'salesStartTime', e.target.value)} />
                       <Input type="date" value={batch.salesEndDate} onChange={e => updateBatchField(bi, 'salesEndDate', e.target.value)} />
                       <Input type="time" value={batch.salesEndTime} onChange={e => updateBatchField(bi, 'salesEndTime', e.target.value)} />
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" className="w-full h-12 border-dashed font-black uppercase" onClick={addBatch}>+ Novo Lote</Button>
              </div>
            )}

            {(ticketMode === 'paid_single' || ticketMode === 'batches') && (
              <div className="pt-6 border-t border-dashed space-y-4">
                 <div className="flex items-center justify-between p-4 bg-primary text-white rounded-2xl shadow-xl">
                    <div className="space-y-0.5">
                       <p className="font-black uppercase text-xs italic tracking-tighter flex items-center gap-2"><Sparkles className="w-4 h-4 text-secondary" /> Meia-Entrada Automática (Cota 40%)</p>
                    </div>
                    <Switch checked={autoHalfPrice} onCheckedChange={setAutoHalfPrice} />
                 </div>
                 <div className="flex items-center justify-between p-4 bg-muted/50 rounded-2xl">
                    <div className="space-y-0.5"><p className="font-black uppercase text-xs italic tracking-tighter flex items-center gap-2"><MapIcon className="w-4 h-4 text-secondary" /> Habilitar Lugar Marcado</p></div>
                    <Switch checked={hasMap} onCheckedChange={setHasMap} />
                 </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading} className="w-full h-16 bg-secondary text-white font-black text-xl rounded-[2rem] shadow-xl uppercase italic">
          {loading ? <Loader2 className="animate-spin mr-2" /> : <><CheckCircle2 className="mr-2" /> Salvar Alterações</>}
        </Button>
      </form>
    </div>
  )
}
