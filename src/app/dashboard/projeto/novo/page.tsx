
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useFirebaseApp, useCollection, useMemoFirebase } from "@/firebase"
import { collection, addDoc, serverTimestamp, doc, orderBy } from "firebase/firestore"
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
  ImageIcon,
  Save,
  MapPin,
  X,
  Plus
} from "lucide-react"
import Link from "next/link"
import { cn, normalizeText, isValidUrl } from "@/lib/utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { MentionTextarea } from "@/components/ui/mention-textarea"
import { EVENT_TYPES } from "@/lib/constants"
import { getAgeRatingConfig } from "@/lib/age-rating"
import { BilheteriaAdmin, type BilheteriaMode } from "@/components/events/Bilheteria"

export default function NovoEventoPage() {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg, userRole } = useCurrentOrganization()

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
  const [description, setDescription] = useState("")
  const [address, setAddress] = useState({ street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "" })
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")

  // Estados da Bilheteria
  const [ticketMode, setTicketMode] = useState<BilheteriaMode>('free')
  const [batches, setBatches] = useState<any[]>([
    { 
      id: crypto.randomUUID(), 
      name: "1º Lote", 
      startDate: "", 
      endDate: "", 
      capacidadeInicial: 100, 
      ticketTypes: [{ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false }] 
    }
  ])
  const [totalCapacity, setTotalCapacity] = useState(100)
  const [mapMode, setMapMode] = useState<'none' | 'setores' | 'assentos' | 'mesas'>('none')

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return
    setImagePreview(URL.createObjectURL(file))
    setUploadProgress(0)
    const storageRef = ref(storage, `events/${user.uid}/${Date.now()}_${file.name}`)
    const uploadTask = uploadBytesResumable(storageRef, file)
    uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), () => setUploadProgress(null), async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref)
      setUploadedImageUrl(url); setUploadProgress(null)
    })
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !currentOrg || !isAtLeastEditor) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      const ageConfig = getAgeRatingConfig(selectedAgeRating)
      const eventData = {
        title: formData.get("title") as string,
        description,
        date: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory,
        categoryName: categories?.find(c => c.id === selectedCategory)?.name || "Outros",
        type: eventType,
        externalUrl: eventType === 'externo' ? externalUrl : null,
        tags,
        ageRating: { code: ageConfig.code, label: ageConfig.label, minimumAge: ageConfig.minimumAge },
        ticketMode: eventType === 'interno' ? ticketMode : 'none',
        mapMode,
        capacidadeTotal: totalCapacity,
        batches: eventType === 'interno' ? batches : [],
        address, 
        image: uploadedImageUrl || "",
        organizationId: currentOrg.id, 
        organizerId: user.uid,
        organizer: { id: currentOrg.id, name: currentOrg.name, username: currentOrg.username, avatar: currentOrg.avatar || "" },
        status: "Ativo", city: address.city, createdAt: serverTimestamp()
      }
      await addDoc(collection(db, "events"), eventData)
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
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Novo Evento</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="overflow-hidden border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="w-5 h-5 text-secondary" /> Capa</CardTitle></CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="relative aspect-video rounded-[1.5rem] bg-muted overflow-hidden cursor-pointer" onClick={() => document.getElementById('img-up')?.click()}>
              {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center justify-center h-full opacity-20"><Upload className="w-10 h-10 mb-2" /><p className="text-[10px] font-black uppercase">Carregar Foto</p></div>}
              <input id="img-up" type="file" className="hidden" onChange={handleImageChange} />
            </div>
            {uploadProgress !== null && <Progress value={uploadProgress} className="h-1 mt-4" />}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2.5rem]">
           <CardHeader><CardTitle className="text-lg">Informações Básicas</CardTitle></CardHeader>
           <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Tipo de Experiência</Label>
                    <Select value={eventType} onValueChange={setEventType}>
                       <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                       <SelectContent className="rounded-xl">{EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                   <Label>Categoria</Label>
                   <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                     <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                     <SelectContent className="rounded-xl">{categories?.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                   </Select>
                 </div>
              </div>
              <div className="space-y-2"><Label>Título</Label><Input name="title" required className="rounded-xl h-11" /></div>
              {eventType === 'externo' && <div className="space-y-2"><Label>URL Externa</Label><Input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="https://..." className="rounded-xl h-11" /></div>}
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2"><Label>Início</Label><Input name="startDate" type="datetime-local" required className="rounded-xl h-11 text-xs" /></div>
                 <div className="space-y-2"><Label>Fim</Label><Input name="endDate" type="datetime-local" required className="rounded-xl h-11 text-xs" /></div>
              </div>
              <div className="space-y-2"><Label>Descrição</Label><MentionTextarea value={description} onValueChange={setDescription} required className="min-h-[120px] rounded-xl border-dashed" /></div>
           </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-secondary" /> Local</CardTitle></CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2"><Label>CEP</Label><Input value={address.cep} onChange={e => setAddress({...address, cep: e.target.value})} onBlur={handleCepBlur} className="rounded-xl h-11" /></div>
                <div className="md:col-span-3 space-y-2"><Label>Rua</Label><Input value={address.street} onChange={e => setAddress({...address, street: e.target.value})} required className="rounded-xl h-11" /></div>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2"><Label>Cidade</Label><Input value={address.city} readOnly className="rounded-xl h-11 bg-muted/30" /></div>
                <div className="space-y-2"><Label>Bairro</Label><Input value={address.neighborhood} onChange={e => setAddress({...address, neighborhood: e.target.value})} required className="rounded-xl h-11" /></div>
                <div className="space-y-2"><Label>Número</Label><Input value={address.number} onChange={e => setAddress({...address, number: e.target.value})} required className="rounded-xl h-11" /></div>
             </div>
          </CardContent>
        </Card>

        {eventType === 'interno' && (
          <BilheteriaAdmin 
            mode={ticketMode} 
            onModeChange={setTicketMode}
            batches={batches}
            onBatchesChange={setBatches}
            totalCapacity={totalCapacity}
            onTotalCapacityChange={setTotalCapacity}
          />
        )}

        <Button type="submit" disabled={loading} className="w-full h-20 bg-secondary text-white font-black text-xl rounded-[2.5rem] shadow-xl uppercase italic hover:scale-[1.02] transition-all">
          {loading ? <Loader2 className="animate-spin mr-2" /> : "Publicar Experiência"}
        </Button>
      </form>
    </div>
  )
}
