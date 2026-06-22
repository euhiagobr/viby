
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useFirebaseApp, useMemoFirebase, useCollection } from "@/firebase"
import { doc, collection, query, orderBy, where, serverTimestamp } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { 
  Loader2, 
  ArrowLeft, 
  Save, 
  Handshake, 
  Settings2, 
  Ticket, 
  RefreshCw, 
  Eye, 
  Star, 
  ChevronRight, 
  Check, 
  Calendar, 
  ShieldCheck, 
  MapPin,
  Clock,
  Copy
} from "lucide-react"
import Link from "next/link"
import { cn, normalizeText, normalizeEventDates, safeParseDate, generateRecurrenceDates } from "@/lib/utils"
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
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"
import { updateEventAction } from "@/app/actions/events"
import { generateOccurrences } from "@/services/recurring-event-service"
import { Separator } from "@/components/ui/separator"
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

export default function EditarEventoWizard() {
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

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<any>(null)
  const [ticketMode, setTicketMode] = useState<any>('free')
  const [sessions, setSessions] = useState<any[]>([])
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const eventRef = React.useMemo(() => (db && eventId) ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const categoriesQuery = useMemoFirebase(() => db ? query(collection(db, "categories"), orderBy("name", "asc")) : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const occurrencesQuery = useMemoFirebase(() => 
    (db && eventId) ? query(collection(db, "recurring_occurrences"), where("parentId", "==", eventId), orderBy("date", "asc")) : null, 
    [db, eventId]
  )
  const { data: dbOccurrences } = useCollection<any>(occurrencesQuery)

  useEffect(() => {
    if (event) {
      const start = safeParseDate(event.startDate || event.date);
      const end = safeParseDate(event.endDate);

      setFormData({
        title: event.title || "",
        image: event.image || "",
        type: event.type || "interno",
        externalUrl: event.externalUrl || "",
        startingPrice: event.startingPrice || 0,
        disclosurePrices: event.disclosurePrices || [],
        categoryId: event.categoryId || "",
        categoryName: event.categoryName || "",
        startDate: start ? start.toISOString().slice(0, 16) : "",
        endDate: end ? end.toISOString().slice(0, 16) : "",
        description: event.description || "",
        status: event.status || "Ativo",
        tags: event.tags || [],
        ageRatingCode: event.ageRating?.code || "free",
        address: event.address || {},
        isRecurring: event.isRecurring || false,
        frequency: event.recurrency?.freq || "weekly",
        recurringEndDate: event.recurrency?.until || "",
        customOccurrences: event.recurrency?.customOccurrences || [],
        currency: event.currency || "BRL",
        curationType: event.curationType || "realização"
      })
      setTicketMode(event.ticketMode || 'free')
      
      // Inicializar sessões a partir das ocorrências do banco se existirem
      if (dbOccurrences && dbOccurrences.length > 0) {
        setSessions(dbOccurrences.map(occ => ({
          id: occ.id,
          date: `${occ.date}T${occ.startTime || '19:00'}:00`,
          endDate: `${occ.date}T${occ.endTime || '22:00'}:00`,
          batches: occ.batches || event.batches || [],
          capacity: occ.capacidadeMaxima || event.capacidadeTotal || 100
        })));
      } else {
        setSessions([{
          date: start ? start.toISOString() : "",
          endDate: end ? end.toISOString() : "",
          batches: event.batches || [],
          capacity: event.capacidadeTotal || 100
        }]);
      }
    }
  }, [event, dbOccurrences])

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

  const handleNextStep = () => {
    if (step === 2) {
      const check = normalizeEventDates(formData.startDate, formData.endDate);
      if (!check.isValid) {
        toast({ variant: "destructive", title: "Verifique a agenda", description: check.error });
        return;
      }
      
      // Regerar sessões se a recorrência mudou
      const recurrenceParams = {
        freq: formData.isRecurring ? formData.frequency : null,
        startDate: formData.startDate,
        endDate: formData.endDate,
        until: formData.recurringEndDate,
        customOccurrences: formData.customOccurrences
      };
      
      const generatedDates = generateRecurrenceDates(recurrenceParams);
      const newSessions = generatedDates.map((d: any) => {
        const iso = d.startDate.toISOString();
        const existing = sessions.find(s => s.date === iso);
        return {
          date: iso,
          endDate: d.endDate.toISOString(),
          batches: existing?.batches || sessions[0]?.batches || [],
          capacity: existing?.capacity || sessions[0]?.capacity || 100
        };
      });
      setSessions(newSessions);
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
    toast({ title: "Bilheteria replicada!" });
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
    if (!db || !currentOrg || !formData) return
    setLoading(true)
    try {
      const updatePayload = {
        ...formData,
        ticketMode,
        batches: sessions[0]?.batches || [],
        capacidadeTotal: sessions.reduce((acc, s) => acc + (parseInt(s.capacity) || 0), 0),
        recurrency: {
           freq: formData.isRecurring ? formData.frequency : null,
           until: formData.recurringEndDate,
           customOccurrences: formData.customOccurrences
        },
        updatedAt: serverTimestamp()
      };

      const result = await updateEventAction({
        eventId,
        orgId: currentOrg.id,
        eventData: updatePayload
      });

      if (!result.success) throw new Error(result.error)

      // Atualizar ocorrências
      const occurrencesPayload = sessions.map(s => ({
        date: s.date.split('T')[0],
        startTime: s.date.split('T')[1]?.substring(0, 5) || "19:00",
        endTime: s.endDate.split('T')[1]?.substring(0, 5) || "22:00",
        batches: s.batches,
        capacidadeMaxima: s.capacity
      }));

      await generateOccurrences(eventId, {
        name: formData.title,
        description: formData.description,
        organizationId: currentOrg.id,
        organizerName: currentOrg.name,
        frequency: 'custom',
        customOccurrences: occurrencesPayload,
        capacidadeMaxima: 0
      });

      toast({ title: "Evento atualizado!" })
      router.push(`/${result.username}/${result.slug || eventId}`)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message })
    } finally {
      setLoading(false)
    }
  }

  if (eventLoading || !formData) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-secondary" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href={`/dashboard/organizacoes/${currentOrg?.username}/events`}><ArrowLeft className="w-5 h-5" /></Link></Button>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Editar Experiência</h1>
        </div>
        <div className="flex items-center gap-2">
           {[1, 2, 3, 4].map(s => (
             <div key={s} className={cn("h-1.5 rounded-full transition-all", s === step ? "w-8 bg-secondary" : "w-4 bg-muted")} />
           ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-8">
           <EventHeader title={formData.title} onTitleChange={v => setFormData({...formData, title: v})} image={formData.image} onImageUpload={handleImageUpload} uploadProgress={uploadProgress} />
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <EventType value={formData.type} onChange={v => setFormData({...formData, type: v})} />
                 <EventVisibility value={formData.status} onChange={v => setFormData({...formData, status: v})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Categoria</Label>
                  <Select value={formData.categoryId} onValueChange={v => setFormData({...formData, categoryId: v, categoryName: categories?.find((c: any) => c.id === v)?.name})}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="rounded-xl">{categories?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
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
           </Card>
           <EventLocation address={formData.address} onChange={v => setFormData({...formData, address: v})} />
           <Button onClick={handleNextStep} className="w-full h-16 bg-primary text-white font-black rounded-2xl uppercase italic text-lg gap-2">Próximo Passo <ChevronRight className="w-5 h-5" /></Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
              <EventDateTime startDate={formData.startDate} endDate={formData.endDate} onStartDateChange={v => setFormData({...formData, startDate: v})} onEndDateChange={v => setFormData({...formData, endDate: v})} />
              <Separator className="border-dashed" />
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
           </Card>
           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={handleNextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Configurar Bilheterias <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
              <div className="space-y-1">
                 <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Gestão de Ingressos</h2>
                 <p className="text-xs font-bold text-muted-foreground uppercase">{sessions.length} datas localizadas</p>
              </div>
              {sessions.length > 1 && (
                <Button variant="outline" onClick={replicateFirstSession} className="rounded-xl h-11 border-dashed gap-2 font-black uppercase text-[10px] border-secondary text-secondary">
                   <Copy className="w-4 h-4" /> Replicar para todas as datas
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
                          sessionLabel={`Configuração para o dia: ${new Date(session.date).toLocaleDateString('pt-BR')}`}
                       />
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              ))}
           </Accordion>

           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(2)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={handleNextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Concluir Alterações <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-10 space-y-10">
              <div className="space-y-2">
                 <h2 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Conferência Final</h2>
                 <p className="text-sm font-medium text-muted-foreground">Verifique os dados antes de atualizar a série.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Calendar className="w-4 h-4 text-secondary" /> Sessões Monitoradas</p>
                    <div className="p-5 bg-muted/20 rounded-2xl border border-dashed space-y-3">
                       {sessions.map((s, i) => (
                         <div key={i} className="flex justify-between items-center text-[10px] font-bold uppercase">
                            <span>{new Date(s.date).toLocaleDateString('pt-BR')}</span>
                            <span className="text-primary italic">{s.capacity} Vagas</span>
                         </div>
                       ))}
                    </div>
                 </div>
                 <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><MapPin className="w-4 h-4" /> Local Mantido</p>
                    <p className="font-bold text-sm uppercase">{formData.address.city}, {formData.address.stateRegion}</p>
                 </div>
              </div>
              <div className="p-6 bg-orange-50 rounded-3xl border-2 border-dashed border-orange-200 flex items-start gap-4">
                 <ShieldCheck className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
                 <p className="text-[10px] text-orange-800 font-bold uppercase leading-relaxed">As alterações serão aplicadas em todas as sessões futuras. Ingressos já vendidos não serão afetados, mas o estoque remanescente será recalculado.</p>
              </div>
           </Card>
           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(3)} className="h-20 px-8 rounded-[2.5rem] font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={handleSubmit} disabled={loading} className="flex-1 h-20 bg-secondary text-white font-black rounded-[2.5rem] shadow-xl uppercase italic text-xl gap-2 transition-all active:scale-95">
                 {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                 Atualizar Evento
              </Button>
           </div>
        </div>
      )}
    </div>
  )
}
