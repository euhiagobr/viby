
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
  X,
  Zap,
  CheckCircle2
} from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { cn, normalizeText, normalizeEventDates, safeParseDate, generateRecurrenceDates, formatDateForInput, dateToAtomsphericISO } from "@/lib/utils"
import { slugify } from "@/lib/slug-utils"
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

export default function EditarExperienciaPage() {
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
  const [matchSelection, setMatchSelection] = useState({ teamA: "", teamB: "" });

  const eventRef = React.useMemo(() => {
    if (!db || !eventId) return null
    try {
      return doc(db, "experiences", eventId)
    } catch (e) {
      return null
    }
  }, [db, eventId])
  
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const categoriesQuery = useMemoFirebase(() => db ? query(collection(db, "categories"), orderBy("name", "asc")) : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const slotsQuery = useMemoFirebase(() => 
    (db && eventId) ? query(collection(db, "experiences", eventId, "slots"), orderBy("datetime", "asc")) : null, 
    [db, eventId]
  )
  const { data: dbSlots, loading: loadingSlots } = useCollection<any>(slotsQuery)

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

  const reviewsQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null;
    return query(collection(db, "experience_reviews"), where("experienceId", "==", eventId));
  }, [db, eventId]);
  
  const { data: rawReviews, loading: reviewsLoading } = useCollection<any>(reviewsQuery);

  const reviews = React.useMemo(() => {
    if (!rawReviews) return [];
    return [...rawReviews].sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });
  }, [rawReviews]);

  const avgCriteria = React.useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    const totals = { org: 0, service: 0, quality: 0, price: 0, environment: 0 };
    reviews.forEach((r: any) => {
      const dr = r.detailedRatings || {};
      totals.org += dr.org || 5;
      totals.service += dr.service || 5;
      totals.quality += dr.quality || 5;
      totals.price += dr.price || 5;
      totals.environment += dr.environment || 5;
    });
    const count = reviews.length;
    return {
      org: (totals.org / count).toFixed(1),
      service: (totals.service / count).toFixed(1),
      quality: (totals.quality / count).toFixed(1),
      price: (totals.price / count).toFixed(1),
      environment: (totals.environment / count).toFixed(1),
    };
  }, [reviews]);

  useEffect(() => {
    if (event && !isDataLoaded && !loadingSlots) {
      const startInput = formatDateForInput(event.availability?.startDate || event.date);
      const endInput = formatDateForInput(event.availability?.endDate || event.endDate);

      setFormData({
        title: event.title || "",
        image: event.image || "",
        type: event.type || "interno",
        category: event.category || "",
        shortDescription: event.shortDescription || "",
        description: event.description || "",
        status: event.status || "active",
        tags: event.tags || [],
        ageRatingCode: event.ageRating?.code || "free",
        address: event.address || {},
        isRecurring: event.isRecurring || true,
        duration: event.duration || "",
        maxGroupSize: event.maxGroupSize || null,
        isUnlimitedCapacity: event.isUnlimitedCapacity || false,
        instantBooking: event.instantBooking ?? true,
        digitalVoucher: event.digitalVoucher ?? true,
        inclusions: event.inclusions || [],
        exclusions: event.exclusions || [],
        rules: event.rules || [],
        steps: event.steps || [],
        faqs: event.faqs || [],
        usagePolicy: event.usagePolicy || "",
        additionalInfo: event.additionalInfo || "",
        availability: event.availability || { startDate: startInput, endDate: endInput, allowedDays: [0,1,2,3,4,5,6], allowHolidays: true },
        currency: event.currency || "BRL",
        matches: event.matches || []
      })
      
      setTicketMode(event.ticketMode || 'free')
      
      if (dbSlots && dbSlots.length > 0) {
        setSessions(dbSlots.map(slot => ({
          id: slot.id,
          date: formatDateForInput(slot.datetime),
          price: slot.price,
          capacity: slot.capacity,
          sold: slot.sold || 0
        })));
      }
      setIsDataLoaded(true);
    }
  }, [event, dbSlots, isDataLoaded, loadingSlots])

  const showWcSection = formData?.tags?.includes('copa') && formData?.tags?.includes('temjogo');

  useEffect(() => {
    if (!showWcSection && formData?.matches?.length > 0) {
      setFormData(prev => prev ? ({ ...prev, matches: [] }) : null);
    }
  }, [showWcSection, formData?.matches?.length]);

  const handleImageUpload = async (file: File) => {
    if (!storage || !user) return
    setUploadProgress(0)
    const storageRef = ref(storage, `experiences/${user.uid}/${Date.now()}_${file.name}`)
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
    setStep(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleSubmit = async () => {
    if (!db || !currentOrg || !formData) return
    setLoading(true)
    try {
      await updateDoc(doc(db, "experiences", eventId), {
        ...formData,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Experiência atualizada!" })
      router.push(`/${currentOrg.username}/experiencia/${formData.slug || eventId}`)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message })
    } finally {
      setLoading(false)
    }
  }

  if (eventLoading || !formData) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando Dados...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
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
           <EventHeader title={formData.title} onTitleChange={v => setFormData({...formData, title: v, slug: slugify(v)})} image={formData.image} onImageUpload={handleImageUpload} uploadProgress={uploadProgress} />
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Categoria</Label>
                <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="rounded-xl">{categories?.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <EventDescription value={formData.description} onChange={v => setFormData({...formData, description: v})} />
              <EventVisibility value={formData.status} onChange={v => setFormData({...formData, status: v})} />
           </Card>
           <Button onClick={handleNextStep} className="w-full h-16 bg-primary text-white font-black rounded-2xl uppercase italic text-lg gap-2">Próximo Passo <ChevronRight className="w-5 h-5" /></Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <EventLocation address={formData.address} onChange={v => setFormData({...formData, address: v})} />
           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={handleNextStep} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Agenda e Regras <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Duração</Label>
                    <Input value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} className="rounded-xl h-11" placeholder="Ex: 3 horas" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Vagas Máximas</Label>
                    <Input type="number" value={formData.maxGroupSize || ""} onChange={e => setFormData({...formData, maxGroupSize: parseInt(e.target.value) || null})} className="rounded-xl h-11" />
                 </div>
              </div>
           </Card>
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
                 <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white shadow-xl">
                    <CheckCircle2 className="w-10 h-10" />
                 </div>
                 <h2 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Tudo pronto!</h2>
                 <p className="text-sm font-medium text-muted-foreground">Revise as alterações e publique para atualizar a vitrine.</p>
              </div>
           </Card>
           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(3)} className="h-20 px-8 rounded-[2.5rem] font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={handleSubmit} disabled={loading} className="flex-1 h-20 bg-secondary text-white font-black rounded-[2.5rem] shadow-xl uppercase italic text-xl gap-3 transition-all active:scale-95">
                 {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                 Salvar Alterações
              </Button>
           </div>
        </div>
      )}
    </div>
  )
}
