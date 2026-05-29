"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useFirebaseApp } from "@/firebase"
import { updateDoc, doc, serverTimestamp } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { Loader2, ArrowLeft, Save } from "lucide-react"
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
  BilheteriaAdmin
} from "@/components/events"

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

      const updateData = {
        ...formData,
        date: formData.startDate,
        ticketMode: formData.type === 'interno' ? ticketMode : 'none',
        capacidadeTotal: totalCapacity,
        batches: formData.type === 'interno' ? batches : [],
        searchKeywords,
        updatedAt: serverTimestamp()
      }

      await updateDoc(eventRef, updateData)
      toast({ title: "Evento Atualizado!" })
      router.push("/dashboard/organizacoes")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  if (eventLoading || !formData) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Editar Evento</h1>
        </div>
        <Button onClick={handleSubmit} disabled={loading} className="bg-primary text-white font-black rounded-full h-11 px-8 shadow-lg gap-2 uppercase italic">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Alterações
        </Button>
      </div>

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

        {formData.type === 'interno' && (
          <BilheteriaAdmin 
            mode={ticketMode} 
            onModeChange={setTicketMode}
            batches={batches}
            onBatchesChange={setBatches}
            totalCapacity={totalCapacity}
            onTotalCapacityChange={setTotalCapacity}
          />
        )}
      </form>
    </div>
  )
}
