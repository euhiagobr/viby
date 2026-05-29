"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useFirebaseApp, useMemoFirebase, useCollection } from "@/firebase"
import { updateDoc, doc, serverTimestamp, collection, query, orderBy } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { Loader2, ArrowLeft, Save, Handshake, LayoutGrid, Settings2, Ticket } from "lucide-react"
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
  EventCoOrganizers
} from "@/components/events"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { getAgeRatingConfig } from "@/lib/age-rating"

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

  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  
  const [formData, setFormData] = useState<any>(null)
  const [ticketMode, setTicketMode] = useState<any>('free')
  const [batches, setBatches] = useState<any[]>([])
  const [totalCapacity, setTotalCapacity] = useState(100)

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || "",
        image: event.image || "",
        type: event.type || "interno",
        externalUrl: event.externalUrl || "",
        categoryId: event.categoryId || "",
        startDate: event.date || "",
        endDate: event.endDate || "",
        description: event.description || "",
        status: event.status || "Ativo",
        tags: event.tags || [],
        ageRatingCode: event.ageRating?.code || "free",
        address: event.address || { street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "" }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !eventRef || !currentOrg) return

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

      // Limpar campos undefined para compatibilidade Firestore
      const cleanData = JSON.parse(JSON.stringify(updateData, (key, value) => value === undefined ? null : value));

      await updateDoc(eventRef, cleanData)
      toast({ title: "Evento Atualizado!" })
      router.push("/dashboard/organizacoes")
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
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
             <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Painel do Evento</h1>
             <p className="text-xs font-bold text-secondary uppercase tracking-widest">{formData.title}</p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={loading} className="bg-primary text-white font-black rounded-full h-11 px-8 shadow-lg gap-2 uppercase italic">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Tudo
        </Button>
      </div>

      <Tabs defaultValue="geral" className="space-y-8">
        <div className="flex justify-center">
           <TabsList className="bg-muted/50 p-1 rounded-2xl h-14">
              <TabsTrigger value="geral" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest gap-2">
                 <Settings2 className="w-4 h-4" /> Informações
              </TabsTrigger>
              <TabsTrigger value="bilheteria" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest gap-2">
                 <Ticket className="w-4 h-4" /> Bilheteria
              </TabsTrigger>
              <TabsTrigger value="parceiros" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest gap-2">
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

              <Card className="border-none shadow-sm rounded-[2rem]">
                <CardContent className="p-8">
                  <EventLocation address={formData.address} onChange={v => setFormData({...formData, address: v})} />
                </CardContent>
              </Card>
           </form>
        </TabsContent>

        <TabsContent value="bilheteria" className="animate-in fade-in duration-500">
           {formData.type === 'interno' ? (
             <BilheteriaAdmin 
               mode={ticketMode} 
               onModeChange={setTicketMode}
               batches={batches}
               onBatchesChange={setBatches}
               totalCapacity={totalCapacity}
               onTotalCapacityChange={setTotalCapacity}
             />
           ) : (
             <Card className="border-none shadow-sm rounded-[2rem] p-20 text-center flex flex-col items-center gap-4 opacity-40">
                <Ticket className="w-12 h-12 text-primary" />
                <p className="text-xs font-black uppercase tracking-[0.2em]">Bilheteria desativada para eventos externos ou de divulgação.</p>
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
