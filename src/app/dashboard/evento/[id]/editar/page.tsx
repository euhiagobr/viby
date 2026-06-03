"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useFirebaseApp, useMemoFirebase, useCollection } from "@/firebase"
import { updateDoc, doc, serverTimestamp, collection, query, orderBy, getDocs, where, limit, deleteDoc } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { Loader2, ArrowLeft, Save, Handshake, LayoutGrid, Settings2, Ticket, RefreshCw, AlertTriangle, Trash2, Calendar, Clock, X, ShieldAlert, Eye } from "lucide-react"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const DEFAULT_EVENT_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fcapa.jpeg?alt=media";

export default function EditarEventoPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg } = useCurrentOrganization()
  const storage = React.useMemo(() => app ? getStorage(app, "gs://viby") : null, [app])

  const eventRef = React.useMemo(() => (db && eventId) ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const categoriesQuery = useMemoFirebase(() => db ? query(collection(db, "categories"), orderBy("name", "asc")) : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const occurrencesQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(collection(db, "recurring_occurrences"), where("parentId", "==", eventId))
  }, [db, eventId])
  const { data: rawOccurrences, loading: occurrencesLoading } = useCollection<any>(occurrencesQuery)

  const occurrences = React.useMemo(() => {
    if (!rawOccurrences) return []
    return [...rawOccurrences].sort((a, b) => a.date.localeCompare(b.date))
  }, [rawOccurrences])

  const [loading, setLoading] = useState(false)
  const [isGeneratingOccurrences, setIsGeneratingOccurrences] = useState(false)
  const [isDeletingOccurrence, setIsDeletingOccurrence] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  
  const [formData, setFormData] = useState<any>(null)
  const [ticketMode, setTicketMode] = useState<any>('free')
  const [batches, setBatches] = useState<any[]>([])
  const [totalCapacity, setTotalCapacity] = useState(100)

  const isStripeVerified = currentOrg?.stripeChargesEnabled && currentOrg?.stripePayoutsEnabled;

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || "",
        image: event.image || DEFAULT_EVENT_IMAGE,
        type: event.type || "interno",
        externalUrl: event.externalUrl || "",
        categoryId: event.categoryId || "",
        startDate: event.date || "",
        endDate: event.endDate || "",
        description: event.description || "",
        status: event.status || "Ativo",
        tags: event.tags || [],
        ageRatingCode: event.ageRating?.code || "free",
        address: event.address || { street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "", latitude: -23.55052, longitude: -46.633308 },
        isMultiLocation: event.isMultiLocation || false,
        locations: event.locations || [],
        isRecurring: event.isRecurring || false,
        frequency: event.frequency || "weekly",
        recurringEndDate: event.recurringEndDate || ""
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

  const handleManualGenerateAgenda = async () => {
    if (!db || !currentOrg || !formData.isRecurring || !formData.recurringEndDate) return;
    setIsGeneratingOccurrences(true);
    try {
      const count = await generateOccurrences(eventId, {
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
      toast({ title: "Agenda Atualizada!", description: `${count} datas foram geradas.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao gerar agenda", description: e.message });
    } finally {
      setIsGeneratingOccurrences(false);
    }
  }

  const handleDeleteOccurrence = async (occId: string, date: string) => {
    if (!db || !eventId) return
    if (!confirm(`Deseja remover permanentemente a data ${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')} desta série?`)) return

    setIsDeletingOccurrence(occId)
    try {
      await deleteDoc(doc(db, "recurring_occurrences", occId))
      toast({ title: "Data removida!" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao excluir data" })
    } finally {
      setIsDeletingOccurrence(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !eventRef || !currentOrg) return

    const isPaid = ticketMode !== 'free';
    if (isPaid && !isStripeVerified) {
       toast({ variant: "destructive", title: "Bilheteria Bloqueada", description: "Verifique sua conta Stripe para habilitar vendas pagas." });
       return;
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
        updatedAt: serverTimestamp()
      }

      updateData.city = formData.address.city || "";
      updateData.location = formData.address.neighborhood || formData.address.street || "";
      updateData.latitude = formData.address.latitude || -23.55052;
      updateData.longitude = formData.address.longitude || -46.633308;

      if (formData.isMultiLocation && formData.locations.length > 0) {
        const L1 = formData.locations[0];
        updateData.address = {
          street: L1.street,
          number: L1.number,
          neighborhood: L1.neighborhood,
          city: L1.city,
          state: L1.state,
          country: L1.country,
          cep: L1.cep,
          latitude: L1.latitude,
          longitude: L1.longitude
        };
        updateData.city = L1.city;
        updateData.location = L1.neighborhood || L1.street;
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

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href={`/dashboard/organizacoes/${currentOrg?.username}/events`}><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
             <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Painel do Evento</h1>
             <p className="text-xs font-bold text-secondary uppercase tracking-widest">{formData.title}</p>
          </div>
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
              <TabsTrigger value="geral" className="rounded-lg px-8 font-black uppercase text-[10px] tracking-widest gap-2">
                 <Settings2 className="w-4 h-4" /> Informações
              </TabsTrigger>
              <TabsTrigger value="recorrencia" className="rounded-lg px-8 font-black uppercase text-[10px] tracking-widest gap-2">
                 <RefreshCw className="w-4 h-4" /> Recorrência
              </TabsTrigger>
              <TabsTrigger value="bilheteria" className="rounded-lg px-8 font-black uppercase text-[10px] tracking-widest gap-2">
                 <Ticket className="w-4 h-4" /> Bilheteria
              </TabsTrigger>
              <TabsTrigger value="parceiros" className="rounded-lg px-8 font-black uppercase text-[10px] tracking-widest gap-2">
                 <Handshake className="w-4 h-4" /> Co-realização
              </TabsTrigger>
           </TabsList>
        </div>

        <TabsContent value="geral" className="space-y-8 animate-in fade-in duration-500">
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

                    <EventDescription value={formData.description} onChange={v => setFormData({...formData, description: v})} />
                    <EventTags tags={formData.tags} onChange={v => setFormData({...formData, tags: v})} />
                </CardContent>
              </Card>

              <EventLocation 
                address={formData.address} 
                isMultiLocation={formData.isMultiLocation}
                locations={formData.locations}
                onChange={v => setFormData({...formData, address: v})} 
                onLocationsChange={v => setFormData({...formData, locations: v})}
                onToggleMultiLocation={v => setFormData({...formData, isMultiLocation: v})}
              />
           </form>
        </TabsContent>

        <TabsContent value="recorrencia" className="animate-in fade-in duration-500 space-y-12">
           <Card className="border-none shadow-sm rounded-[2.5rem]">
              <CardContent className="p-8">
                 <EventRecurrence 
                   isRecurring={formData.isRecurring}
                   onIsRecurringChange={v => setFormData({...formData, isRecurring: v})}
                   frequency={formData.frequency}
                   onFrequencyChange={v => setFormData({...formData, frequency: v})}
                   recurringEndDate={formData.recurringEndDate}
                   onRecurringEndDateChange={v => setFormData({...formData, recurringEndDate: v})}
                 />
              </CardContent>
           </Card>

           {formData.isRecurring && (
              <div className="space-y-8">
                <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                   <CardHeader className="bg-muted/30 border-b p-8 pb-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                         <div>
                            <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-2">
                               <Calendar className="w-5 h-5 text-secondary" /> Agenda de Datas
                            </CardTitle>
                            <CardDescription className="font-medium">Gerencie cada dia da série individualmente.</CardDescription>
                         </div>
                         <Button 
                           onClick={handleManualGenerateAgenda} 
                           disabled={isGeneratingOccurrences || !formData.recurringEndDate}
                           className="bg-secondary text-white font-black rounded-xl h-11 px-8 gap-2 shadow-lg hover:scale-105 transition-transform uppercase italic text-[10px]"
                         >
                            {isGeneratingOccurrences ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Regerar Todas as Datas
                         </Button>
                      </div>
                   </CardHeader>
                   <CardContent className="p-0">
                      {occurrencesLoading ? (
                        <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
                      ) : occurrences.length > 0 ? (
                        <Table>
                           <TableHeader className="bg-muted/10">
                              <TableRow>
                                 <TableHead className="p-8 font-black uppercase text-[10px]">Data do Evento</TableHead>
                                 <TableHead className="font-black uppercase text-[10px]">Horário</TableHead>
                                 <TableHead className="font-black uppercase text-[10px] text-center">Status</TableHead>
                                 <TableHead className="text-right font-black uppercase text-[10px] p-8">Ações</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {occurrences.map((occ) => (
                                <TableRow key={occ.id} className="hover:bg-muted/5 transition-colors">
                                   <TableCell className="p-8">
                                      <div className="flex items-center gap-3">
                                         <div className="p-2 bg-muted rounded-xl text-primary"><Calendar className="w-4 h-4" /></div>
                                         <span className="font-bold text-sm">{new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                                      </div>
                                   </TableCell>
                                   <TableCell>
                                      <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                                         <Clock className="w-3.5 h-3.5" /> {occ.startTime} - {occ.endTime}
                                      </div>
                                   </TableCell>
                                   <TableCell className="text-center">
                                      <Badge variant="outline" className="text-[9px] font-black uppercase border-green-200 text-green-600 bg-green-50">Confirmada</Badge>
                                   </TableCell>
                                   <TableCell className="p-8 text-right">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-destructive hover:bg-red-50 rounded-full"
                                        onClick={() => handleDeleteOccurrence(occ.id, occ.date)}
                                        disabled={isDeletingOccurrence === occ.id}
                                      >
                                         {isDeletingOccurrence === occ.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                      </Button>
                                   </TableCell>
                                </TableRow>
                              ))}
                           </TableBody>
                        </Table>
                      ) : (
                        <div className="py-24 text-center">
                           <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 opacity-20"><Calendar className="w-8 h-8" /></div>
                           <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Agenda não gerada ou sem datas futuras.</p>
                        </div>
                      )}
                   </CardContent>
                </Card>
              </div>
           )}
        </TabsContent>

        <TabsContent value="bilheteria" className="animate-in fade-in duration-500">
           {formData.type === 'interno' ? (
             <div className="space-y-6">
                {!isStripeVerified && (
                  <div className="p-6 bg-red-50 rounded-[2rem] border-2 border-dashed border-red-200 flex items-start gap-4">
                      <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="font-black uppercase text-xs italic text-red-800">Bilheteria Paga Bloqueada</h4>
                        <p className="text-[10px] text-red-700 font-medium leading-relaxed uppercase">
                            Sua conta de recebimento não está aprovada no Stripe. Você só pode publicar ou editar eventos para modo GRATUITO.
                        </p>
                      </div>
                  </div>
                )}
                <BilheteriaAdmin 
                  mode={ticketMode} 
                  onModeChange={v => {
                    if (v !== 'free' && v !== 'none' && !isStripeVerified) {
                        toast({ variant: "destructive", title: "Bloqueado", description: "Conecte sua conta Stripe para habilitar ingressos pagos." });
                        return;
                    }
                    setTicketMode(v);
                  }}
                  batches={batches}
                  onBatchesChange={setBatches}
                  totalCapacity={totalCapacity}
                  onTotalCapacityChange={setTotalCapacity}
                />
             </div>
           ) : (
             <Card className="border-none shadow-sm rounded-[2rem] p-20 text-center flex flex-col items-center gap-4 opacity-40">
                <Ticket className="w-12 h-12 text-primary" />
                <p className="text-xs font-black uppercase tracking-[0.2em]">Bilheteria desativada para este tipo de evento.</p>
             </Card>
           )}
        </TabsContent>

        <TabsContent value="parceiros" className="animate-in fade-in duration-500">
           {currentOrg && (
             <EventCoOrganizers eventId={eventId} currentOrgId={currentOrg.id} />
           )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
