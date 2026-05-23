
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
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
  Clock,
  Info,
  CheckCircle2
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"

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

export default function NovoEventoPage() {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg, userRole, loading: orgLoading } = useCurrentOrganization()

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

  // Form States
  const [freeConfig, setFreeConfig] = useState({ name: "Ingresso Gratuito", quantity: 100, startD: "", startT: "", endD: "", endT: "" })
  const [singleConfig, setSingleConfig] = useState({ name: "Ingresso Único", quantity: 100, price: 50, startD: "", startT: "", endD: "", endT: "" })
  const [batches, setBatches] = useState<Batch[]>([
    { id: crypto.randomUUID(), name: "Lote 1", price: 50, initialCapacity: 100, salesStartDate: "", salesStartTime: "", salesEndDate: "", salesEndTime: "" }
  ])

  const [address, setAddress] = useState({ street: "", city: "", state: "", neighborhood: "", number: "", complement: "", cep: "", country: "Brasil" })

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return
    setImagePreview(URL.createObjectURL(file))
    setUploadProgress(0)
    const storageRef = ref(storage, `events/${user.uid}/${Date.now()}_${file.name}`)
    const uploadTask = uploadBytesResumable(storageRef, file)
    uploadTask.on('state_changed', 
      (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100),
      () => setUploadProgress(null),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref)
        setUploadedImageUrl(url)
        setUploadProgress(null)
      }
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !currentOrg) return
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const cat = categories?.find(c => c.id === selectedCategory)

    try {
      const eventData: any = {
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        date: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory,
        categoryName: cat?.name || "Outros",
        ticketMode,
        hasMap,
        autoHalfPrice,
        image: uploadedImageUrl || "",
        address,
        organizationId: currentOrg.id,
        organizerId: user.uid,
        status: "Ativo",
        createdAt: serverTimestamp()
      }

      // Proccess Commercial Config
      if (ticketMode === 'free') {
        eventData.batches = [{
          id: 'free',
          name: freeConfig.name,
          price: 0,
          initialCapacity: freeConfig.quantity,
          currentCapacity: freeConfig.quantity,
          salesStart: `${freeConfig.startD}T${freeConfig.startT}`,
          salesEnd: `${freeConfig.endD}T${freeConfig.endT}`
        }]
      } else if (ticketMode === 'paid_single') {
        eventData.batches = [{
          id: 'single',
          name: singleConfig.name,
          price: singleConfig.price,
          initialCapacity: singleConfig.quantity,
          currentCapacity: singleConfig.quantity,
          salesStart: `${singleConfig.startD}T${singleConfig.startT}`,
          salesEnd: `${singleConfig.endD}T${singleConfig.endT}`
        }]
      } else if (ticketMode === 'batches') {
        eventData.batches = batches.map(b => ({
          ...b,
          initialCapacity: Number(b.initialCapacity),
          currentCapacity: Number(b.initialCapacity),
          salesStart: `${b.salesStartDate}T${b.salesStartTime}`,
          salesEnd: `${b.salesEndDate}T${b.salesEndTime}`
        }))
      }

      await addDoc(collection(db, "events"), eventData)
      toast({ title: "Evento Publicado!" })
      router.push("/dashboard/organizacoes")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Novo Projeto</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden">
          <CardHeader className="bg-muted/30"><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="w-5 h-5" /> Mídia</CardTitle></CardHeader>
          <CardContent className="p-8">
            <div className="relative aspect-video bg-muted rounded-[2rem] overflow-hidden cursor-pointer group" onClick={() => document.getElementById('img-up')?.click()}>
              {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <div className="h-full flex flex-col items-center justify-center opacity-30"><Upload className="w-10 h-10 mb-2" /><p className="text-[10px] font-black uppercase">Capa do Evento</p></div>}
              <input id="img-up" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
            </div>
            {uploadProgress !== null && <Progress value={uploadProgress} className="h-1 mt-4" />}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2.5rem]">
          <CardHeader><CardTitle className="text-lg">Essenciais</CardTitle></CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Título</Label><Input name="title" required className="rounded-xl h-12" /></div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Categoria</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory} required>
                  <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="rounded-xl">{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Data Início</Label><Input name="startDate" type="datetime-local" required className="rounded-xl h-12" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Data Fim</Label><Input name="endDate" type="datetime-local" required className="rounded-xl h-12" /></div>
            </div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Descrição</Label><Textarea name="description" className="min-h-[150px] rounded-2xl resize-none" required /></div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden">
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
            {ticketMode === 'none' && <div className="py-10 text-center opacity-30 italic">Apenas informativo. Sem checkout.</div>}

            {ticketMode === 'free' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nome do Ingresso</Label><Input value={freeConfig.name} onChange={e => setFreeConfig({...freeConfig, name: e.target.value})} className="rounded-xl h-11" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Quantidade</Label><Input type="number" value={freeConfig.quantity} onChange={e => setFreeConfig({...freeConfig, quantity: Number(e.target.value)})} className="rounded-xl h-11 font-black" /></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-muted/20 rounded-[1.5rem] border-2 border-dashed">
                  <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Início Vendas</Label><Input type="date" value={freeConfig.startD} onChange={e => setFreeConfig({...freeConfig, startD: e.target.value})} required /></div>
                  <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Hora</Label><Input type="time" value={freeConfig.startT} onChange={e => setFreeConfig({...freeConfig, startT: e.target.value})} required /></div>
                  <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Fim Vendas</Label><Input type="date" value={freeConfig.endD} onChange={e => setFreeConfig({...freeConfig, endD: e.target.value})} required /></div>
                  <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Hora</Label><Input type="time" value={freeConfig.endT} onChange={e => setFreeConfig({...freeConfig, endT: e.target.value})} required /></div>
                </div>
              </div>
            )}

            {ticketMode === 'paid_single' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nome</Label><Input value={singleConfig.name} onChange={e => setSingleConfig({...singleConfig, name: e.target.value})} className="rounded-xl h-11" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Preço (R$)</Label><Input type="number" step="0.01" value={singleConfig.price} onChange={e => setSingleConfig({...singleConfig, price: Number(e.target.value)})} className="rounded-xl h-11 font-black" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Capacidade</Label><Input type="number" value={singleConfig.quantity} onChange={e => setSingleConfig({...singleConfig, quantity: Number(e.target.value)})} className="rounded-xl h-11 font-black" /></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-muted/20 rounded-[1.5rem] border-2 border-dashed">
                  <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Início Vendas</Label><Input type="date" value={singleConfig.startD} onChange={e => setSingleConfig({...singleConfig, startD: e.target.value})} required /></div>
                  <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Hora</Label><Input type="time" value={singleConfig.startT} onChange={e => setSingleConfig({...singleConfig, startT: e.target.value})} required /></div>
                  <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Fim Vendas</Label><Input type="date" value={singleConfig.endD} onChange={e => setSingleConfig({...singleConfig, endD: e.target.value})} required /></div>
                  <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Hora</Label><Input type="time" value={singleConfig.endT} onChange={e => setSingleConfig({...singleConfig, endT: e.target.value})} required /></div>
                </div>
              </div>
            )}

            {ticketMode === 'batches' && (
              <div className="space-y-6">
                {batches.map((batch, bi) => (
                  <div key={batch.id} className="p-6 bg-muted/20 rounded-[1.5rem] border-2 border-dashed relative">
                    <div className="flex justify-between items-center mb-6">
                       <h4 className="font-black uppercase italic text-secondary tracking-tighter">Janela #{bi+1}: {batch.name}</h4>
                       <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeBatch(bi)} disabled={batches.length === 1}><X className="w-4 h-4" /></Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                       <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Nome</Label><Input value={batch.name} onChange={e => updateBatchField(bi, 'name', e.target.value)} /></div>
                       <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Preço (R$)</Label><Input type="number" step="0.01" value={batch.price} onChange={e => updateBatchField(bi, 'price', Number(e.target.value))} className="font-black" /></div>
                       <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Carga Inicial</Label><Input type="number" value={batch.initialCapacity} onChange={e => updateBatchField(bi, 'initialCapacity', Number(e.target.value))} className="font-black" /></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Abre em</Label><Input type="date" value={batch.salesStartDate} onChange={e => updateBatchField(bi, 'salesStartDate', e.target.value)} required /></div>
                       <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Hora</Label><Input type="time" value={batch.salesStartTime} onChange={e => updateBatchField(bi, 'salesStartTime', e.target.value)} required /></div>
                       <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Fecha em</Label><Input type="date" value={batch.salesEndDate} onChange={e => updateBatchField(bi, 'salesEndDate', e.target.value)} required /></div>
                       <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Hora</Label><Input type="time" value={batch.salesEndTime} onChange={e => updateBatchField(bi, 'salesEndTime', e.target.value)} required /></div>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" className="w-full h-12 border-dashed rounded-xl gap-2 font-black uppercase" onClick={addBatch}><Plus className="w-4 h-4" /> Adicionar Janela (Lote)</Button>
              </div>
            )}

            {(ticketMode === 'paid_single' || ticketMode === 'batches') && (
              <div className="pt-6 border-t border-dashed space-y-4">
                 <div className="flex items-center justify-between p-4 bg-primary text-white rounded-2xl shadow-xl">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-white/10 rounded-lg"><Sparkles className="w-5 h-5 text-secondary" /></div>
                       <div className="space-y-0.5">
                          <p className="font-black uppercase text-xs italic tracking-tighter">Meia-Entrada Automática (Cota 40%)</p>
                          <p className="text-[8px] opacity-60 uppercase font-bold">O sistema criará os estoques compartilhados conforme a legislação.</p>
                       </div>
                    </div>
                    <Switch checked={autoHalfPrice} onCheckedChange={setAutoHalfPrice} />
                 </div>
                 
                 <div className="flex items-center justify-between p-4 bg-muted/50 rounded-2xl">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-background rounded-lg"><MapIcon className="w-5 h-5 text-secondary" /></div>
                       <div className="space-y-0.5">
                          <p className="font-black uppercase text-xs italic tracking-tighter">Habilitar Lugar Marcado</p>
                          <p className="text-[8px] opacity-60 uppercase font-bold">Permitir que o público escolha cadeiras ou mesas no mapa.</p>
                       </div>
                    </div>
                    <Switch checked={hasMap} onCheckedChange={setHasMap} />
                 </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading} className="w-full h-16 bg-secondary text-white font-black text-xl rounded-[2rem] shadow-xl uppercase italic hover:scale-[1.02] transition-transform">
          {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <><CheckCircle2 className="w-6 h-6 mr-2" /> Publicar Evento</>}
        </Button>
      </form>
    </div>
  )
}
