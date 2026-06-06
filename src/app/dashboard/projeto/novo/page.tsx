"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useFirebaseApp, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, addDoc, serverTimestamp, query, orderBy, doc } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { Loader2, ArrowLeft, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { normalizeText } from "@/lib/utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { 
  EventHeader, 
  EventType, 
  EventDateTime, 
  EventDescription, 
  EventLocation, 
  EventTags, 
  EventVisibility,
  BilheteriaAdmin,
  EventRecurrence
} from "@/components/events"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { getAgeRatingConfig } from "@/lib/age-rating"
import { generateOccurrences } from "@/services/recurring-event-service"

const DEFAULT_EVENT_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fcapa.jpeg?alt=media";

export default function NovoEventoPage() {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg } = useCurrentOrganization()
  const storage = React.useMemo(() => app ? getStorage(app) : null, [app])

  const categoriesQuery = useMemoFirebase(() => db ? query(collection(db, "categories"), orderBy("name", "asc")) : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const eventTypesSettingsRef = React.useMemo(() => (db ? doc(db, 'settings', 'event_types') : null), [db]);
  const { data: eventTypesSettings } = useDoc<any>(eventTypesSettingsRef);

  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  
  const [formData, setFormData] = useState({
    title: "",
    image: DEFAULT_EVENT_IMAGE,
    type: "interno",
    externalUrl: "",
    categoryId: "",
    ageRatingCode: "free",
    startDate: "",
    endDate: "",
    description: "",
    status: "Ativo",
    tags: [] as string[],
    address: { 
      venueName: "",
      addressLine1: "", 
      addressLine2: "",
      streetNumber: "",
      neighborhood: "", 
      city: "", 
      stateRegion: "", 
      country: "Brasil", 
      countryCode: "BR",
      postalCode: "", 
      latitude: null, 
      longitude: null,
      formattedAddress: ""
    },
    isMultiLocation: false,
    locations: [] as any[],
    isRecurring: false,
    frequency: "weekly",
    recurringEndDate: ""
  })

  const [ticketMode, setTicketMode] = useState<any>('free')
  const [batches, setBatches] = useState<any[]>([])
  const [totalCapacity, setTotalCapacity] = useState(100)

  const handleImageUpload = async (file: File) => {
    if (!storage || !user) return
    setUploadProgress(0)
    const storageRef = ref(storage, `events/${user.uid}/${Date.now()}_${file.name}`)
    const uploadTask = uploadBytesResumable(storageRef, file)
    uploadTask.on('state_changed', 
      (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), 
      () => setUploadProgress(null), 
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref)
        setFormData(prev => ({ ...prev, image: url }))
        setUploadProgress(null)
      }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || !currentOrg) return

    // VALIDAÇÃO DE REGRAS DE PUBLICAÇÃO
    const isPublic = formData.status === 'Ativo';
    if (isPublic) {
      const { address } = formData;
      if (!address.countryCode || !address.city || !address.addressLine1 || !address.latitude || !address.longitude) {
        toast({ 
          variant: "destructive", 
          title: "Localização Incompleta", 
          description: "Eventos ativos exigem endereço completo e coordenadas no mapa." 
        });
        return;
      }
    }

    setLoading(true)
    try {
      const searchKeywords = [
        ...normalizeText(currentOrg.name).split(" "),
        ...normalizeText(formData.title).split(" ")
      ]

      const ageRatingConfig = getAgeRatingConfig(formData.ageRatingCode);

      const eventData: any = {
        ...formData,
        organizationId: currentOrg.id,
        organizerId: user.uid,
        organizer: { id: currentOrg.id, name: currentOrg.name, username: currentOrg.username, avatar: currentOrg.avatar || "" },
        ticketMode: formData.type === 'interno' ? ticketMode : 'none',
        ageRating: { code: ageRatingConfig.code, label: ageRatingConfig.label, minimumAge: ageRatingConfig.minimumAge },
        capacidadeTotal: totalCapacity,
        batches: formData.type === 'interno' ? batches : [],
        searchKeywords,
        date: formData.startDate,
        // Fallback de campos legados para compatibilidade
        city: formData.address.city,
        location: formData.address.neighborhood || formData.address.venueName,
        latitude: formData.address.latitude,
        longitude: formData.address.longitude,
        createdAt: serverTimestamp()
      }

      const cleanData = JSON.parse(JSON.stringify(eventData, (key, value) => value === undefined ? null : value));

      const docRef = await addDoc(collection(db, "events"), cleanData)

      if (formData.isRecurring && formData.recurringEndDate) {
        await generateOccurrences(docRef.id, {
          name: formData.title,
          description: formData.description,
          organizationId: currentOrg.id,
          organizerName: currentOrg.name,
          frequency: formData.frequency as any,
          startDate: formData.startDate.split('T')[0],
          endDate: formData.recurringEndDate,
          startTime: formData.startDate.split('T')[1] || "19:00",
          endTime: formData.endDate.split('T')[1] || "22:00",
          capacidadeMaxima: totalCapacity
        });
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
          image={formData.image}
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
                   config={eventTypesSettings}
                 />
                 <EventVisibility value={formData.status} onChange={v => setFormData({...formData, status: v})} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
              </div>
              
              <EventDateTime 
                startDate={formData.startDate} 
                endDate={formData.endDate}
                onStartDateChange={v => setFormData({...formData, startDate: v})}
                onEndDateChange={v => setFormData({...formData, endDate: v})}
              />

              <EventRecurrence 
                isRecurring={formData.isRecurring}
                onIsRecurringChange={v => setFormData({...formData, isRecurring: v})}
                frequency={formData.frequency}
                onFrequencyChange={v => setFormData({...formData, frequency: v})}
                recurringEndDate={formData.recurringEndDate}
                onRecurringEndDateChange={v => setFormData({...formData, recurringEndDate: v})}
              />

              <EventDescription value={formData.description} onChange={v => setFormData({...formData, description: v})} />
              <EventTags tags={formData.tags} onChange={v => setFormData({...formData, tags: v})} />
           </CardContent>
        </Card>

        <EventLocation 
          address={formData.address} 
          onChange={v => setFormData({...formData, address: v})} 
          status={formData.status}
        />

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

        <Button type="submit" disabled={loading} className="w-full h-20 bg-secondary text-white font-black text-xl rounded-[2.5rem] shadow-xl uppercase italic hover:scale-102 transition-all">
          {loading ? <Loader2 className="animate-spin mr-2" /> : "Publicar Experiência"}
        </Button>
      </form>
    </div>
  )
}
