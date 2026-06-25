"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useFirebaseApp, useMemoFirebase, useCollection } from "@/firebase"
import { doc, collection, query, orderBy, where, serverTimestamp, updateDoc, getDocs } from "firebase/firestore"
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
  Copy,
  Trash2,
  Trophy,
  Plus,
  X
} from "lucide-react"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { cn, normalizeText, normalizeEventDates, safeParseDate, generateRecurrenceDates, formatDateForInput, dateToAtomsphericISO } from "@/lib/utils"
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
import useSWR from 'swr'
import { fetcher, WC_ENDPOINTS } from '@/lib/services/worldCupService'
import { format } from "date-fns"

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
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const [formData, setFormData] = useState<any>(null)
  const [ticketMode, setTicketMode] = useState<any>('free')
  const [sessions, setSessions] = useState<any[]>([])
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const eventRef = React.useMemo(() => {
    if (!db || !eventId) return null
    try {
      return doc(db, "events", eventId)
    } catch (e) {
      return null
    }
  }, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const categoriesQuery = useMemoFirebase(() => db ? query(collection(db, "categories"), orderBy("name", "asc")) : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const occurrencesQuery = useMemoFirebase(() => 
    (db && eventId) ? query(collection(db, "recurring_occurrences"), where("parentId", "==", eventId), orderBy("date", "asc")) : null, 
    [db, eventId]
  )
  const { data: dbOccurrences, loading: loadingOccs } = useCollection<any>(occurrencesQuery)

  const { data: wcMatchesData } = useSWR<any>(WC_ENDPOINTS.matches, fetcher);

  const availableTeams = React.useMemo(() => {
    if (!wcMatchesData?.matches) return [];
    const teams = new Map();
    wcMatchesData.matches.forEach((m: any) => {
      if (m.homeTeam && m.homeTeam.id) teams.set(m.homeTeam.id, { id: m.homeTeam.id, name: m.homeTeam.name || m.homeTeam.shortName || 'TBD', flag: m.homeTeam.crest });
      if (m.awayTeam && m.awayTeam.id) teams.set(m.awayTeam.id, { id: m.awayTeam.id, name: m.awayTeam.name || m.awayTeam.shortName || 'TBD', flag: m.awayTeam.crest });
    });
    return Array.from(teams.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [wcMatchesData]);

  const [matchSelection, setMatchSelection] = useState({ teamA: "", teamB: "" });

  useEffect(() => {
    if (event && !isDataLoaded && !loadingOccs) {
      const startInput = formatDateForInput(event.startDate || event.date);
      const endInput = formatDateForInput(event.endDate);

      // Sincronização robusta de ocorrências existentes
      const initialCustomOccurrences = (dbOccurrences && dbOccurrences.length > 0) 
        ? dbOccurrences.map(o => ({
            date: o.date,
            startTime: o.startTime || "19:00",
            endTime: o.endTime || "22:00",
            batches: o.batches || []
          }))
        : (event.recurrency?.customOccurrences || []);

      setFormData({
        title: event.title || "",
        image: event.image || "",
        type: event.type || "interno",
        externalUrl: event.externalUrl || "",
        startingPrice: event.startingPrice || 0,
        disclosurePrices: event.disclosurePrices || [],
        categoryId: event.categoryId || "",
        categoryName: event.categoryName || "",
        startDate: startInput,
        endDate: endInput,
        description: event.description || "",
        status: event.status || "Ativo",
        tags: event.tags || [],
        ageRatingCode: event.ageRating?.code || "free",
        address: event.address || {},
        isRecurring: event.isRecurring || false,
        frequency: event.recurrency?.freq || "weekly",
        recurringEndDate: event.recurrency?.until || "",
        customOccurrences: initialCustomOccurrences,
        currency: event.currency || "BRL",
        curationType: event.curationType || "realização",
        matches: event.matches || []
      })
      setTicketMode(event.ticketMode || 'free')
      
      if (dbOccurrences && dbOccurrences.length > 0) {
        setSessions(dbOccurrences.map(occ => ({
          id: occ.id,
          date: formatDateForInput(`${occ.date}T${occ.startTime || '19:00'}:00`),
          endDate: formatDateForInput(`${occ.date}T${occ.endTime || '22:00'}:00`),
          batches: occ.batches || event.batches || [],
          capacity: occ.capacidadeMaxima || event.capacidadeTotal || 100
        })));
      } else {
        const s = safeParseDate(event.startDate || event.date);
        if (s) {
          setSessions([{
            date: s.toISOString(),
            endDate: safeParseDate(event.endDate)?.toISOString() || new Date(s.getTime() + 4 * 3600000).toISOString(),
            batches: event.batches || [],
            capacity: event.capacidadeTotal || 100
          }]);
        }
      }
      setIsDataLoaded(true);
    }
  }, [event, dbOccurrences, isDataLoaded, loadingOccs])

  const showWcSection = formData?.tags.includes('copa') && formData?.tags.includes('temjogo');

  useEffect(() => {
    if (!showWcSection && formData?.matches?.length > 0) {
      setFormData(prev => ({ ...prev, matches: [] }));
    }
  }, [showWcSection, formData?.matches?.length]);

  const handleAddMatch = () => {
    const { teamA, teamB } = matchSelection;
    if (!teamA || !teamB || teamA === teamB) return;

    if (!wcMatchesData?.matches) return;

    const match = wcMatchesData.matches.find((m: any) => 
      (m.homeTeam?.id?.toString() === teamA && m.awayTeam?.id?.toString() === teamB) ||
      (m.homeTeam?.id?.toString() === teamB && m.awayTeam?.id?.toString() === teamA)
    );

    if (!match) {
      toast({ variant: "destructive", title: "Partida não encontrada", description: "Não localizamos este confronto na base oficial." });
      return;
    }

    if (formData.matches.some(m => m.matchId === match.id.toString())) {
      toast({ variant: "destructive", title: "Partida duplicada", description: "Este jogo já foi adicionado." });
      return;
    }

    const newMatch = {
      matchId: match.id.toString(),
      teamA: match.homeTeam.id.toString(),
      teamB: match.awayTeam.id.toString(),
      teamAName: match.homeTeam.name,
      teamBName: match.awayTeam.name,
      teamAFlag: match.homeTeam.crest,
      teamBFlag: match.awayTeam.crest,
      kickoffAt: match.utcDate
    };

    setFormData(prev => ({ ...prev, matches: [...prev.matches, newMatch] }));
    setMatchSelection({ teamA: "", teamB: "" });
    toast({ title: "Jogo adicionado!" });
  };

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
      if (s && e) {
        allDates.push({ startDate: s, endDate: e });
      }

      if (formData.isRecurring) {
        const recurrenceParams = {
          freq: formData.frequency,
          startDate: formData.startDate,
          endDate: formData.endDate,
          until: formData.recurringEndDate,
          customOccurrences: formData.customOccurrences
        };
        
        const generated = generateRecurrenceDates(recurrenceParams);
        
        generated.forEach(g => {
          const isDuplicate = allDates.some(existing => 
            Math.abs(existing.startDate.getTime() - g.startDate.getTime()) < 60000
          );
          if (!isDuplicate) {
            allDates.push(g);
          }
        });
      }

      const newSessions = allDates.map((d: any) => {
        const iso = d.startDate.toISOString();
        const existing = sessions.find(s => s.date === iso || safeParseDate(s.date)?.toISOString() === iso);
        
        return {
          date: iso,
          endDate: d.endDate.toISOString(),
          batches: existing?.batches && existing.batches.length > 0 ? existing.batches : (sessions[0]?.batches || [
            {
              id: Math.random().toString(36).substring(2, 9),
              name: "Lote Único",
              startDate: "",
              endDate: "",
              capacidadeInicial: 100,
              ticketTypes: [{ id: 't1', name: 'Inteira', price: ticketMode === 'free' ? 0 : 50, quantity: 100 }]
            }
          ]),
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
      // Normalização final das datas para UTC absoluto antes de enviar para o servidor
      const updatePayload = {
        ...formData,
        startDate: dateToAtomsphericISO(formData.startDate),
        endDate: dateToAtomsphericISO(formData.endDate),
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

      const occurrencesPayload = sessions.map(s => {
        const d = safeParseDate(s.date);
        const de = safeParseDate(s.endDate);
        return {
          date: d ? format(d, "yyyy-MM-dd") : s.date.split('T')[0],
          startTime: d ? format(d, "HH:mm") : s.date.split('T')[1]?.substring(0, 5) || "19:00",
          endTime: de ? format(de, "HH:mm") : s.endDate.split('T')[1]?.substring(0, 5) || "22:00",
          batches: s.batches,
          capacidadeMaxima: s.capacity
        };
      });

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

              {showWcSection && (
                <div className="space-y-6 pt-6 border-t border-dashed border-secondary/20 animate-in zoom-in-95">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#ffdf00]/10 rounded-lg text-[#002776]"><Trophy className="w-6 h-6" /></div>
                    <div>
                      <h3 className="text-xl font-black italic uppercase tracking-tighter text-primary">Jogos transmitidos</h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Base oficial da Copa</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-5 space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-40">Seleção 1</Label>
                      <Select value={matchSelection.teamA} onValueChange={v => setMatchSelection({...matchSelection, teamA: v})}>
                        <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Time 1" /></SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {availableTeams.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name.toUpperCase()}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-1 flex justify-center pb-3 opacity-20"><X className="w-4 h-4" /></div>
                    <div className="md:col-span-5 space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-40">Seleção 2</Label>
                      <Select value={matchSelection.teamB} onValueChange={v => setMatchSelection({...matchSelection, teamB: v})}>
                        <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Time 2" /></SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {availableTeams.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name.toUpperCase()}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-1">
                      <Button type="button" onClick={handleAddMatch} className="h-12 w-full bg-[#009c3b] text-white rounded-xl shadow-lg"><Plus className="w-5 h-5" /></Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {formData.matches?.length === 0 ? (
                      <div className="py-10 text-center border-2 border-dashed rounded-3xl opacity-20 italic">Nenhum jogo vinculado</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {formData.matches?.map((m: any, i: number) => (
                          <div key={i} className="p-4 bg-muted/20 rounded-2xl border flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center -space-x-1.5">
                                <img src={m.teamAFlag} className="w-6 h-6 rounded-full border border-white shadow-sm" alt="" />
                                <img src={m.teamBFlag} className="w-6 h-6 rounded-full border border-white shadow-sm" alt="" />
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase italic text-primary truncate max-w-[150px]">{m.teamAName} × {m.teamBName}</p>
                                <p className="text-[8px] font-bold text-muted-foreground uppercase">{new Date(m.kickoffAt).toLocaleDateString('pt-BR')} às {new Date(m.kickoffAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                            </div>
                            <button type="button" onClick={() => setFormData((prev: any) => ({ ...prev, matches: prev.matches.filter((_: any, idx: number) => idx !== i) }))} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
           </Card>
           <EventLocation address={formData.address} onChange={v => setFormData({...formData, address: v})} />
           <Button onClick={handleNextStep} className="w-full h-16 bg-primary text-white font-black rounded-2xl uppercase italic text-lg gap-2">Próximo Passo <ChevronRight className="w-5 h-5" /></Button>
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

           <Accordion type="single" collapsible className="space-y-4" defaultValue="session-0">
              {sessions.map((session, idx) => (
                <AccordionItem key={idx} value={`session-${idx}`} className="border-none">
                  <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                    <AccordionTrigger className="px-8 py-6 hover:no-underline">
                       <div className="flex items-center gap-4 text-left">
                          <div className="w-12 h-12 rounded-2xl bg-muted flex flex-col items-center justify-center">
                             <span className="text-[8px] font-black uppercase opacity-40">
                               {(() => {
                                 const d = safeParseDate(session.date);
                                 return d ? d.toLocaleDateString('pt-BR', { month: 'short' }) : "---";
                               })()}
                             </span>
                             <span className="text-lg font-black text-primary leading-none">
                               {(() => {
                                 const d = safeParseDate(session.date);
                                 return d ? d.getDate() : "00";
                               })()}
                             </span>
                          </div>
                          <div>
                             <p className="text-sm font-black uppercase italic text-primary">{idx === 0 ? "Sessão Principal / " : ""}{safeParseDate(session.date)?.toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
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
                          sessionLabel={`Configuração para o dia: ${safeParseDate(session.date)?.toLocaleDateString('pt-BR')}`}
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
                            <span>{safeParseDate(s.date)?.toLocaleDateString('pt-BR')}</span>
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
