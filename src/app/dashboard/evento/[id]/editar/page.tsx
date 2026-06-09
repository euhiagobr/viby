
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useFirebaseApp, useMemoFirebase, useCollection } from "@/firebase"
import { updateDoc, doc, serverTimestamp, collection, query, orderBy, where, deleteDoc } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { Loader2, ArrowLeft, Save, Handshake, Settings2, Ticket, RefreshCw, Eye, Star } from "lucide-react"
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
  EventCoOrganizers,
  EventRecurrence
} from "@/components/events"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { getAgeRatingConfig } from "@/lib/age-rating"
import { generateOccurrences } from "@/services/recurring-event-service"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"

const VIBY_OFFICIAL_UID = "dd9665af-ad6d-405c-a51d-08220fecf96f";

export default function EditarEventoPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg } = useCurrentOrganization()
  const { currency: dashboardCurrency } = useCurrency();
  const storage = React.useMemo(() => app ? getStorage(app) : null, [app])

  const eventRef = React.useMemo(() => (db && eventId) ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const categoriesQuery = useMemoFirebase(() => db ? query(collection(db, "categories"), orderBy("name", "asc")) : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const eventTypesSettingsRef = React.useMemo(() => (db ? doc(db, 'settings', 'event_types') : null), [db]);
  const { data: eventTypesSettings } = useDoc<any>(eventTypesSettingsRef);

  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  
  const [formData, setFormData] = useState<any>(null)
  const [ticketMode, setTicketMode] = useState<any>('free')
  const [batches, setBatches] = useState<any[]>([])
  const [totalCapacity, setTotalCapacity] = useState(100)

  useEffect(() => {
    if (event) {
      const legacyAddress = event.address || {};
      const addr = {
        venueName: legacyAddress.venueName || event.location || "",
        addressLine1: legacyAddress.addressLine1 || legacyAddress.street || "",
        addressLine2: legacyAddress.addressLine2 || legacyAddress.complement || "",
        streetNumber: legacyAddress.streetNumber || legacyAddress.number || "",
        neighborhood: legacyAddress.neighborhood || event.location || "",
        city: legacyAddress.city || event.city || "",
        stateRegion: legacyAddress.stateRegion || legacyAddress.state || event.state || "",
        country: legacyAddress.country || "Brasil",
        countryCode: legacyAddress.countryCode || "BR",
        postalCode: legacyAddress.postalCode || event.cep || "",
        latitude: legacyAddress.latitude || event.latitude || null,
        longitude: legacyAddress.longitude || event.longitude || null,
        formattedAddress: legacyAddress.formattedAddress || ""
      };

      setFormData({
        title: event.title || "",
        image: event.image || "",
        type: event.type || "interno",
        externalUrl: event.externalUrl || "",
        disclosurePrices: event.disclosurePrices || [],
        categoryId: event.categoryId || "",
        startDate: event.date || "",
        endDate: event.endDate || "",
        description: event.description || "",
        status: event.status || "Ativo",
        tags: event.tags || [],
        ageRatingCode: event.ageRating?.code || "free",
        address: addr,
        isRecurring: event.isRecurring || false,
        frequency: event.frequency || "weekly",
        recurringEndDate: event.recurringEndDate || "",
        currency: event.currency || dashboardCurrency || "BRL",
        curationType: event.curationType || "realização"
      })
      setTicketMode(event.ticketMode || 'free')
      setBatches(event.batches || [])
      setTotalCapacity(event.capacidadeTotal || 100)
    }
  }, [event, dashboardCurrency])

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
        setFormData((prev: any) => ({ ...prev, image: url }))
        setUploadProgress(null)
      }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !eventRef || !currentOrg) return

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

      const updateData = {
        ...formData,
        date: formData.startDate,
        ticketMode: formData.type === 'interno' ? ticketMode : 'none',
        ageRating: { code: ageRatingConfig.code, label: ageRatingConfig.label, minimumAge: ageRatingConfig.minimumAge },
        capacidadeTotal: totalCapacity,
        batches: formData.type === 'interno' ? batches : [],
        searchKeywords,
        city: formData.address.city,
        location: formData.address.neighborhood || formData.address.venueName,
        latitude: formData.address.latitude,
        longitude: formData.address.longitude,
        updatedAt: serverTimestamp()
      }

      const cleanData = JSON.parse(JSON.stringify(updateData, (key, value) => value === undefined ? null : value));
      await updateDoc(eventRef, cleanData);

      toast({ title: "Evento Atualizado!" })
      router.push(`/dashboard/organizacoes/${currentOrg.username}/events`)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  if (eventLoading || !formData) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-secondary" /></div>

  const isVibyOfficial = currentOrg?.id === VIBY_OFFICIAL_UID;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href={`/dashboard/organizacoes/${currentOrg?.username}/events`}><ArrowLeft className="w-5 h-5" /></Link></Button>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Editar Evento</h1>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" asChild className="rounded-xl h-11 border-secondary text-secondary font-bold uppercase text-[10px]">
              <Link href={`/${currentOrg?.username}/${eventId}`} target="_blank"><Eye className="w-4 h-4 mr-2" /> Ver Público</Link>
           </Button>
           <Button onClick={handleSubmit} disabled={loading} className="bg-primary text-white font-black rounded-full h-11 px-8 shadow-lg gap-2 uppercase italic">
             {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
             Salvar Tudo
           </Button>
        </div>
      </div>

      <Tabs defaultValue="geral" className="space-y-8">
        <div className="flex justify-center">
           <TabsList className="bg-muted/50 p-1 rounded-xl h-14 overflow-x-auto">
              <TabsTrigger value="geral" className="rounded-lg px-8 font-black uppercase text-[10px] gap-2"><Settings2 className="w-4 h-4" /> Informações</TabsTrigger>
              <TabsTrigger value="bilheteria" className="rounded-lg px-8 font-black uppercase text-[10px] gap-2"><Ticket className="w-4 h-4" /> Bilheteria</TabsTrigger>
              <TabsTrigger value="parceiros" className="rounded-lg px-8 font-black uppercase text-[10px] gap-2"><Handshake className="w-4 h-4" /> Co-realização</TabsTrigger>
           </TabsList>
        </div>

        <TabsContent value="geral" className="space-y-8 animate-in fade-in">
           <EventHeader 
              title={formData.title} 
              onTitleChange={v => setFormData({...formData, title: v})}
              image={formData.image}
              onImageUpload={handleImageUpload}
              uploadProgress={uploadProgress}
            />

            <Card className="border-none shadow-sm rounded-[2rem]">
              <CardContent className="p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <EventType 
                      value={formData.type} 
                      onChange={v => setFormData({...formData, type: v})} 
                      externalUrl={formData.externalUrl} 
                      onExternalUrlChange={v => setFormData({...formData, externalUrl: v})} 
                      disclosurePrices={formData.disclosurePrices}
                      onDisclosurePricesChange={v => setFormData({...formData, disclosurePrices: v})}
                      config={eventTypesSettings}
                    />
                    <EventVisibility value={formData.status} onChange={v => setFormData({...formData, status: v})} />
                  </div>

                  {isVibyOfficial && (
                    <div className="p-6 bg-secondary/5 rounded-3xl border-2 border-dashed border-secondary/20 space-y-3">
                       <Label className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-2">
                          <Star className="w-4 h-4 fill-secondary" /> Tipo de Vínculo (Exclusivo Viby)
                       </Label>
                       <Select value={formData.curationType} onValueChange={v => setFormData({...formData, curationType: v})}>
                          <SelectTrigger className="rounded-xl h-11 bg-white border-none shadow-sm">
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                             <SelectItem value="realização">Realização Direta</SelectItem>
                             <SelectItem value="curadoria">Curadoria de Terceiros</SelectItem>
                          </SelectContent>
                       </Select>
                       <p className="text-[9px] font-bold text-muted-foreground uppercase italic px-1">
                          Define o rótulo exibido acima do nome da marca no card do evento.
                       </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Categoria</Label>
                      <Select value={formData.categoryId} onValueChange={v => setFormData({...formData, categoryId: v})}>
                          <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent className="rounded-xl">{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <EventDateTime startDate={formData.startDate} endDate={formData.endDate} onStartDateChange={v => setFormData({...formData, startDate: v})} onEndDateChange={v => setFormData({...formData, endDate: v})} />
                  <EventDescription value={formData.description} onChange={v => setFormData({...formData, description: v})} />
                  <EventTags tags={formData.tags} onChange={v => setFormData({...formData, tags: v})} />
              </CardContent>
            </Card>

            <EventLocation 
              address={formData.address} 
              onChange={v => setFormData({...formData, address: v})} 
              status={formData.status}
            />
        </TabsContent>

        <TabsContent value="bilheteria">
           <BilheteriaAdmin 
              mode={ticketMode} onModeChange={setTicketMode} batches={batches} onBatchesChange={setBatches} totalCapacity={totalCapacity} onTotalCapacityChange={setTotalCapacity}
              eventCurrency={formData.currency as CurrencyCode} onCurrencyChange={v => setFormData({...formData, currency: v})}
           />
        </TabsContent>

        <TabsContent value="parceiros">
           <EventCoOrganizers eventId={eventId} currentOrgId={currentOrg.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
