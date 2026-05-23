
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
  InfoIcon
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

interface TicketType {
  id: string
  name: string
  price: number
  quantity: number
}

interface Batch {
  id: string
  name: string
  capacity: number
  ticketTypes: TicketType[]
  startDate: string
  endDate: string
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
  const [hasMap, setHasMap] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("")
  
  const [freeQuantity, setFreeQuantity] = useState(100)
  const [singleValueTickets, setSingleValueTypes] = useState<TicketType[]>([])
  const [batches, setBatches] = useState<Batch[]>([])

  useEffect(() => {
    if (event) {
      setTicketMode(event.ticketMode || 'none')
      setHasMap(event.possuiMapa || false)
      setSelectedCategory(event.categoryId || "")
      setImagePreview(event.image || null)
      
      if (event.ticketMode === 'free') {
        setFreeQuantity(event.freeQuantity || 0)
      } else if (event.ticketMode === 'paid_single') {
        setSingleValueTypes(event.ticketTypes || [])
      } else if (event.ticketMode === 'batches') {
        setBatches(event.batches || [])
      }
    }
  }, [event])

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !eventRef) return
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    
    try {
      const updateData: any = {
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        date: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory,
        categoryName: categories?.find(c => c.id === selectedCategory)?.name || "Outros",
        ticketMode,
        possuiMapa: hasMap && (ticketMode === 'paid_single' || ticketMode === 'batches'),
        mapMode: hasMap ? (event.mapMode || 'setores') : 'none',
        image: uploadedImageUrl || event.image || "",
        city: formData.get("city") as string,
        updatedAt: serverTimestamp()
      }

      if (ticketMode === 'free') {
        updateData.freeQuantity = freeQuantity
        updateData.ticketTypes = deleteField()
        updateData.batches = deleteField()
      } else if (ticketMode === 'paid_single') {
        updateData.ticketTypes = singleValueTickets
        updateData.freeQuantity = deleteField()
        updateData.batches = deleteField()
      } else if (ticketMode === 'batches') {
        updateData.batches = batches
        updateData.freeQuantity = deleteField()
        updateData.ticketTypes = deleteField()
      } else {
        updateData.freeQuantity = deleteField()
        updateData.ticketTypes = deleteField()
        updateData.batches = deleteField()
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
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <h1 className="text-3xl font-black italic tracking-tighter text-primary uppercase">Editar Evento</h1>
        </div>
        {hasMap && (
           <Button asChild className="bg-primary text-white font-black rounded-xl px-6 h-11 uppercase italic shadow-lg">
              <Link href={`/dashboard/evento/${eventId}/mapa`}><MapIcon className="w-4 h-4 mr-2" /> Editar Mapa</Link>
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
             <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2"><Label>Início</Label><Input name="startDate" type="datetime-local" defaultValue={event.date} required className="rounded-xl h-11 text-xs" /></div>
                <div className="space-y-2"><Label>Término</Label><Input name="endDate" type="datetime-local" defaultValue={event.endDate} required className="rounded-xl h-11 text-xs" /></div>
                <div className="space-y-2"><Label>Cidade</Label><Input name="city" defaultValue={event.city} required className="rounded-xl h-11" /></div>
             </div>
             <div className="space-y-2"><Label>Descrição</Label><Textarea name="description" defaultValue={event.description} className="min-h-[120px] rounded-xl" required /></div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Estratégia Comercial</CardTitle>
              <div className="bg-white p-1 rounded-xl border flex gap-1">
                <Button type="button" variant={ticketMode === 'none' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase" onClick={() => setTicketMode('none')}>Sem Ingresso</Button>
                <Button type="button" variant={ticketMode === 'free' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase" onClick={() => setTicketMode('free')}>Grátis</Button>
                <Button type="button" variant={ticketMode === 'paid_single' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase" onClick={() => setTicketMode('paid_single')}>Único</Button>
                <Button type="button" variant={ticketMode === 'batches' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase" onClick={() => setTicketMode('batches')}>Lotes</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
             {ticketMode === 'free' && (
                <div className="space-y-4">
                   <div className="max-w-xs space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60">Qtd Gratuita</Label><Input type="number" value={freeQuantity} onChange={e => setFreeQuantity(Number(e.target.value))} className="rounded-xl h-11" /></div>
                </div>
             )}

             {(ticketMode === 'paid_single' || ticketMode === 'batches') && (
               <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-secondary/5 rounded-2xl border-2 border-dashed border-secondary/20">
                     <div><h4 className="font-black uppercase text-sm text-primary">Mapa & Lugar Marcado</h4><p className="text-[10px] text-muted-foreground font-medium">Habilitar seleção visual de assentos.</p></div>
                     <Switch checked={hasMap} onCheckedChange={setHasMap} />
                  </div>
                  
                  {ticketMode === 'paid_single' && (
                    <div className="space-y-4">
                       {singleValueTickets.map((t, idx) => (
                         <div key={t.id} className="grid grid-cols-12 gap-3 items-end bg-muted/10 p-4 rounded-xl border">
                            <div className="col-span-6"><Label className="text-[8px] font-bold">NOME</Label><Input value={t.name} onChange={e => { const n = [...singleValueTickets]; n[idx].name = e.target.value; setSingleValueTypes(n); }} /></div>
                            <div className="col-span-3"><Label className="text-[8px] font-bold">R$</Label><Input type="number" value={t.price} onChange={e => { const n = [...singleValueTickets]; n[idx].price = Number(e.target.value); setSingleValueTypes(n); }} /></div>
                            <div className="col-span-2"><Label className="text-[8px] font-bold">QTD</Label><Input type="number" value={t.quantity} onChange={e => { const n = [...singleValueTickets]; n[idx].quantity = Number(e.target.value); setSingleValueTypes(n); }} /></div>
                            <div className="col-span-1"><Button type="button" variant="ghost" onClick={() => setSingleValueTypes(singleValueTickets.filter((_, i) => i !== idx))}><X className="w-4 h-4" /></Button></div>
                         </div>
                       ))}
                       <Button type="button" variant="outline" size="sm" onClick={() => setSingleValueTypes([...singleValueTickets, { id: crypto.randomUUID(), name: "Novo", price: 0, quantity: 0 }])}>+ Adicionar Tipo</Button>
                    </div>
                  )}

                  {ticketMode === 'batches' && (
                    <div className="space-y-6">
                       {batches.map((b, bIdx) => (
                         <div key={b.id} className="p-4 rounded-2xl border bg-muted/5 space-y-4">
                            <div className="flex justify-between items-center"><Input value={b.name} onChange={e => { const n = [...batches]; n[bIdx].name = e.target.value; setBatches(n); }} className="w-1/2 font-bold" /><Button type="button" variant="ghost" size="icon" onClick={() => setBatches(batches.filter((_, i) => i !== bIdx))}><Trash2 className="w-4 h-4" /></Button></div>
                            <div className="grid grid-cols-12 gap-4">
                               <div className="col-span-6"><Label className="text-[8px] font-bold">INÍCIO</Label><Input type="datetime-local" value={b.startDate} onChange={e => { const n = [...batches]; n[bIdx].startDate = e.target.value; setBatches(n); }} /></div>
                               <div className="col-span-6"><Label className="text-[8px] font-bold">FIM</Label><Input type="datetime-local" value={b.endDate} onChange={e => { const n = [...batches]; n[bIdx].endDate = e.target.value; setBatches(n); }} /></div>
                            </div>
                         </div>
                       ))}
                       <Button type="button" variant="outline" className="w-full h-12 border-dashed rounded-xl" onClick={() => setBatches([...batches, { id: crypto.randomUUID(), name: "Novo Lote", capacity: 100, ticketTypes: [], startDate: "", endDate: "" }])}>+ Adicionar Lote</Button>
                    </div>
                  )}
               </div>
             )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving} className="w-full h-16 bg-secondary text-white font-black text-xl rounded-[2rem] shadow-xl uppercase italic">
          {saving ? <Loader2 className="animate-spin mr-2" /> : <><Save className="mr-2" /> Salvar Alterações</>}
        </Button>
      </form>
    </div>
  )
}
