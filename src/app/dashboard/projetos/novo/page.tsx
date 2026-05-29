"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useFirebaseApp, useCollection, useMemoFirebase } from "@/firebase"
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, query, where, getDocs, limit, deleteField, updateDoc, writeBatch, orderBy } from "firebase/firestore"
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
  MapPin,
  X,
  Sparkles,
  Layers,
  Trash2,
  ArrowDown,
  Users2,
  InfoIcon,
  CheckCircle2,
  AlertCircle,
  Percent,
  Map as MapIcon,
  Layout,
  Armchair,
  Grid3X3,
  Clock,
  Handshake,
  Search,
  AtSign,
  ShieldAlert,
  Globe,
  Tag as TagIcon
} from "lucide-react"
import Link from "next/link"
import { cn, normalizeText, isValidUrl } from "@/lib/utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AGE_RATINGS, AgeRatingBadge, getAgeRatingConfig } from "@/lib/age-rating"
import { EVENT_CATEGORIES, EVENT_TYPES } from "@/lib/constants"
import { 
  EventHeader, 
  EventType, 
  EventDateTime, 
  EventDescription, 
  EventLocation, 
  EventTags, 
  EventVisibility,
  BilheteriaAdmin,
  EventCoOrganizers
} from "@/components/events"

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
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    categoryId: "",
    categoryName: "Geral",
    type: "interno",
    externalUrl: "",
    status: "Ativo",
    tags: [] as string[],
    ageRatingCode: "free",
    address: { street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "" }
  })

  const [ticketMode, setTicketMode] = useState<'none' | 'free' | 'paid_single' | 'batches'>('free')
  const [batches, setBatches] = useState<any[]>([])
  const [totalCapacity, setTotalCapacity] = useState(100)
  
  // ID temporário para gerir parceiros antes de salvar se necessário
  // mas como parceiros são subcoleção, o evento PRECISA existir primeiro.
  const [savedEventId, setSavedEventId] = useState<string | null>(null)

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

  const handleImageUpload = async (file: File) => {
    if (!storage || !user) return
    setUploadProgress(0)
    const storageRef = ref(storage, `events/${user.uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`)
    const uploadTask = uploadBytesResumable(storageRef, file)
    uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), () => setUploadProgress(null), async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref)
      setUploadedImageUrl(url); setUploadProgress(null)
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || !currentOrg || !isAtLeastEditor) return
    if (formData.type === 'externo' && !isValidUrl(formData.externalUrl)) {
      toast({ variant: "destructive", title: "URL Inválida", description: "Informe um link completo (http:// ou https://)." })
      return
    }

    setLoading(true)
    try {
      const searchKeywords = [
        ...normalizeText(currentOrg.name).split(" "),
        ...normalizeText(currentOrg.username).split(" "),
        ...formData.tags.map(normalizeText)
      ]

      const ageRatingConfig = getAgeRatingConfig(formData.ageRatingCode);
      
      const eventData = {
        title: formData.title,
        description: formData.description,
        date: formData.startDate,
        endDate: formData.endDate,
        categoryId: formData.categoryId,
        categoryName: categories?.find(c => c.id === formData.categoryId)?.name || "Outros",
        type: formData.type,
        externalUrl: formData.type === 'externo' ? formData.externalUrl : null,
        tags: formData.tags,
        ageRating: { code: ageRatingConfig.code, label: ageRatingConfig.label, minimumAge: ageRatingConfig.minimumAge },
        ticketMode: formData.type === 'interno' ? ticketMode : 'none',
        viewsCount: 0, interestedCount: 0, goingCount: 0, sharesCount: 0,
        capacidadeTotal: totalCapacity,
        batches: formData.type === 'interno' ? batches : [],
        address: formData.address, 
        image: uploadedImageUrl || "",
        organizationId: currentOrg.id,
        organizer: { id: currentOrg.id, name: currentOrg.name, username: currentOrg.username, avatar: currentOrg.avatar || "" },
        status: formData.status, 
        city: formData.address.city, 
        searchKeywords, 
        createdAt: serverTimestamp()
      }

      // Limpar campos undefined para evitar erro do Firestore
      const cleanData = JSON.parse(JSON.stringify(eventData, (key, value) => value === undefined ? null : value));

      const docRef = await addDoc(collection(db, "events"), cleanData)
      setSavedEventId(docRef.id)
      toast({ title: "Evento Publicado!" })
      
      // Se já criou, permite gerenciar co-organizadores
      // No fluxo de 'novo', redirecionamos para 'editar' para configurar detalhes finos como parceiros
      router.push(`/dashboard/evento/${docRef.id}/editar`)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao publicar", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Novo Evento</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <EventHeader 
          title={formData.title} 
          onTitleChange={v => setFormData({...formData, title: v})}
          image={uploadedImageUrl || ""}
          onImageUpload={handleImageUpload}
          uploadProgress={uploadProgress}
        />

        <Card className="border-none shadow-sm rounded-[2.5rem]">
           <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <EventType 
                   value={formData.type} 
                   onChange={v => setFormData({...formData, type: v})}
                   externalUrl={formData.externalUrl}
                   onExternalUrlChange={v => setFormData({...formData, externalUrl: v})}
                 />
                 <EventVisibility value={formData.status} onChange={v => setFormData({...formData, status: v})} />
              </div>
              
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase opacity-60">Categoria</Label>
                 <Select value={formData.categoryId} onValueChange={v => setFormData({...formData, categoryId: v})}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                       {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Classificação</Label>
                <Select value={formData.ageRatingCode} onValueChange={v => setFormData({...formData, ageRatingCode: v})}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="free">Livre</SelectItem>
                    <SelectItem value="10">10 Anos</SelectItem>
                    <SelectItem value="12">12 Anos</SelectItem>
                    <SelectItem value="14">14 Anos</SelectItem>
                    <SelectItem value="16">16 Anos</SelectItem>
                    <SelectItem value="not_recommended_18">18 Anos (Não recomendado)</SelectItem>
                    <SelectItem value="adults_only_18">Proibido -18</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <EventDateTime 
                startDate={formData.startDate} 
                endDate={formData.endDate}
                onStartDateChange={v => setFormData({...formData, startDate: v})}
                onEndDateChange={v => setFormData({...formData, endDate: v})}
              />

              <EventDescription value={formData.description} onChange={v => setFormData({...formData, description: v})} />
              <EventTags tags={formData.tags} onChange={v => setFormData({...formData, tags: v})} />
           </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardContent className="p-8">
             <EventLocation address={formData.address} onChange={v => setFormData({...formData, address: v})} />
          </CardContent>
        </Card>

        {formData.type === 'interno' && (
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
