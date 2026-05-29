
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useFirebaseApp, useCollection, useMemoFirebase } from "@/firebase"
import { 
  updateDoc, 
  doc, 
  collection, 
  serverTimestamp, 
  deleteField, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  deleteDoc,
  orderBy,
  getDoc,
  writeBatch
} from "firebase/firestore"
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
  Upload, 
  Calendar, 
  Ticket, 
  ImageIcon,
  Save,
  MapPin,
  X,
  Plus,
  Sparkles,
  Trash2,
  ArrowDown,
  InfoIcon,
  Layout,
  Armchair,
  Grid3X3,
  Map as MapIcon,
  Percent,
  Clock,
  Settings2,
  Handshake,
  Search,
  CheckCircle2,
  AtSign,
  ShieldAlert,
  AlertCircle,
  Globe,
  Tag as TagIcon
} from "lucide-react"
import Link from "next/link"
import { cn, normalizeText, isValidUrl } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { AGE_RATINGS, AgeRatingBadge, getAgeRatingConfig } from "@/lib/age-rating"
import { EVENT_CATEGORIES, EVENT_TYPES } from "@/lib/constants"

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
  startDate: string
  endDate: string
  capacidadeInicial: number
  capacidadeAtual: number
  vendidos: number
  restantes: number
  migradosDoLoteAnterior: number
  ticketTypes: TicketType[]
  isHalfPriceEnabled?: boolean
  halfPricePercent?: number
}

export default function EditarEventoPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg, userRole } = useCurrentOrganization()

  const eventRef = React.useMemo(() => (db && eventId) ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const storage = React.useMemo(() => app ? getStorage(app, "gs://viby") : null, [app])
  
  const categoriesQuery = useMemoFirebase(() => db ? query(collection(db, "categories"), orderBy("name", "asc")) : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedAgeRating, setSelectedAgeRating] = useState("free")
  
  const [eventType, setEventType] = useState("interno")
  const [externalUrl, setExternalUrl] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")

  const [ticketMode, setTicketMode] = useState<'none' | 'free' | 'paid_single' | 'batches'>('none')
  const [mapMode, setMapMode] = useState<'none' | 'setores' | 'assentos' | 'mesas'>('none')
  
  const [description, setDescription] = useState("")
  const [address, setAddress] = useState({ street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "" })

  const [singleCapacity, setSingleCapacity] = useState<number>(100)
  const [singleTicketTypes, setSingleTicketTypes] = useState<TicketType[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [freeCapacity, setFreeCapacity] = useState<number>(100)

  useEffect(() => {
    if (event) {
      setSelectedCategory(event.categoryId || "")
      setSelectedAgeRating(event.ageRating?.code || "free")
      setEventType(event.type || "interno")
      setExternalUrl(event.externalUrl || "")
      setTags(event.tags || [])
      setTicketMode(event.ticketMode || 'none')
      setMapMode(event.mapMode || 'none')
      setImagePreview(event.image || null)
      setDescription(event.description || "")
      if (event.address) setAddress({ ...address, ...event.address })

      if (event.ticketMode === 'batches') {
        setBatches(event.batches || [])
      } else if (event.ticketMode === 'paid_single' && event.batches?.length > 0) {
        setSingleCapacity(event.batches[0].capacidadeInicial || 100)
        setSingleTicketTypes(event.batches[0].ticketTypes || [])
      } else if (event.ticketMode === 'free' && event.batches?.length > 0) {
        setFreeCapacity(event.batches[0].capacidadeInicial || 100)
      }
    }
  }, [event])

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return
    setImagePreview(URL.createObjectURL(file))
    setUploadProgress(0)
    const storageRef = ref(storage, `events/${user.uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`)
    const uploadTask = uploadBytesResumable(storageRef, file)
    uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), () => setUploadProgress(null), async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref)
      setUploadedImageUrl(url); setUploadProgress(null)
    })
  }

  const handleAddTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/#/g, "")
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("")
  }

  const handleCepBlur = async () => {
    const cleanCep = address.cep.replace(/\D/g, "")
    if (cleanCep.length !== 8) return
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await response.json()
      if (!data.erro) {
        setAddress(prev => ({...prev, street: data.logradouro || "", neighborhood: data.bairro || "", city: data.localidade || "", state: data.uf || ""}))
      }
    } catch (e) {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !eventRef || !currentOrg) return
    if (eventType === 'externo' && !isValidUrl(externalUrl)) {
      toast({ variant: "destructive", title: "URL Inválida", description: "Informe um link completo (http:// ou https://)." })
      return
    }

    setLoading(true)
    const formData = new FormData(e.currentTarget as HTMLFormElement)
    try {
      const searchKeywords = [
        ...normalizeText(currentOrg.name).split(" "),
        ...normalizeText(currentOrg.username).split(" "),
        ...tags.map(normalizeText)
      ]
      
      const ageRatingConfig = getAgeRatingConfig(selectedAgeRating);
      
      let finalBatches: any[] = []
      let totalCapacity = 0

      if (ticketMode === 'free') {
        totalCapacity = freeCapacity
        finalBatches = [{
          id: 'free',
          name: 'Ingresso Gratuito',
          capacidadeInicial: freeCapacity,
          capacidadeAtual: freeCapacity,
          ticketTypes: [{ id: 'free_type', name: 'Gratuito', price: 0, quantity: freeCapacity, requiresProof: false, isLegalHalf: false, description: '' }]
        }]
      } else if (ticketMode === 'paid_single') {
        totalCapacity = singleCapacity
        finalBatches = [{ id: 'single', name: 'Lote Único', capacidadeInicial: singleCapacity, capacidadeAtual: singleCapacity, ticketTypes: singleTicketTypes }]
      } else if (ticketMode === 'batches') {
        finalBatches = batches;
        totalCapacity = batches.reduce((acc, b) => acc + b.capacidadeInicial, 0);
      }

      const updateData: any = {
        title: formData.get("title") as string,
        description,
        date: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory,
        categoryName: categories?.find(c => c.id === selectedCategory)?.name || "Outros",
        type: eventType,
        externalUrl: eventType === 'externo' ? externalUrl : null,
        tags,
        ageRating: { code: ageRatingConfig.code, label: ageRatingConfig.label, minimumAge: ageRatingConfig.minimumAge },
        ticketMode: eventType === 'interno' ? ticketMode : 'none',
        mapMode,
        possuiMapa: mapMode !== 'none',
        capacidadeTotal: totalCapacity,
        batches: eventType === 'interno' ? finalBatches : [],
        address, image: uploadedImageUrl || event.image || "",
        searchKeywords, updatedAt: serverTimestamp()
      }
      await updateDoc(eventRef, updateData)
      toast({ title: "Evento Atualizado!" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message })
    } finally {
      setLoading(false)
    }
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 text-foreground">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Editar Evento</h1>
        </div>
        <Button onClick={(e:any) => document.getElementById('edit-form')?.dispatchEvent(new Event('submit', {cancelable: true, bubbles: true}))} disabled={loading} className="bg-primary text-white font-black rounded-full h-11 px-8 shadow-lg gap-2 uppercase italic">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Alterações
        </Button>
      </div>

      <form id="edit-form" onSubmit={handleSubmit} className="space-y-8">
        <Card className="overflow-hidden border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="w-5 h-5 text-secondary" /> Capa</CardTitle></CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="relative aspect-video rounded-[1.5rem] bg-muted overflow-hidden cursor-pointer" onClick={() => document.getElementById('img-up')?.click()}>
              {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center justify-center h-full opacity-20"><Upload className="w-10 h-10 mb-2" /></div>}
              <input id="img-up" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
            </div>
            {uploadProgress !== null && <Progress value={uploadProgress} className="h-1 mt-4" />}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2.5rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5 text-secondary" /> Tipo e Configuração</CardTitle></CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase opacity-60">Tipo de Evento</Label>
                   <Select value={eventType} onValueChange={setEventType}>
                      <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                         {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>
             </div>

             {eventType === 'externo' && (
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-secondary">Link para Compra Externa</Label>
                  <Input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="https://exemplo.com/ingressos" className="rounded-xl h-11" />
               </div>
             )}

             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Tags / Palavras-chave</Label>
                <div className="flex gap-2">
                   <Input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Adicionar tag" className="rounded-xl h-11" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())} />
                   <Button type="button" onClick={handleAddTag} variant="outline" className="h-11 rounded-xl">Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                   {tags.map(t => <Badge key={t} className="bg-primary/5 text-primary border-primary/10 gap-1 px-3 py-1">#{t} <X className="w-3 h-3 cursor-pointer" onClick={() => setTags(tags.filter(item => item !== t))} /></Badge>)}
                </div>
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2.5rem]">
          <CardHeader><CardTitle className="text-lg">Informações Gerais</CardTitle></CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label>Título</Label><Input name="title" defaultValue={event?.title} required className="rounded-xl h-11" /></div>
                <div className="space-y-2">
                   <Label>Classificação</Label>
                   <Select value={selectedAgeRating} onValueChange={setSelectedAgeRating}>
                      <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                         <SelectItem value="free">Livre</SelectItem>
                         <SelectItem value="not_recommended_18">18 Anos (Não recomendado)</SelectItem>
                         <SelectItem value="adults_only_18">Proibido -18</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
             </div>
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><Label>Início</Label><Input name="startDate" type="datetime-local" defaultValue={event?.date} required className="rounded-xl h-11 text-xs" /></div>
                <div className="space-y-2"><Label>Fim</Label><Input name="endDate" type="datetime-local" defaultValue={event?.endDate} required className="rounded-xl h-11 text-xs" /></div>
             </div>
             <div className="space-y-2"><Label>Descrição</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} required className="min-h-[120px] rounded-xl border-dashed" /></div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-secondary" /> Localização</CardTitle></CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2"><Label>CEP</Label><Input value={address.cep} onChange={e => setAddress({...address, cep: e.target.value})} onBlur={handleCepBlur} placeholder="00000-000" className="rounded-xl h-11" /></div>
                <div className="md:col-span-3 space-y-2"><Label>Rua</Label><Input value={address.street} onChange={e => setAddress({...address, street: e.target.value})} required className="rounded-xl h-11" /></div>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2"><Label>Cidade</Label><Input value={address.city} readOnly className="rounded-xl h-11 bg-muted/30" /></div>
                <div className="space-y-2"><Label>UF</Label><Input value={address.state} readOnly className="rounded-xl h-11 bg-muted/30 w-16" /></div>
                <div className="space-y-2"><Label>Bairro</Label><Input value={address.neighborhood} onChange={e => setAddress({...address, neighborhood: e.target.value})} required className="rounded-xl h-11" /></div>
                <div className="space-y-2"><Label>Número</Label><Input value={address.number} onChange={e => setAddress({...address, number: e.target.value})} required className="rounded-xl h-11" /></div>
             </div>
          </CardContent>
        </Card>

        {eventType === 'interno' && (
          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-lg">Bilheteria Interna</CardTitle></CardHeader>
            <CardContent className="p-8 space-y-8">
               <div className="flex justify-center gap-1 bg-muted/50 p-1 rounded-xl w-fit mx-auto mb-8">
                  {['free', 'paid_single', 'batches'].map(m => <Button key={m} type="button" variant={ticketMode === m ? "secondary" : "ghost"} size="sm" className="rounded-lg text-[10px] font-black uppercase px-6" onClick={() => setTicketMode(m as any)}>{m === 'free' ? 'Gratuito' : m === 'paid_single' ? 'Valor Único' : 'Lotes'}</Button>)}
               </div>

               {ticketMode === 'free' ? (
                 <div className="p-8 bg-muted/20 rounded-2xl border-2 border-dashed border-border flex flex-col items-center gap-4">
                    <Label className="text-xs font-black uppercase tracking-widest">Quantidade de Ingressos Cortesia</Label>
                    <Input type="number" value={freeCapacity} onChange={e => setFreeCapacity(parseInt(e.target.value) || 0)} className="h-16 text-3xl font-black rounded-2xl text-center border-secondary/20 max-w-[200px]" />
                 </div>
               ) : ticketMode === 'paid_single' ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-muted/20 rounded-2xl border border-dashed">
                    <div className="space-y-2"><Label>Capacidade</Label><Input type="number" value={singleCapacity} onChange={e => setSingleCapacity(parseInt(e.target.value) || 0)} className="h-11 rounded-xl font-bold" /></div>
                    <div className="space-y-2"><Label>Preço (R$)</Label><Input type="number" step="0.01" value={singleTicketTypes[0]?.price} onChange={e => { const n = [...singleTicketTypes]; n[0].price = parseFloat(e.target.value) || 0; setSingleTicketTypes(n); }} className="h-11 rounded-xl font-black text-secondary" /></div>
                 </div>
               ) : (
                 <div className="py-10 text-center border-2 border-dashed rounded-3xl opacity-40"><Ticket className="w-12 h-12 mx-auto mb-2" /><p className="text-xs font-bold uppercase tracking-widest">Use o painel para gerenciar os lotes existentes.</p></div>
               )}
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  )
}
