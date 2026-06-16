"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useDoc, useFirestore, useFirebaseApp, useMemoFirebase, useCollection } from "@/firebase"
import { collection, doc, query, orderBy } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { Loader2, ArrowLeft, Building2, MapPin, Landmark, Star, ShieldAlert, Save, Zap, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { normalizeText, normalizeEventDates } from "@/lib/utils"
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
import { getAgeRatingConfig } from "@/lib/age-rating"
import { generateOccurrences } from "@/services/recurring-event-service"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"
import { createEventAction } from "@/app/actions/events"

const DEFAULT_EVENT_IMAGE = "https://picsum.photos/seed/event/1200/800";
const VIBY_OFFICIAL_UID = "dd9665af-ad6d-405c-a51d-08220fecf96f";

export default function NovoEventoPage() {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user, profile } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg } = useCurrentOrganization()
  const { currency: dashboardCurrency } = useCurrency();
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
    startingPrice: 0,
    disclosurePrices: [] as { price: number; untilTime: string }[],
    categoryId: "",
    categoryName: "",
    ageRatingCode: "free",
    startDate: "",
    endDate: "",
    description: "",
    status: "Ativo",
    tags: [] as string[],
    address: { 
      venueName: "",
      street: "", 
      number: "", 
      complement: "", 
      neighborhood: "", 
      city: "", 
      state: "", 
      country: "Brasil", 
      countryCode: "BR",
      postalCode: "", 
      latitude: null, 
      longitude: null,
      formattedAddress: ""
    },
    isRecurring: false,
    frequency: "weekly",
    recurringEndDate: "",
    customOccurrences: [] as any[],
    currency: dashboardCurrency || "BRL",
    curationType: "realização"
  })

  const [ticketMode, setTicketMode] = useState<any>('free')
  const [batches, setBatches] = useState<any[]>([])
  const [totalCapacity, setTotalCapacity] = useState(100)

  const handleUseOrgLocation = () => {
    if (!currentOrg?.address) {
      toast({ variant: "destructive", title: "Endereço não configurado", description: "Vá nas configurações da marca para definir o endereço da sede." });
      return;
    }
    const orgAddr = currentOrg.address;
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        ...orgAddr,
        street: orgAddr.addressLine1 || prev.address.street,
        number: orgAddr.streetNumber || prev.address.number,
        state: orgAddr.stateRegion || prev.address.state
      }
    }));
    toast({ title: "Local importado!" });
  }

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
    if (!db || !user) return

    if (!currentOrg) {
      toast({ variant: "destructive", title: "Marca não selecionada", description: "Selecione uma organização antes de publicar." });
      return;
    }

    const dateCheck = normalizeEventDates(formData.startDate, formData.endDate);
    if (!dateCheck.isValid) {
      toast({ variant: "destructive", title: "Erro na agenda", description: dateCheck.error });
      return;
    }

    setLoading(true)
    try {
      const searchKeywords = [
        ...normalizeText(currentOrg.name).split(" "),
        ...normalizeText(formData.title).split(" ")
      ]

      const ageRatingConfig = getAgeRatingConfig(formData.ageRatingCode);
      const cleanBaseData = JSON.parse(JSON.stringify(formData));

      const eventPayload = {
        ...cleanBaseData,
        startDate: dateCheck.startDate,
        endDate: dateCheck.endDate,
        date: dateCheck.startDate,
        organizer: {
          id: currentOrg.id,
          name: currentOrg.name,
          username: currentOrg.username,
          avatar: currentOrg.avatar || ""
        },
        ticketMode: formData.type === 'interno' ? ticketMode : 'none',
        ageRating: { code: ageRatingConfig.code, label: ageRatingConfig.label, minimumAge: ageRatingConfig.minimumAge },
        capacidadeTotal: totalCapacity,
        batches: formData.type === 'interno' ? batches : [],
        searchKeywords,
        city: formData.address.city,
        location: formData.address.neighborhood || formData.address.venueName,
        latitude: formData.address.latitude,
        longitude: formData.address.longitude,
      };

      const result = await createEventAction({
        orgId: currentOrg.id,
        userId: user.uid,
        eventData: eventPayload
      });

      if (!result.success) throw new Error(result.error);

      if (formData.isRecurring && formData.recurringEndDate) {
        await generateOccurrences(result.id!, {
          name: formData.title,
          description: formData.description,
          organizationId: currentOrg.id,
          organizerName: currentOrg.name,
          frequency: formData.frequency as any,
          startDate: formData.startDate.split('T')[0],
          endDate: formData.recurringEndDate,
          startTime: formData.startDate.split('T')[1] || "19:00",
          endTime: formData.endDate.split('T')[1] || "22:00",
          capacidadeMaxima: totalCapacity,
          customOccurrences: formData.customOccurrences
        });
      }

      toast({ title: "Evento Publicado!" });
      // Roteamento Canônico: /[username]/[slug]
      router.push(`/${result.username}/${result.slug || result.id}`);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao publicar", description: error.message });
    } finally {
      setLoading(false);
    }
  }

  const isVibyOfficial = currentOrg?.id === VIBY_OFFICIAL_UID;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard/projetos"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-primary uppercase">Novo Evento</h1>
            <p className="text-muted-foreground font-medium">Preencha os detalhes para publicar sua experiência.</p>
          </div>
        </div>
      </div>

      {!currentOrg && (
        <Card className="border-none shadow-xl rounded-[2rem] bg-orange-50 border-l-8 border-orange-500 animate-in zoom-in-95">
           <CardContent className="p-8 flex items-start gap-4">
              <ShieldAlert className="w-8 h-8 text-orange-600 shrink-0 mt-1" />
              <div className="space-y-1">
                 <h2 className="text-xl font-black uppercase italic tracking-tighter text-orange-800">Ação Necessária</h2>
                 <p className="text-sm font-medium text-orange-700 leading-relaxed">
                    Você precisa selecionar ou criar uma **Organização** antes de publicar um evento.
                 </p>
                 <Button asChild className="mt-4 bg-orange-600 text-white font-black rounded-xl h-10 px-6 uppercase italic text-[10px]">
                    <Link href="/dashboard/organizacoes/new">Criar minha Marca</Link>
                 </Button>
              </div>
           </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
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
                   startingPrice={formData.startingPrice}
                   onStartingPriceChange={v => setFormData({...formData, startingPrice: v})}
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
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase opacity-60">Categoria</Label>
                   <Select 
                    value={formData.categoryId} 
                    onValueChange={v => {
                      const cat = categories?.find(c => c.id === v);
                      setFormData({...formData, categoryId: v, categoryName: cat?.name || ""})
                    }}
                   >
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
                customOccurrences={formData.customOccurrences}
                onCustomOccurrencesChange={v => setFormData({...formData, customOccurrences: v})}
              />

              <EventDescription value={formData.description} onChange={v => setFormData({...formData, description: v})} />
              <EventTags tags={formData.tags} onChange={v => setFormData({...formData, tags: v})} />
           </CardContent>
        </Card>

        <div className="space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                <MapPin className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Localização</h2>
            </div>
            
            {currentOrg?.address?.latitude && (
               <Button 
                type="button" 
                variant="outline" 
                onClick={handleUseOrgLocation}
                className="rounded-xl h-10 px-4 gap-2 font-black uppercase text-[10px] border-secondary text-secondary hover:bg-secondary/5"
               >
                 <Building2 className="w-3.5 h-3.5" /> Usar Local da Sede
               </Button>
            )}
          </div>

          <EventLocation 
            address={formData.address} 
            onChange={v => setFormData({...formData, address: v})} 
            status={formData.status}
          />
        </div>

        {formData.type === 'interno' && (
          <div className="space-y-6">
             <BilheteriaAdmin 
               mode={ticketMode} 
               onModeChange={setTicketMode}
               batches={batches}
               onBatchesChange={setBatches}
               totalCapacity={totalCapacity}
               onTotalCapacityChange={setTotalCapacity}
               eventCurrency={formData.currency as CurrencyCode}
               onCurrencyChange={v => setFormData({...formData, currency: v})}
             />
          </div>
        )}

        <Button type="submit" disabled={loading || !currentOrg} className="w-full h-20 bg-secondary text-white font-black text-xl rounded-[2.5rem] shadow-xl uppercase italic transition-all active:scale-95">
          {loading ? <Loader2 className="animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          Publicar Experiência
        </Button>
      </form>
    </div>
  )
}
