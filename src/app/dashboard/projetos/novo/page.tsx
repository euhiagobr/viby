
"use client"

import * as React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useFirebaseApp, useMemoFirebase, useCollection } from "@/firebase"
import { collection, query, orderBy, serverTimestamp, doc, getDoc, getDocs, where, limit } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { 
  Loader2, 
  ArrowLeft, 
  Plus, 
  Save, 
  ChevronRight, 
  Trophy, 
  X,
  Calendar,
  Clock,
  Trash2,
  Sparkles,
  ShieldCheck,
  Building2,
  Handshake,
  CheckCircle2
} from "lucide-react"
import Link from "next/link"
import { cn, normalizeText, normalizeEventDates, generateRecurrenceDates, safeParseDate } from "@/lib/utils"
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
import { getOrCreateDraftAction, saveDraftAction, publishEventAction } from "@/app/actions/events"
import { Separator } from "@/components/ui/separator"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import useSWR from 'swr'
import { fetcher, WC_ENDPOINTS } from '@/lib/services/worldCupService'

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
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<any>({
    title: "",
    image: DEFAULT_EVENT_IMAGE,
    type: "interno",
    externalUrl: "",
    startingPrice: 0,
    disclosurePrices: [],
    categoryId: "",
    categoryName: "",
    ageRatingCode: "free",
    startDate: "",
    endDate: "",
    description: "",
    status: "Ativo",
    tags: [],
    address: { 
      venueName: "", street: "", number: "", complement: "", neighborhood: "", 
      city: "", state: "", country: "Brasil", countryCode: "BR", postalCode: "", 
      latitude: null, longitude: null, formattedAddress: ""
    },
    isRecurring: false,
    frequency: "weekly",
    recurringEndDate: "",
    customOccurrences: [],
    currency: dashboardCurrency || "BRL",
    curationType: "realização",
    matches: []
  })

  const [ticketMode, setTicketMode] = useState<any>('free')
  const [sessions, setSessions] = useState<any[]>([]) 
  const [autoSaveActive, setAutoSaveActive] = useState(false)

  const categoriesQuery = useMemoFirebase(() => db ? query(collection(db, "categories"), orderBy("name", "asc")) : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)
  const { data: wcMatchesData } = useSWR<any>(WC_ENDPOINTS.matches, fetcher);

  // Recuperação do Rascunho
  useEffect(() => {
    if (!user || !currentOrg) return;

    const initDraft = async () => {
      const res = await getOrCreateDraftAction(user.uid, currentOrg.id);
      if (res.success) {
        setDraftId(res.id!);
        if (res.data && Object.keys(res.data).length > 0) {
          setFormData((prev: any) => ({ ...prev, ...res.data }));
          setStep(res.step || 1);
        }
      }
      setLoading(false);
      setAutoSaveActive(true);
    };

    initDraft();
  }, [user, currentOrg]);

  // Auto-Save com Debounce
  useEffect(() => {
    if (!draftId || !autoSaveActive || publishing) return;

    const timer = setTimeout(async () => {
      await saveDraftAction(draftId, step, formData);
    }, 2000);

    return () => clearTimeout(timer);
  }, [formData, step, draftId, autoSaveActive, publishing]);

  const handleImageUpload = async (file: File) => {
    if (!storage || !user) return
    setUploadProgress(0)
    const storageRef = ref(storage, `events/${user.uid}/${Date.now()}_${file.name}`)
    const uploadTask = uploadBytesResumable(storageRef, file)
    uploadTask.on('state_changed', 
      (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100), 
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
      
      const s = safeParseDate(formData.startDate);
      const e = safeParseDate(formData.endDate);
      
      let allDates: { startDate: Date; endDate: Date }[] = [];
      if (s && e) allDates.push({ startDate: s, endDate: e });

      if (formData.isRecurring) {
        const generated = generateRecurrenceDates({
          freq: formData.frequency,
          startDate: formData.startDate,
          endDate: formData.endDate,
          until: formData.recurringEndDate,
          customOccurrences: formData.customOccurrences
        });
        generated.forEach(g => {
          if (!allDates.some(ex => Math.abs(ex.startDate.getTime() - g.startDate.getTime()) < 60000)) {
            allDates.push(g);
          }
        });
      }

      const newSessions = allDates.map((d: any) => ({
        date: d.startDate.toISOString(),
        endDate: d.endDate.toISOString(),
        batches: sessions[0]?.batches || [
          {
            id: Math.random().toString(36).substring(2, 9),
            name: "Lote Único",
            startDate: "",
            endDate: "",
            capacidadeInicial: 100,
            ticketTypes: [{ id: 't1', name: 'Inteira', price: ticketMode === 'free' ? 0 : 50, quantity: 100 }]
          }
        ],
        capacity: sessions[0]?.capacity || 100
      }));
      setSessions(newSessions);
    }
    setStep(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handlePublish = async () => {
    if (!db || !user || !currentOrg || !draftId) return;
    
    setPublishing(true);
    try {
      const ageRatingConfig = getAgeRatingConfig(formData.ageRatingCode);
      const finalPayload = {
        ...formData,
        organizer: { id: currentOrg.id, name: currentOrg.name, username: currentOrg.username, avatar: currentOrg.avatar || "" },
        ticketMode: formData.type === 'interno' ? ticketMode : 'none',
        ageRating: { code: ageRatingConfig.code, label: ageRatingConfig.label, minimumAge: ageRatingConfig.minimumAge },
        capacidadeTotal: sessions.reduce((acc, s) => acc + (s.capacity || 0), 0),
        batches: sessions[0]?.batches || [],
        city: formData.address.city,
        location: formData.address.neighborhood || formData.address.venueName,
        latitude: formData.address.latitude,
        longitude: formData.address.longitude,
      };

      const result = await publishEventAction(draftId, finalPayload);
      if (!result.success) throw new Error(result.error);

      // Gerar ocorrências físicas
      const occurrencesPayload = sessions.map(s => ({
        date: s.date.split('T')[0],
        startTime: s.date.split('T')[1]?.substring(0, 5) || "19:00",
        endTime: s.endDate.split('T')[1]?.substring(0, 5) || "22:00",
        batches: s.batches,
        capacidadeMaxima: s.capacity
      }));

      await generateOccurrences(draftId, {
        name: formData.title,
        description: formData.description,
        organizationId: currentOrg.id,
        organizerName: currentOrg.name,
        frequency: 'custom',
        customOccurrences: occurrencesPayload,
        capacidadeMaxima: 0
      });

      toast({ title: "Evento Publicado!", description: "Seu rascunho agora está no ar." });
      router.push(`/${currentOrg.username}/${result.slug}`);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na publicação", description: error.message });
      setPublishing(false);
    }
  }

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="animate-spin text-secondary w-12 h-12" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard/projetos"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Novo Projeto</h1>
            <div className="flex items-center gap-2 mt-1">
               <Badge className="bg-orange-500 text-white text-[8px] font-black uppercase h-4">Modo Rascunho</Badge>
               <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Passo {step} de 4</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {[1, 2, 3, 4].map(s => (
             <div key={s} className={cn("h-1.5 rounded-full transition-all", s === step ? "w-8 bg-secondary" : s < step ? "w-4 bg-primary" : "w-4 bg-muted")} />
           ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <EventHeader title={formData.title} onTitleChange={v => setFormData({...formData, title: v})} image={formData.image} onImageUpload={handleImageUpload} uploadProgress={uploadProgress} />
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
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
                 />
                 <EventVisibility value={formData.status} onChange={v => setFormData({...formData, status: v})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase opacity-60">Tipo de Vínculo</Label>
                   <Select value={formData.curationType} onValueChange={v => setFormData({...formData, curationType: v})}>
                      <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                         <SelectItem value="realização">Realização Direta</SelectItem>
                         <SelectItem value="curadoria">Curadoria de Terceiros</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
              </div>
              <EventDescription value={formData.description} onChange={v => setFormData({...formData, description: v})} />
              <EventTags tags={formData.tags} onChange={v => setFormData({...formData, tags: v})} />
           </Card>
           <EventLocation address={formData.address} onChange={v => setFormData({...formData, address: v})} />
           <Button onClick={handleNextStep} className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Próximo Passo <ChevronRight className="w-5 h-5" /></Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
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
              <Button onClick={handleNextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Bilheterias <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <Accordion type="single" collapsible className="space-y-4" defaultValue="session-0">
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
                             <p className="text-sm font-black uppercase italic text-primary">{idx === 0 ? "Sessão Inicial" : `Sessão ${idx + 1}`}</p>
                             <p className="text-[10px] font-bold text-muted-foreground uppercase">{session.capacity} Vagas</p>
                          </div>
                       </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-8 pb-8 pt-0">
                       <BilheteriaAdmin 
                          mode={ticketMode} 
                          onModeChange={setTicketMode}
                          batches={session.batches}
                          onBatchesChange={(newBatches) => {
                            const updated = [...sessions];
                            updated[idx].batches = newBatches;
                            setSessions(updated);
                          }}
                          totalCapacity={session.capacity}
                          onTotalCapacityChange={(cap) => {
                            const updated = [...sessions];
                            updated[idx].capacity = cap;
                            setSessions(updated);
                          }}
                          eventCurrency={formData.currency}
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
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-10 space-y-10">
              <div className="text-center space-y-4">
                 <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white shadow-xl shadow-green-500/20">
                    <CheckCircle2 className="w-10 h-10" />
                 </div>
                 <h2 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Pronto para Publicar!</h2>
                 <p className="text-sm font-medium text-muted-foreground">Revise os dados acima. Ao clicar em publicar, o rascunho será movido para as listagens públicas.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-dashed pt-10">
                 <div className="p-6 bg-muted/20 rounded-3xl space-y-1">
                    <p className="text-[10px] font-black uppercase opacity-40">Título</p>
                    <p className="font-bold uppercase italic text-primary">{formData.title}</p>
                 </div>
                 <div className="p-6 bg-muted/20 rounded-3xl space-y-1">
                    <p className="text-[10px] font-black uppercase opacity-40">Datas</p>
                    <p className="font-bold uppercase text-primary">{sessions.length} Sessões</p>
                 </div>
              </div>
           </Card>

           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(3)} className="h-20 px-8 rounded-[2.5rem] font-bold uppercase text-xs">Voltar</Button>
              <Button 
                onClick={handlePublish} 
                disabled={publishing || !formData.title} 
                className="flex-1 h-20 bg-secondary text-white font-black rounded-[2.5rem] shadow-xl uppercase italic text-xl gap-2 transition-all active:scale-95"
              >
                 {publishing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                 Publicar Evento
              </Button>
           </div>
        </div>
      )}
    </div>
  )
}
