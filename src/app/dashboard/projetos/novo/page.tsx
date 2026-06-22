
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useFirebaseApp, useMemoFirebase, useCollection } from "@/firebase"
import { collection, query, orderBy, serverTimestamp, increment, doc } from "firebase/firestore"
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
  Layout,
  RefreshCw,
  Copy
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

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
    disclosurePrices: [] as any[],
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
  const [sessions, setSessions] = useState<any[]>([]) // Array de { date: string, batches: any[], capacity: number }

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
      
      // Gerar sessões iniciais baseadas na recorrência
      const recurrenceParams = {
        freq: formData.isRecurring ? formData.frequency : null,
        startDate: formData.startDate,
        endDate: formData.endDate,
        until: formData.recurringEndDate,
        customOccurrences: formData.customOccurrences
      };
      
      const generatedDates = generateRecurrenceDates(recurrenceParams);
      const initialSessions = generatedDates.map((d: any) => ({
        date: d.startDate.toISOString(),
        endDate: d.endDate.toISOString(),
        batches: sessions[0]?.batches || [
          {
            id: Math.random().toString(36).substring(2, 9),
            name: "Lote Único",
            startDate: "",
            endDate: "",
            capacidadeInicial: 100,
            ticketTypes: [{ id: 't1', name: 'Inteira', price: 0, quantity: 100 }]
          }
        ],
        capacity: sessions[0]?.capacity || 100
      }));
      
      setSessions(initialSessions);
    }
    
    setStep(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const replicateFirstSession = () => {
    if (sessions.length < 2) return;
    const firstBatches = [...sessions[0].batches];
    const firstCapacity = sessions[0].capacity;
    
    const newSessions = sessions.map((s, i) => i === 0 ? s : { ...s, batches: JSON.parse(JSON.stringify(firstBatches)), capacity: firstCapacity });
    setSessions(newSessions);
    toast({ title: "Bilheteria replicada para todas as datas!" });
  }

  const handleUpdateSessionTickets = (idx: number, newBatches: any[]) => {
    const newSessions = [...sessions];
    newSessions[idx].batches = newBatches;
    setSessions(newSessions);
  }

  const handleUpdateSessionCapacity = (idx: number, cap: number) => {
    const newSessions = [...sessions];
    newSessions[idx].capacity = cap;
    setSessions(newSessions);
  }

  const handleSubmit = async () => {
    if (!db || !user || !currentOrg) return;
    setLoading(true);

    try {
      const ageRatingConfig = getAgeRatingConfig(formData.ageRatingCode);
      const searchKeywords = [...normalizeText(currentOrg.name).split(" "), ...normalizeText(formData.title).split(" ")];

      // O evento pai guarda o template e o modo
      const eventPayload = {
        ...formData,
        organizer: { id: currentOrg.id, name: currentOrg.name, username: currentOrg.username, avatar: currentOrg.avatar || "" },
        ticketMode: formData.type === 'interno' ? ticketMode : 'none',
        ageRating: { code: ageRatingConfig.code, label: ageRatingConfig.label, minimumAge: ageRatingConfig.minimumAge },
        capacidadeTotal: sessions.reduce((acc, s) => acc + s.capacity, 0),
        batches: sessions[0]?.batches || [], // Template do primeiro lote
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

      // Gerar ocorrências com bilheterias individuais
      const occurrencesPayload = sessions.map(s => ({
        date: s.date.split('T')[0],
        startTime: s.date.split('T')[1]?.substring(0, 5) || "19:00",
        endTime: s.endDate.split('T')[1]?.substring(0, 5) || "22:00",
        batches: s.batches,
        capacidadeMaxima: s.capacity
      }));

      await generateOccurrences(result.id!, {
        name: formData.title,
        description: formData.description,
        organizationId: currentOrg.id,
        organizerName: currentOrg.name,
        frequency: 'custom', // Usamos custom aqui pois já enviamos as datas exatas
        customOccurrences: occurrencesPayload,
        capacidadeMaxima: 0 // Ignorado pois passamos no objeto acima
      });

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
           <Button onClick={handleNextStep} className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Seguir para Agenda <ChevronRight className="w-5 h-5" /></Button>
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
              <Button variant="ghost" onClick={() => setStep(1)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={handleNextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Configurar Bilheterias <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
              <div className="space-y-1">
                 <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Gestão de Ingressos</h2>
                 <p className="text-xs font-bold text-muted-foreground uppercase">{sessions.length} datas localizadas na agenda</p>
              </div>
              {sessions.length > 1 && (
                <Button variant="outline" onClick={replicateFirstSession} className="rounded-xl h-11 border-dashed gap-2 font-black uppercase text-[10px] border-secondary text-secondary">
                   <Copy className="w-4 h-4" /> Replicar Bilheteria da 1ª Data
                </Button>
              )}
           </div>

           <Accordion type="single" collapsible className="space-y-4">
              {sessions.map((session, idx) => (
                <AccordionItem key={idx} value={`session-${idx}`} className="border-none">
                  <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                    <AccordionTrigger className="px-8 py-6 hover:no-underline">
                       <div className="flex items-center gap-4 text-left">
                          <div className="w-12 h-12 rounded-2xl bg-muted flex flex-col items-center justify-center">
                             <span className="text-[8px] font-black uppercase opacity-40">{new Date(session.date).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                             <span className="text-lg font-black text-primary leading-none">{new Date(session.date).getDate()}</span>
                          </div>
                          <div>
                             <p className="text-sm font-black uppercase italic text-primary">{new Date(session.date).toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
                             <p className="text-[10px] font-bold text-muted-foreground uppercase">{session.capacity} Vagas • {session.batches?.length || 0} Lotes</p>
                          </div>
                       </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-8 pb-8 pt-0">
                       <Separator className="border-dashed mb-8" />
                       <BilheteriaAdmin 
                          mode={ticketMode} 
                          onModeChange={setTicketMode}
                          batches={session.batches}
                          onBatchesChange={(newBatches) => handleUpdateSessionTickets(idx, newBatches)}
                          totalCapacity={session.capacity}
                          onTotalCapacityChange={(cap) => handleUpdateSessionCapacity(idx, cap)}
                          eventCurrency={formData.currency as CurrencyCode}
                          onCurrencyChange={(cur) => setFormData({...formData, currency: cur})}
                          sessionLabel={`Configuração para: ${new Date(session.date).toLocaleDateString('pt-BR')}`}
                       />
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              ))}
           </Accordion>

           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(2)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={handleNextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Revisão Final <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Conferência de Agenda</CardTitle>
                 <CardDescription className="font-bold text-secondary uppercase text-[10px]">Revise todas as sessões antes de publicar.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-10">
                 <div className="flex gap-6 items-center">
                    <div className="h-20 w-20 rounded-2xl bg-muted overflow-hidden shrink-0 shadow-lg border-2 border-white">
                       <img src={formData.image} className="w-full h-full object-cover" />
                    </div>
                    <div className="space-y-1">
                       <h2 className="text-2xl font-black italic uppercase tracking-tighter leading-none">{formData.title}</h2>
                       <div className="flex gap-2">
                          <Badge variant="secondary" className="font-black uppercase text-[8px]">{formData.categoryName}</Badge>
                          <Badge className="bg-secondary text-white font-black uppercase text-[8px]">{formData.isRecurring ? `Série ${formData.frequency}` : "Único"}</Badge>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 px-2"><Clock className="w-4 h-4 text-secondary" /> Cronograma de Sessões</p>
                    <div className="grid grid-cols-1 gap-3">
                       {sessions.map((s, i) => (
                         <div key={i} className="p-4 bg-muted/20 rounded-2xl border border-dashed flex items-center justify-between">
                            <div className="flex items-center gap-4">
                               <div className="font-black text-sm text-primary uppercase italic">{new Date(s.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                               <Separator orientation="vertical" className="h-6" />
                               <div className="space-y-0.5">
                                  <p className="text-[10px] font-bold text-primary uppercase">{new Date(s.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às {new Date(s.endDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                  <p className="text-[8px] font-black text-muted-foreground uppercase opacity-60">{s.capacity} Vagas Totais</p>
                               </div>
                            </div>
                            <div className="flex gap-1">
                               {s.batches?.map((b: any, bi: number) => (
                                 <Badge key={bi} variant="outline" className="text-[7px] font-black uppercase border-secondary/20 text-secondary">{b.name}</Badge>
                               ))}
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>

                 <div className="p-6 bg-secondary/5 rounded-3xl border-2 border-dashed border-secondary/20 flex items-start gap-4">
                    <ShieldCheck className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
                    <div className="space-y-1">
                       <h4 className="font-black uppercase text-xs italic text-primary">Pronto para Publicar</h4>
                       <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase">Ao confirmar, o evento e todas as suas sessões ficarão visíveis imediatamente conforme o status selecionado ({formData.status}).</p>
                    </div>
                 </div>
              </CardContent>
           </Card>
           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(3)} className="h-20 px-8 rounded-[2.5rem] font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={handleSubmit} disabled={loading} className="flex-1 h-20 bg-secondary text-white font-black rounded-[2.5rem] shadow-xl uppercase italic text-xl gap-2 hover:scale-[1.02] transition-all">
                 {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Save className="w-6 h-6" />}
                 Publicar Todas as Datas
              </Button>
           </div>
        </div>
      )}
    </div>
  )
}
