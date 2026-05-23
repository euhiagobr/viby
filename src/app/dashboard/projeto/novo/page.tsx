
"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useFirebaseApp, useCollection, useMemoFirebase } from "@/firebase"
import { collection, addDoc, serverTimestamp, doc, runTransaction } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  InfoIcon
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"

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
  const [selectedCategory, setSelectedCategory] = useState("")
  
  const [freeQuantity, setFreeQuantity] = useState(100)
  const [singleValueTickets, setSingleValueTypes] = useState<TicketType[]>([
    { id: "t1", name: "Inteira", price: 100, quantity: 100 }
  ])
  const [batches, setBatches] = useState<Batch[]>([
    { id: "b1", name: "Lote 1", capacity: 100, ticketTypes: [{ id: "bt1", name: "Inteira", price: 120, quantity: 100 }], startDate: "", endDate: "" }
  ])

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
    if (!db || !user || !currentOrg) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    
    try {
      const eventData: any = {
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        date: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory,
        categoryName: categories?.find(c => c.id === selectedCategory)?.name || "Outros",
        ticketMode,
        possuiMapa: hasMap && (ticketMode === 'paid_single' || ticketMode === 'batches'),
        mapMode: hasMap ? 'setores' : 'none',
        image: uploadedImageUrl || "",
        organizationId: currentOrg.id,
        organizerId: user.uid,
        status: "Ativo",
        city: formData.get("city") as string,
        createdAt: serverTimestamp()
      }

      if (ticketMode === 'free') {
        eventData.capacity = freeQuantity
        eventData.freeQuantity = freeQuantity
      } else if (ticketMode === 'paid_single') {
        eventData.ticketTypes = singleValueTickets
      } else if (ticketMode === 'batches') {
        eventData.batches = batches
      }

      const docRef = await addDoc(collection(db, "events"), eventData)
      toast({ title: "Evento Criado!" })
      router.push(`/dashboard/evento/${docRef.id}/editar`)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao criar", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <h1 className="text-3xl font-black italic tracking-tighter text-primary uppercase">Criar Novo Evento</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="overflow-hidden border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="w-5 h-5 text-secondary" /> Capa do Evento</CardTitle></CardHeader>
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
                <div className="space-y-2"><Label>Título</Label><Input name="title" required className="rounded-xl h-11" placeholder="Nome do evento" /></div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{categories?.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
             </div>
             <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2"><Label>Início</Label><Input name="startDate" type="datetime-local" required className="rounded-xl h-11 text-xs" /></div>
                <div className="space-y-2"><Label>Término</Label><Input name="endDate" type="datetime-local" required className="rounded-xl h-11 text-xs" /></div>
                <div className="space-y-2"><Label>Cidade</Label><Input name="city" required className="rounded-xl h-11" placeholder="Cidade do evento" /></div>
             </div>
             <div className="space-y-2"><Label>Descrição</Label><Textarea name="description" className="min-h-[120px] rounded-xl" required placeholder="Detalhes da experiência..." /></div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Configuração Comercial</CardTitle>
              <div className="bg-white p-1 rounded-xl border flex gap-1">
                <Button type="button" variant={ticketMode === 'none' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase" onClick={() => setTicketMode('none')}>Sem Ingresso</Button>
                <Button type="button" variant={ticketMode === 'free' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase" onClick={() => setTicketMode('free')}>Grátis</Button>
                <Button type="button" variant={ticketMode === 'paid_single' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase" onClick={() => setTicketMode('paid_single')}>Único</Button>
                <Button type="button" variant={ticketMode === 'batches' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase" onClick={() => setTicketMode('batches')}>Lotes</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
             {ticketMode === 'none' && (
               <div className="py-12 text-center text-muted-foreground italic text-sm">Evento informativo. Sem venda de ingressos.</div>
             )}

             {ticketMode === 'free' && (
               <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex flex-col gap-2 max-w-xs">
                     <Label className="text-xs uppercase font-black opacity-60">Quantidade Gratuita</Label>
                     <Input type="number" value={freeQuantity} onChange={e => setFreeQuantity(Number(e.target.value))} className="h-12 text-xl font-black rounded-xl" />
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">* Eventos gratuitos não possuem lugar marcado.</p>
               </div>
             )}

             {(ticketMode === 'paid_single' || ticketMode === 'batches') && (
               <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between p-4 bg-secondary/5 rounded-2xl border-2 border-dashed border-secondary/20">
                     <div className="space-y-1">
                        <h4 className="font-black uppercase italic text-sm text-primary">Lugar Marcado</h4>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase">Habilite a escolha de assentos/mesas para este evento.</p>
                     </div>
                     <Switch checked={hasMap} onCheckedChange={setHasMap} />
                  </div>

                  {ticketMode === 'paid_single' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <h4 className="text-xs font-black uppercase opacity-60">Categorias de Ingresso</h4>
                         <Button type="button" variant="outline" size="sm" onClick={() => setSingleValueTypes([...singleValueTickets, { id: crypto.randomUUID(), name: "Novo Tipo", price: 0, quantity: 0 }])}><Plus className="w-3 h-3 mr-1" /> Adicionar</Button>
                      </div>
                      {singleValueTickets.map((t, idx) => (
                        <div key={t.id} className="grid grid-cols-12 gap-3 items-end bg-muted/20 p-4 rounded-xl border border-dashed">
                           <div className="col-span-5 space-y-1.5"><Label className="text-[9px] uppercase font-bold">Nome</Label><Input value={t.name} onChange={e => { const n = [...singleValueTickets]; n[idx].name = e.target.value; setSingleValueTypes(n); }} className="h-9 rounded-lg" /></div>
                           <div className="col-span-3 space-y-1.5"><Label className="text-[9px] uppercase font-bold">Preço (R$)</Label><Input type="number" value={t.price} onChange={e => { const n = [...singleValueTickets]; n[idx].price = Number(e.target.value); setSingleValueTypes(n); }} className="h-9 rounded-lg" /></div>
                           <div className="col-span-3 space-y-1.5"><Label className="text-[9px] uppercase font-bold">Qtd</Label><Input type="number" value={t.quantity} onChange={e => { const n = [...singleValueTickets]; n[idx].quantity = Number(e.target.value); setSingleValueTypes(n); }} className="h-9 rounded-lg" /></div>
                           <div className="col-span-1"><Button type="button" variant="ghost" size="icon" className="h-9 text-destructive" onClick={() => setSingleValueTypes(singleValueTickets.filter((_, i) => i !== idx))}><X className="w-4 h-4" /></Button></div>
                        </div>
                      ))}
                    </div>
                  )}

                  {ticketMode === 'batches' && (
                    <div className="space-y-6">
                       {batches.map((b, bIdx) => (
                         <div key={b.id} className="p-6 bg-muted/10 rounded-[1.5rem] border-2 border-dashed space-y-4">
                            <div className="flex justify-between items-center"><h4 className="font-black text-secondary uppercase italic">{b.name}</h4><Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeBatch(bIdx)}><Trash2 className="w-4 h-4" /></Button></div>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1.5"><Label className="text-[9px] uppercase font-bold">Nome do Lote</Label><Input value={b.name} onChange={e => updateBatchField(bIdx, 'name', e.target.value)} className="h-10 rounded-xl" /></div>
                               <div className="space-y-1.5"><Label className="text-[9px] uppercase font-bold">Carga Total</Label><Input type="number" value={b.capacity} onChange={e => updateBatchField(bIdx, 'capacity', Number(e.target.value))} className="h-10 rounded-xl font-black" /></div>
                            </div>
                            <Separator className="border-dashed" />
                            {b.ticketTypes.map((t, tIdx) => (
                              <div key={t.id} className="grid grid-cols-12 gap-3 items-end">
                                 <div className="col-span-6"><Label className="text-[8px] uppercase font-bold">Categoria</Label><Input value={t.name} onChange={e => { const n = [...batches]; n[bIdx].ticketTypes[tIdx].name = e.target.value; setBatches(n); }} className="h-9 rounded-lg" /></div>
                                 <div className="col-span-4"><Label className="text-[8px] uppercase font-bold">Preço</Label><Input type="number" value={t.price} onChange={e => { const n = [...batches]; n[bIdx].ticketTypes[tIdx].price = Number(e.target.value); setBatches(n); }} className="h-9 rounded-lg" /></div>
                                 <div className="col-span-2 flex justify-end"><Button type="button" variant="ghost" size="icon" className="h-9" onClick={() => { const n = [...batches]; if(n[bIdx].ticketTypes.length > 1) { n[bIdx].ticketTypes.splice(tIdx, 1); setBatches(n); } }}><X className="w-3 h-3" /></Button></div>
                              </div>
                            ))}
                            <Button type="button" variant="ghost" size="sm" className="text-[9px] font-black uppercase gap-1" onClick={() => addTicketType(bIdx)}><Plus className="w-3 h-3" /> Adicionar Categoria</Button>
                         </div>
                       ))}
                       <Button type="button" variant="outline" className="w-full h-14 border-dashed rounded-2xl font-black uppercase italic" onClick={addBatch}><Plus className="w-5 h-5 mr-2" /> Novo Lote de Venda</Button>
                    </div>
                  )}
               </div>
             )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading} className="w-full h-16 bg-secondary text-white font-black text-xl rounded-[2rem] shadow-xl uppercase italic">
          {loading ? <Loader2 className="animate-spin mr-2" /> : <><Save className="mr-2" /> Criar Evento</>}
        </Button>
      </form>
    </div>
  )
}
