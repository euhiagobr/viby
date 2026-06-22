
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
import { Loader2, ArrowLeft, Save, Handshake, Settings2, Ticket, RefreshCw, Eye, Star, ChevronRight, Check, Calendar, ShieldCheck, MapPin } from "lucide-react"
import Link from "next/link"
import { cn, normalizeText, normalizeEventDates, safeParseDate } from "@/lib/utils"
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
import { Separator } from "@/components/ui/separator"

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

  const eventRef = React.useMemo(() => (db && eventId) ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<any>(null)
  const [ticketMode, setTicketMode] = useState<any>('free')
  const [batches, setBatches] = useState<any[]>([])
  const [totalCapacity, setTotalCapacity] = useState(100)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const categoriesQuery = useMemoFirebase(() => db ? query(collection(db, "categories"), orderBy("name", "asc")) : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

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
        recurrency: event.recurrency || {},
        currency: event.currency || "BRL",
        curationType: event.curationType || "realização"
      })
      setTicketMode(event.ticketMode || 'free')
      setBatches(event.batches || [])
      setTotalCapacity(event.capacidadeTotal || 100)
    }
  }, [event])

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

  const handleSubmit = async () => {
    if (!db || !currentOrg || !formData) return
    setLoading(true)
    try {
      const result = await updateEventAction({
        eventId,
        orgId: currentOrg.id,
        eventData: {
          ...formData,
          ticketMode,
          batches,
          capacidadeTotal: totalCapacity,
          updatedAt: serverTimestamp()
        }
      });
      if (result.success) {
        toast({ title: "Alterações salvas!" })
        router.push(`/${result.username}/${result.slug || eventId}`)
      } else throw new Error(result.error)
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
              <EventDescription value={formData.description} onChange={v => setFormData({...formData, description: v})} />
           </Card>
           <EventLocation address={formData.address} onChange={v => setFormData({...formData, address: v})} />
           <Button onClick={() => setStep(2)} className="w-full h-16 bg-primary text-white font-black rounded-2xl uppercase italic text-lg gap-2">Seguir para Agenda <ChevronRight className="w-5 h-5" /></Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
              <EventDateTime startDate={formData.startDate} endDate={formData.endDate} onStartDateChange={v => setFormData({...formData, startDate: v})} onEndDateChange={v => setFormData({...formData, endDate: v})} />
              <Separator className="border-dashed" />
              <EventRecurrence 
                isRecurring={!!formData.recurrency?.freq} 
                onIsRecurringChange={v => setFormData({...formData, recurrency: v ? { ...formData.recurrency, freq: formData.recurrency.freq || 'weekly' } : {} })}
                frequency={formData.recurrency?.freq || ""} 
                onFrequencyChange={v => setFormData({...formData, recurrency: {...formData.recurrency, freq: v}})}
                recurringEndDate={formData.recurrency?.until || ""} 
                onRecurringEndDateChange={v => setFormData({...formData, recurrency: {...formData.recurrency, until: v}})}
                customOccurrences={formData.recurrency?.customOccurrences || []}
                onCustomOccurrencesChange={v => setFormData({...formData, recurrency: {...formData.recurrency, customOccurrences: v}})}
              />
           </Card>
           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={() => setStep(3)} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Configurar Bilheteria <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8">
           <BilheteriaAdmin mode={ticketMode} onModeChange={setTicketMode} batches={batches} onBatchesChange={setBatches} totalCapacity={totalCapacity} onTotalCapacityChange={setTotalCapacity} />
           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(2)} className="h-16 px-8 rounded-2xl font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={() => setStep(4)} className="flex-1 h-16 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">Concluir Edição <ChevronRight className="w-5 h-5" /></Button>
           </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-8">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-10 space-y-10">
              <div className="space-y-2">
                 <h2 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Conferência de Dados</h2>
                 <p className="text-sm font-medium text-muted-foreground">Revise as informações alteradas antes de salvar.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Calendar className="w-4 h-4 text-secondary" /> Agenda</p>
                    <div className="p-5 bg-muted/20 rounded-2xl border border-dashed space-y-3">
                       <div className="flex justify-between items-center text-xs font-bold uppercase">
                          <span className="opacity-40">Tipo:</span>
                          <span className="text-primary italic">{formData.recurrency?.freq ? `Série ${formData.recurrency.freq}` : "Evento Único"}</span>
                       </div>
                       {formData.recurrency?.freq === 'custom' ? (
                          <div className="space-y-1 pt-2">
                             <p className="text-[8px] font-black uppercase opacity-40">Datas Selecionadas:</p>
                             {formData.recurrency.customOccurrences?.map((occ: any, i: number) => (
                               <div key={i} className="text-[10px] font-bold text-primary flex justify-between">
                                  <span>{occ.date ? new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR') : "---"}</span>
                                  <span className="opacity-60">{occ.startTime} - {occ.endTime}</span>
                               </div>
                             ))}
                          </div>
                       ) : formData.recurrency?.until && (
                         <div className="flex justify-between items-center text-xs font-bold uppercase">
                            <span className="opacity-40">Até:</span>
                            <span className="text-primary">{new Date(formData.recurrency.until + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                         </div>
                       )}
                    </div>
                 </div>
                 <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><MapPin className="w-4 h-4" /> Local</p>
                    <p className="font-bold text-sm uppercase">{formData.address.city}, {formData.address.stateRegion}</p>
                 </div>
              </div>
           </Card>
           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(3)} className="h-20 px-8 rounded-[2.5rem] font-bold uppercase text-xs">Voltar</Button>
              <Button onClick={handleSubmit} disabled={loading} className="flex-1 h-20 bg-secondary text-white font-black rounded-[2.5rem] shadow-xl uppercase italic text-xl gap-2 transition-all active:scale-95">
                 {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                 Salvar Alterações
              </Button>
           </div>
        </div>
      )}
    </div>
  )
}
