
"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useFirebaseApp, useMemoFirebase, useCollection } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { 
  Loader2, 
  ArrowLeft, 
  Check, 
  ChevronRight, 
  Save, 
  Zap, 
  Calendar, 
  Ticket, 
  Building2, 
  ShieldCheck, 
  Info,
  Layers,
  MapPin,
  Clock,
  Layout
} from "lucide-react"
import Link from "next/link"
import { normalizeText, normalizeEventDates, generateRecurrenceDates } from "@/lib/utils"
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
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

const DEFAULT_EVENT_IMAGE = "https://picsum.photos/seed/event/1200/800";

export default function NovoEventoWizard() {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user, profile } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg } = useCurrentOrganization()
  const { currency: dashboardCurrency } = useCurrency();
  const storage = React.useMemo(() => app ? getStorage(app) : null, [app])

  const [step, setStep] = useState(1)
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
      venueName: "", street: "", number: "", complement: "", neighborhood: "", 
      city: "", state: "", country: "Brasil", countryCode: "BR", postalCode: "", 
      latitude: null, longitude: null, formattedAddress: ""
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

  // Consultas de apoio
  const categoriesQuery = useMemoFirebase(() => db ? query(collection(db, "categories"), orderBy("name", "asc")) : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

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

  const handleNextStep = () => {
    if (step === 1) {
      if (!formData.title || !formData.categoryId || !formData.address.city) {
        toast({ variant: "destructive", title: "Campos obrigatórios", description: "Preencha o título, categoria e localização." });
        return;
      }
    }
    if (step === 2) {
      const check = normalizeEventDates(formData.startDate, formData.endDate);
      if (!check.isValid) {
        toast({ variant: "destructive", title: "Verifique a agenda", description: check.error });
        return;
      }
    }
    setStep(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handlePrevStep = () => {
    setStep(prev => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleSubmit = async () => {
    if (!db || !user || !currentOrg) return;
    setLoading(true);

    try {
      const ageRatingConfig = getAgeRatingConfig(formData.ageRatingCode);
      const searchKeywords = [...normalizeText(currentOrg.name).split(" "), ...normalizeText(formData.title).split(" ")];

      const eventPayload = {
        ...formData,
        organizer: { id: currentOrg.id, name: currentOrg.name, username: currentOrg.username, avatar: currentOrg.avatar || "" },
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
          customOccurrences: formData.customOccurrences,
          defaultBatches: batches
        });
      }

      toast({ title: "Evento Publicado!" });
      router.push(`/${result.username}/${result.slug || result.id}`);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na publicação", description: error.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard/projetos"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Novo Projeto</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Passo {step} de 4</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {[1, 2, 3, 4].map(s => (
             <div key={s} className={cn("h-1.5 rounded-full transition-all", s === step ? "w-8 bg-secondary" : s < step ? "w-4 bg-primary" : "w-4 bg-muted")} />
           ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
           <EventHeader 
              title={formData.title} 
              onTitleChange={v => setFormData({...formData, title: v})}
              image={formData.image}
              onImageUpload={handleImageUpload}
              uploadProgress={uploadProgress}
           />
           <Card className="border-none shadow-sm rounded-[2rem] bg-white">
              <CardContent className="p-8 space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <EventType value={formData.type} onChange={v => setFormData({...formData, type: v})} />
                    <EventVisibility value={formData.status} onChange={v => setFormData({...formData, status: v})} />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Categoria</Label>
                       <Select value={formData.categoryId} onValueChange={v => setFormData({...formData, categoryId: v, categoryName: categories?.find(c => c.id === v)?.name})}>
                          <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent className="rounded-xl">{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Classificação</Label>
                       <Select value={formData.ageRatingCode} onValueChange={v => setFormData({...formData, ageRatingCode: v})}>
                          <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {['free', '10', '12', '14', '16', 'not_recommended_18', 'adults_only_18'].map(c => <SelectItem key={c} value={c}>{getAgeRatingConfig(c).label}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                 </div>
                 <EventDescription value={formData.description} onChange={v => setFormData({...formData, description: v})} />
                 <EventTags tags={formData.tags} onChange={v => setFormData({...formData, tags: v})} />
              </CardContent>
           </Card>
           <EventLocation address={formData.address} onChange={v => setFormData({...formData, address: v})} />
           <Button onClick={handleNextStep} className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Próximo Passo <ChevronRight className="w-5 h-5" /></Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white">
              <CardHeader className="p-8 pb-4"><CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary">Agenda & Recorrência</CardTitle></CardHeader>
              <CardContent className="p-8 pt-0 space-y-8">
                 <EventDateTime startDate={formData.startDate} endDate={formData.endDate} onStartDateChange={v => setFormData({...formData, startDate: v})} onEndDateChange={v => setFormData({...formData, endDate: v})} />
                 <Separator className="border-dashed" />
                 <EventRecurrence 
                   isRecurring={formData.isRecurring} onIsRecurringChange={v => setFormData({...formData, isRecurring: v})}
                   frequency={formData.frequency} onFrequencyChange={v => setFormData({...formData, frequency: v})}
                   recurringEndDate={formData.recurringEndDate} onRecurringEndDateChange={v => setFormData({...formData, recurringEndDate: v})}
                   customOccurrences={formData.customOccurrences} onCustomOccurrencesChange={v => setFormData({...formData, customOccurrences: v})}
                 />
              </CardContent>
           </Card>
           <div className="flex gap-4">
              <Button variant="ghost" onClick={handlePrevStep} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={handleNextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Configurar Bilheteria <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
           <BilheteriaAdmin 
              mode={ticketMode} onModeChange={setTicketMode} 
              batches={batches} onBatchesChange={setBatches} 
              totalCapacity={totalCapacity} onTotalCapacityChange={setTotalCapacity}
              eventCurrency={formData.currency as CurrencyCode} onCurrencyChange={v => setFormData({...formData, currency: v})}
           />
           <div className="flex gap-4">
              <Button variant="ghost" onClick={handlePrevStep} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={handleNextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Finalizar Projeto <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Resumo do Evento</CardTitle>
                 <CardDescription className="font-bold text-secondary uppercase text-[10px]">Confirme os dados antes de publicar.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-10">
                 <div className="flex gap-6 items-center">
                    <div className="h-24 w-24 rounded-2xl bg-muted overflow-hidden shrink-0 shadow-lg border-2 border-white">
                       <img src={formData.image} className="w-full h-full object-cover" />
                    </div>
                    <div className="space-y-1">
                       <h2 className="text-3xl font-black italic uppercase tracking-tighter leading-none">{formData.title}</h2>
                       <Badge variant="secondary" className="font-black uppercase text-[10px]">{formData.categoryName}</Badge>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Calendar className="w-4 h-4 text-secondary" /> Calendário de Datas</p>
                       <div className="p-5 bg-muted/20 rounded-2xl border border-dashed space-y-3">
                          <div className="flex justify-between items-center text-xs font-bold uppercase">
                             <span className="opacity-40">Tipo:</span>
                             <span className="text-primary italic">{formData.isRecurring ? `Série ${formData.frequency}` : "Evento Único"}</span>
                          </div>
                          {formData.isRecurring && (
                            <div className="flex justify-between items-center text-xs font-bold uppercase">
                               <span className="opacity-40">Até:</span>
                               <span className="text-primary">{new Date(formData.recurringEndDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                            </div>
                          )}
                       </div>
                    </div>
                    <div className="space-y-4">
                       <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Ticket className="w-4 h-4 text-secondary" /> Bilheteria Ativa</p>
                       <div className="p-5 bg-muted/20 rounded-2xl border border-dashed space-y-3">
                          <div className="flex justify-between items-center text-xs font-bold uppercase">
                             <span className="opacity-40">Modo:</span>
                             <span className="text-primary italic">{ticketMode}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-bold uppercase">
                             <span className="opacity-40">Capacidade Total:</span>
                             <span className="text-primary">{totalCapacity} un.</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="p-6 bg-secondary/5 rounded-3xl border-2 border-dashed border-secondary/20 flex items-start gap-4">
                    <ShieldCheck className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
                    <div className="space-y-1">
                       <h4 className="font-black uppercase text-xs italic text-primary">Pronto para Publicar</h4>
                       <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase">Ao confirmar, o evento ficará visível imediatamente de acordo com o status selecionado ({formData.status}).</p>
                    </div>
                 </div>
              </CardContent>
           </Card>
           <div className="flex gap-4">
              <Button variant="ghost" onClick={handlePrevStep} className="h-20 px-8 rounded-[2.5rem] font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={handleSubmit} disabled={loading} className="flex-1 h-20 bg-secondary text-white font-black rounded-[2.5rem] shadow-xl uppercase italic text-xl gap-2 hover:scale-[1.02] transition-all">
                 {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                 Publicar Experiência
              </Button>
           </div>
        </div>
      )}
    </div>
  )
}
