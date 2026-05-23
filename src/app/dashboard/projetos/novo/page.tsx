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
  Check, 
  X, 
  Upload, 
  Building2,
  Globe,
  Camera,
  MapPin,
  Phone,
  Mail,
  Instagram,
  Fingerprint,
  Info,
  Ticket,
  Sparkles,
  Layers,
  Users,
  AtSign,
  Map as MapIcon,
  Armchair,
  Grid3X3,
  Layout,
  Save,
  ImageIcon,
  Users2
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
import { generateMapData } from "@/lib/ticketing-service"

interface MapSector {
  id: string
  nome: string
  tipo: 'livre' | 'assentos' | 'mesas'
  preco: number
  capacidade: number
  cor: string
  descricao: string
  fileiras?: number
  assentosPorFileira?: number
  quantidadeMesas?: number
  lugaresPorMesa?: number
  formatoMesa?: 'circular' | 'quadrada'
}

interface Batch {
  id: string
  name: string
  description: string
  startDate: string
  endDate: string
  capacity: number
  ticketTypes: any[]
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
  const [ticketMode, setTicketMode] = useState<'free' | 'paid_single' | 'batches' | 'map'>('free')
  
  const [batches, setBatches] = useState<Batch[]>([
    { 
      id: crypto.randomUUID(),
      name: "Lote Inicial", 
      description: "", 
      startDate: "", 
      endDate: "", 
      capacity: 100,
      ticketTypes: [
        { id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }
      ] 
    }
  ])

  const [mapSectors, setMapSectors] = useState<MapSector[]>([])
  const [palcoNome, setPalcoNome] = useState("PALCO PRINCIPAL")
  
  const [address, setAddress] = useState({ street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "" })
  const [coOrganizers, setCoOrganizers] = useState<any[]>([])
  const [searchUsername, setSearchUsername] = useState("")
  const [isSearching, setIsSearching] = useState(false)

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
        setUploadedImageUrl(downloadURL)
        setUploadProgress(null)
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

    const newTypes = [
      { id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: total, poolId, poolName: "Estoque Compartilhado", requiresProof: false, isLegalHalf: false, description: "" },
      { id: crypto.randomUUID(), name: "Meia Estudante", price: 50, quantity: meiaQuantity, poolId, poolName: "Estoque Compartilhado", requiresProof: true, isLegalHalf: true, description: "" },
      { id: crypto.randomUUID(), name: "Meia PCD", price: 50, quantity: meiaQuantity, poolId, poolName: "Estoque Compartilhado", requiresProof: true, isLegalHalf: true, description: "" },
      { id: crypto.randomUUID(), name: "Meia Idoso", price: 50, quantity: meiaQuantity, poolId, poolName: "Estoque Compartilhado", requiresProof: true, isLegalHalf: true, description: "" }
    ]

    const newBatches = [...batches]
    newBatches[distributeBatchIdx].ticketTypes = newTypes
    newBatches[distributeBatchIdx].capacity = total
    setBatches(newBatches)
    setIsDistributeOpen(false)
    setTotalToDistribute("")
    toast({ title: "Ingressos distribuídos!", description: "Carga do lote configurada." })
  }

  const addBatch = () => setBatches([...batches, { id: crypto.randomUUID(), name: `Lote ${batches.length + 1}`, description: "", startDate: "", endDate: "", capacity: 100, ticketTypes: [{ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }] }])
  const removeBatch = (i: number) => setBatches(batches.filter((_, idx) => idx !== i))
  const updateBatchField = (i: number, f: keyof Batch, v: any) => { const n = [...batches]; n[i] = { ...n[i], [f]: v } as any; setBatches(n); }
  const addTicketType = (bi: number) => { const n = [...batches]; n[bi].ticketTypes.push({ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }); setBatches(n); }
  const removeTicketType = (bi: number, ti: number) => { const n = [...batches]; if(n[bi].ticketTypes.length > 1) { n[bi].ticketTypes.splice(ti, 1); setBatches(n); } }
  const updateTicketTypeField = (bi: number, ti: number, f: string, v: any) => { const n = [...batches]; n[bi].ticketTypes[ti] = { ...n[bi].ticketTypes[ti], [f]: v }; setBatches(n); }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !currentOrg || !isAtLeastEditor) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      const cat = categories?.find(c => c.id === selectedCategory)
      const eventData: any = {
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        date: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory,
        categoryName: cat?.name || "Outros",
        ticketMode,
        isFree: ticketMode === 'free',
        possuiMapa: ticketMode === 'map',
        modoMapa: ticketMode === 'map' ? 'setores' : null,
        palcoNome: ticketMode === 'map' ? palcoNome : null,
        address, 
        image: uploadedImageUrl || "",
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

      if (ticketMode !== 'map') {
        eventData.batches = batches.map(b => ({
          ...b,
          capacity: parseInt(b.capacity as any) || 0,
          ticketTypes: b.ticketTypes.map(t => ({ ...t, price: parseFloat(t.price as any) || 0, quantity: parseInt(t.quantity as any) || 0 }))
        }))
      }

      const docRef = await addDoc(collection(db, "events"), eventData)

      if (ticketMode === 'map') {
        // Logica simplificada de criacao de setores
      }
      
      toast({ title: "Evento Publicado!" })
      router.push("/dashboard/organizacoes")
    } catch (error: any) { 
      toast({ variant: "destructive", title: "Erro ao publicar", description: error.message }) 
    } finally { 
      setLoading(false) 
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
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
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5 text-secondary" /> Informações</CardTitle></CardHeader>
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
                <div className="space-y-2"><Label>Início</Label><Input name="startDate" type="datetime-local" required className="rounded-xl h-11 text-xs" /></div>
                <div className="space-y-2"><Label>Término</Label><Input name="endDate" type="datetime-local" required className="rounded-xl h-11 text-xs" /></div>
             </div>
             <div className="space-y-2"><Label>Descrição</Label><Textarea name="description" className="min-h-[120px] rounded-xl border-dashed border-secondary/30" required placeholder="Fale tudo sobre a experiência..." /></div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria Híbrida</CardTitle>
              </div>
              <div className="bg-white p-1 rounded-xl border flex gap-1">
                <Button type="button" variant={ticketMode === 'free' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-4" onClick={() => setTicketMode('free')}>Grátis</Button>
                <Button type="button" variant={ticketMode === 'paid_single' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-4" onClick={() => setTicketMode('paid_single')}>Único</Button>
                <Button type="button" variant={ticketMode === 'batches' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-4" onClick={() => setTicketMode('batches')}>Lotes</Button>
                <Button type="button" variant={ticketMode === 'map' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-4" onClick={() => setTicketMode('map')}>Mapa</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
             {ticketMode === 'map' ? (
               <div className="py-12 text-center opacity-30">
                  <MapIcon className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm font-bold uppercase tracking-widest">O mapa será configurado após salvar o evento.</p>
               </div>
             ) : (
               <React.Fragment>
                 {batches.map((batch, bi) => (
                   <div key={batch.id} className="p-6 rounded-[1.5rem] border-2 bg-muted/10 space-y-6">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                           <h3 className="font-black italic uppercase text-secondary text-xl">{batch.name}</h3>
                           <Badge variant="outline" className="text-[10px] font-bold uppercase">{batch.capacity} Ingressos Total</Badge>
                        </div>
                        <div className="flex gap-2">
                           <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase border-secondary text-secondary gap-1.5" onClick={() => { setDistributeBatchIdx(bi); setTotalToDistribute(batch.capacity.toString()); setIsDistributeOpen(true); }}>
                              <Sparkles className="w-3 h-3" /> Gerar Meia-Entrada
                           </Button>
                           <Button type="button" variant="ghost" size="icon" className="text-destructive rounded-full" onClick={() => removeBatch(bi)} disabled={batches.length === 1}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                         <div className="md:col-span-2 space-y-2">
                           <Label className="text-[10px] font-black uppercase opacity-60">Nome do Lote</Label>
                           <Input value={batch.name} onChange={e => updateBatchField(bi, 'name', e.target.value)} className="rounded-xl h-11" />
                         </div>
                         <div className="md:col-span-2 space-y-2">
                           <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Users2 className="w-3 h-3" /> Capacidade do Lote</Label>
                           <Input type="number" value={batch.capacity} onChange={e => updateBatchField(bi, 'capacity', parseInt(e.target.value) || 0)} className="rounded-xl h-11 font-black text-primary" />
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Início das Vendas</Label><Input type="datetime-local" value={batch.startDate} onChange={e => updateBatchField(bi, 'startDate', e.target.value)} className="rounded-xl h-11 text-xs" /></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Fim das Vendas</Label><Input type="datetime-local" value={batch.endDate} onChange={e => updateBatchField(bi, 'endDate', e.target.value)} className="rounded-xl h-11 text-xs" /></div>
                      </div>
                      <div className="space-y-4">
                         {batch.ticketTypes.map((t, ti) => (
                           <div key={t.id} className="p-4 bg-white rounded-2xl border shadow-sm grid grid-cols-12 gap-4 items-end">
                              <div className="col-span-4 space-y-2">
                                 <Label className="text-[9px] uppercase font-black opacity-40">Título</Label>
                                 <Input value={t.name} onChange={e => updateTicketTypeField(bi, ti, 'name', e.target.value)} className="rounded-xl h-10 font-bold" />
                                 {t.poolId && <Badge variant="secondary" className="text-[7px] h-3.5 uppercase gap-1"><Layers className="w-2 h-2" /> Estoque Compartilhado</Badge>}
                              </div>
                              <div className="col-span-3 space-y-2"><Label className="text-[9px] uppercase font-black opacity-40">Limite Individual</Label><Input type="number" value={t.quantity} onChange={e => updateTicketTypeField(bi, ti, 'quantity', e.target.value)} className="rounded-xl h-10 font-black" /></div>
                              <div className="col-span-3 space-y-2"><Label className="text-[9px] uppercase font-black opacity-40">Valor (R$)</Label><Input type="number" step="0.01" value={t.price} onChange={e => updateTicketTypeField(bi, ti, 'price', e.target.value)} className="rounded-xl h-10 font-black text-secondary" disabled={ticketMode === 'free'} /></div>
                              <div className="col-span-2 flex justify-end pb-1"><Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeTicketType(bi, ti)} disabled={batch.ticketTypes.length === 1}><Trash2 className="w-4 h-4" /></Button></div>
                           </div>
                         ))}
                         <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase gap-1.5" onClick={() => addTicketType(bi)}><Plus className="w-3 h-3" /> Adicionar Tipo</Button>
                      </div>
                   </div>
                 ))}
                 {(ticketMode === 'batches' || ticketMode === 'paid_single' || ticketMode === 'free') && <Button type="button" variant="outline" className="w-full h-14 rounded-2xl border-dashed font-black uppercase italic" onClick={addBatch}><Plus className="w-5 h-5 mr-2" /> Adicionar Lote</Button>}
               </React.Fragment>
             )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading} className="w-full h-16 rounded-[2rem] bg-secondary text-white font-black text-xl shadow-xl uppercase italic">
          {loading ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 w-6 h-6" />}
          Publicar Evento
        </Button>
      </form>

      <Dialog open={isDistributeOpen} onOpenChange={setIsDistributeOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Carga do Lote</DialogTitle>
            <DialogDescription>Defina a quantidade total de ingressos que este lote pode vender.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
             <Label className="text-[10px] font-black uppercase opacity-60">Capacidade Total do Lote (Ex: 200)</Label>
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
                  O sistema criará Inteira e Meias vinculadas a este estoque total. A soma de vendas não ultrapassará o valor definido.
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
