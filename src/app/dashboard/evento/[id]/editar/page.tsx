"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useFirestore, useAuth, useUser, useFirebaseApp, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { updateDoc, doc, collection, serverTimestamp, getDoc, setDoc, deleteDoc, query, where, getDocs } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import { 
  ArrowLeft, 
  Upload, 
  MapPin, 
  Calendar, 
  Plus, 
  Trash2, 
  Loader2, 
  ImageIcon,
  Save,
  Clock,
  Building2,
  Info,
  AlertTriangle,
  CheckCircle2,
  Ticket,
  Sparkles,
  Layers,
  Users,
  AtSign,
  X
} from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { sendPartnerInvitationEmail } from "@/app/actions/email"

interface TicketType {
  id: string
  name: string
  price: number
  quantity: number
  requiresProof: boolean
  isLegalHalf: boolean
  description: string
  poolId?: string
  poolName?: string
}

interface Batch {
  id: string
  name: string
  description: string
  startDate: string
  endDate: string
  ticketTypes: TicketType[]
}

const TICKET_CATEGORIES = [
  { name: "Inteira", isLegalHalf: false, requiresProof: false },
  { name: "Meia Estudante", isLegalHalf: true, requiresProof: true },
  { name: "Meia PCD", isLegalHalf: true, requiresProof: true },
  { name: "Meia Idoso", isLegalHalf: true, requiresProof: true },
  { name: "Meia ID Jovem", isLegalHalf: true, requiresProof: true },
  { name: "Ingresso Social", isLegalHalf: false, requiresProof: true },
  { name: "Cortesia", isLegalHalf: false, requiresProof: false },
  { name: "Promocional", isLegalHalf: false, requiresProof: false },
]

export default function EditarEventoPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg, userRole, loading: orgLoading } = useCurrentOrganization()

  const eventRef = React.useMemo(() => (db && eventId) ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)
  
  const storage = React.useMemo(() => app ? getStorage(app, "gs://viby") : null, [app])
  const categoriesQuery = useMemoFirebase(() => db ? collection(db, "categories") : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  
  const [selectedCategory, setSelectedCategory] = useState("")
  const [ticketMode, setTicketMode] = useState<'free' | 'paid_single' | 'batches'>('free')
  const [batches, setBatches] = useState<Batch[]>([])

  const [address, setAddress] = useState({ street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "" })
  
  // Co-organizadores
  const [coOrganizers, setCoOrganizers] = useState<any[]>([])
  const [searchUsername, setSearchUsername] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [orgToDelete, setOrgToDelete] = useState<any | null>(null)

  const [isDistributeOpen, setIsDistributeOpen] = useState(false)
  const [distributeBatchIdx, setDistributeBatchIdx] = useState<number | null>(null)
  const [totalToDistribute, setTotalToDistribute] = useState("")

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

  // Carregar parceiros existentes
  useEffect(() => {
    if (!db || !eventId) return
    const fetchPartners = async () => {
      const q = collection(db, 'events', eventId, 'partners')
      const snap = await getDocs(q)
      const partnersList = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setCoOrganizers(partnersList)
    }
    fetchPartners()
  }, [db, eventId])

  useEffect(() => {
    if (event) {
      setSelectedCategory(event.categoryId || event.category || "")
      setTicketMode(event.ticketMode || (event.isFree ? 'free' : 'batches'))
      setBatches(event.batches || [])
      setAddress(event.address || { street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "" })
      setImagePreview(event.image || null)
      setUploadedImageUrl(event.image || null)
    }
  }, [event])

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return
    setImagePreview(URL.createObjectURL(file))
    setUploadProgress(0)
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      const storageRef = ref(storage, `events/${user.uid}/${fileName}`)
      const uploadTask = uploadBytesResumable(storageRef, file)
      uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), () => setUploadProgress(null), async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
        setUploadedImageUrl(downloadURL); setUploadProgress(null)
      })
    } catch (err) { setUploadProgress(null) }
  }

  const handleCepBlur = async () => {
    const cleanCep = address.cep.replace(/\D/g, "")
    if (cleanCep.length !== 8) return
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await response.json()
      if (!data.erro) {
        setAddress(prev => ({
          ...prev,
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || ""
        }))
      }
    } catch (e) {}
  }

  const handleSearchOrg = async () => {
    if (!db || !searchUsername || !currentOrg) return
    const usernameInput = searchUsername.toLowerCase().replace('@', '').trim()
    
    if (usernameInput === currentOrg.username) {
      toast({ variant: "destructive", title: "Operação inválida", description: "Você já é o organizador principal." })
      return
    }

    setIsSearching(true)
    try {
      const usernameRef = doc(db, 'usernames', usernameInput)
      const usernameSnap = await getDoc(usernameRef)

      if (!usernameSnap.exists() || usernameSnap.data().type !== 'organization') {
        throw new Error("Organização não encontrada.")
      }

      const orgId = usernameSnap.data().uid
      if (coOrganizers.find(o => o.id === orgId)) {
        throw new Error("Esta organização já foi adicionada.")
      }

      const orgSnap = await getDoc(doc(db, 'organizations', orgId))
      if (orgSnap.exists()) {
        const orgData = orgSnap.data()
        setCoOrganizers(prev => [...prev, { id: orgSnap.id, ...orgData, _isNew: true }])
        setSearchUsername("")
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Busca falhou", description: error.message })
    } finally {
      setIsSearching(false)
    }
  }

  const handleRemoveOrganizer = async () => {
    if (!orgToDelete) return
    const orgId = orgToDelete.id

    if (!orgToDelete._isNew && db && eventId) {
      try {
        await deleteDoc(doc(db, 'events', eventId, 'partners', orgId))
        toast({ title: "Parceria removida" })
      } catch (e) {
        toast({ variant: "destructive", title: "Erro ao remover", description: "Verifique suas permissões." })
        return
      }
    }
    setCoOrganizers(coOrganizers.filter(o => o.id !== orgId))
    setOrgToDelete(null)
  }

  const handleDistribute = () => {
    if (distributeBatchIdx === null || !totalToDistribute) return
    const total = parseInt(totalToDistribute)
    if (isNaN(total)) return

    const meiaPoolId = crypto.randomUUID()
    const meiaQuantity = Math.floor(total * 0.4)
    const inteiraQuantity = total - meiaQuantity

    const newTypes: TicketType[] = [
      { id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: inteiraQuantity, requiresProof: false, isLegalHalf: false, description: "" },
      { id: crypto.randomUUID(), name: "Meia Estudante", price: 50, quantity: meiaQuantity, poolId: meiaPoolId, poolName: "Meia-Entrada", requiresProof: true, isLegalHalf: true, description: "" },
      { id: crypto.randomUUID(), name: "Meia PCD", price: 50, quantity: meiaQuantity, poolId: meiaPoolId, poolName: "Meia-Entrada", requiresProof: true, isLegalHalf: true, description: "" },
      { id: crypto.randomUUID(), name: "Meia Idoso", price: 50, quantity: meiaQuantity, poolId: meiaPoolId, poolName: "Meia-Entrada", requiresProof: true, isLegalHalf: true, description: "" }
    ]

    const n = [...batches]; n[distributeBatchIdx].ticketTypes = newTypes; setBatches(n); setIsDistributeOpen(false); setTotalToDistribute("");
    toast({ title: "Distribuído!", description: "Meia-entrada configurada como estoque compartilhado (40%)." })
  }

  const addBatch = () => setBatches([...batches, { id: crypto.randomUUID(), name: `Lote ${batches.length + 1}`, description: "", startDate: "", endDate: "", ticketTypes: [{ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 50, requiresProof: false, isLegalHalf: false, description: "" }] }])
  const removeBatch = (i: number) => setBatches(batches.filter((_, idx) => idx !== i))
  const updateBatchField = (i: number, f: keyof Batch, v: any) => { const n = [...batches]; n[i] = { ...n[i], [f]: v }; setBatches(n); }
  const addTicketType = (bi: number) => { const n = [...batches]; n[bi].ticketTypes.push({ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 50, requiresProof: false, isLegalHalf: false, description: "" }); setBatches(n); }
  const removeTicketType = (bi: number, ti: number) => { const n = [...batches]; if(n[bi].ticketTypes.length > 1) { n[bi].ticketTypes.splice(ti, 1); setBatches(n); } }
  const updateTicketTypeField = (bi: number, ti: number, f: keyof TicketType, v: any) => { const n = [...batches]; n[bi].ticketTypes[ti] = { ...n[bi].ticketTypes[ti], [f]: v }; setBatches(n); }

  const calculateHalfPriceStats = (batch: Batch) => {
    const poolQuantities: Record<string, number> = {}
    const individualTotal = batch.ticketTypes.reduce((acc, t) => {
      if (t.poolId) {
        poolQuantities[t.poolId] = t.quantity
        return acc
      }
      return acc + (parseInt(t.quantity as any) || 0)
    }, 0)
    
    const poolTotal = Object.values(poolQuantities).reduce((acc, q) => acc + q, 0)
    const total = individualTotal + poolTotal

    const legalHalfTypes = batch.ticketTypes.filter(t => t.isLegalHalf)
    const legalPoolIds = new Set(legalHalfTypes.filter(t => t.poolId).map(t => t.poolId!))
    const individualLegalHalf = legalHalfTypes.filter(t => !t.poolId).reduce((acc, t) => acc + (parseInt(t.quantity as any) || 0), 0)
    const poolLegalHalf = Array.from(legalPoolIds).reduce((acc, pid) => acc + (poolQuantities[pid] || 0), 0)
    const legalHalf = individualLegalHalf + poolLegalHalf
    const percentage = total > 0 ? (legalHalf / total) * 100 : 0
    return { total, legalHalf, percentage }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !eventRef || !isAtLeastEditor) return
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    try {
      const cat = categories?.find(c => c.id === selectedCategory)
      const eventData = {
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        date: formData.get("startDate") as string, 
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory, 
        categoryName: cat?.name || "Outros",
        ticketMode, isFree: ticketMode === 'free',
        batches: batches.map(b => ({ ...b, ticketTypes: b.ticketTypes.map(t => ({ ...t, price: parseFloat(t.price as any) || 0, quantity: parseInt(t.quantity as any) || 0 })) })),
        address, image: uploadedImageUrl || event.image || "", city: address.city, updatedAt: serverTimestamp()
      }
      
      await updateDoc(eventRef, eventData)

      // Criar novas parcerias
      const newPartners = coOrganizers.filter(o => o._isNew)
      for (const org of newPartners) {
        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 24)

        const partnerRef = doc(db, 'events', eventId, 'partners', org.id)
        await setDoc(partnerRef, {
          orgId: org.id,
          orgName: org.name,
          orgUsername: org.username,
          orgAvatar: org.avatar || "",
          orgType: org.type || "Marca",
          orgVerified: org.verified || false,
          status: 'pending',
          createdAt: serverTimestamp(),
          expiresAt: expiresAt.toISOString(),
          eventTitle: eventData.title,
          inviterOrgName: currentOrg?.name || "Organização"
        })

        if (org.contactEmail) {
          await sendPartnerInvitationEmail({
            to: org.contactEmail,
            inviterOrgName: currentOrg?.name || "Organização",
            eventTitle: eventData.title
          })
        }
      }

      toast({ title: "Salvo!" }); router.push("/dashboard/projetos")
    } catch (err: any) { toast({ variant: "destructive", title: "Erro ao salvar" }) }
    finally { setSaving(false) }
  }

  if (eventLoading || orgLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/projetos"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <h1 className="text-3xl font-black italic tracking-tighter text-primary uppercase">Editar Evento</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
         <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader><CardTitle className="text-lg">Capa</CardTitle></CardHeader>
            <CardContent>
               <div className="relative aspect-video rounded-2xl bg-muted overflow-hidden cursor-pointer" onClick={() => document.getElementById('img-up')?.click()}>
                  {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : null}
                  <input id="img-up" type="file" className="hidden" onChange={handleImageChange} />
               </div>
            </CardContent>
         </Card>

         <Card className="border-none shadow-sm rounded-[2rem]">
            <CardHeader><CardTitle className="text-lg">Dados Gerais</CardTitle></CardHeader>
            <CardContent className="space-y-6">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Nome</Label><Input name="title" defaultValue={event.title} required className="rounded-xl" /></div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">{categories?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Início</Label><Input name="startDate" type="datetime-local" defaultValue={event.date} className="rounded-xl" /></div>
                  <div className="space-y-2"><Label>Término</Label><Input name="endDate" type="datetime-local" defaultValue={event.endDate} className="rounded-xl" /></div>
               </div>
               <div className="space-y-2"><Label>Descrição</Label><Textarea name="description" defaultValue={event.description} className="min-h-[100px] rounded-xl" /></div>
            </CardContent>
         </Card>

         <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-secondary" /> Localização</CardTitle></CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">CEP</Label>
                  <Input 
                    value={address.cep || ""} 
                    onChange={e => setAddress(prev => ({ ...prev, cep: e.target.value.replace(/\D/g, "").substring(0, 8) }))}
                    onBlur={handleCepBlur}
                    placeholder="00000-000" 
                    className="rounded-xl"
                  />
                </div>
                <div className="md:col-span-3 space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Logradouro</Label>
                  <Input value={address.street || ""} onChange={e => setAddress(prev => ({ ...prev, street: e.target.value }))} className="rounded-xl" />
                </div>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Número</Label>
                  <Input value={address.number || ""} onChange={e => setAddress(prev => ({ ...prev, number: e.target.value }))} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Complemento</Label>
                  <Input value={address.complement || ""} onChange={e => setAddress(prev => ({ ...prev, complement: e.target.value }))} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Bairro</Label>
                  <Input value={address.neighborhood || ""} onChange={e => setAddress(prev => ({ ...prev, neighborhood: e.target.value }))} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Cidade / UF</Label>
                  <div className="flex gap-2">
                    <Input value={address.city || ""} readOnly className="rounded-xl bg-muted/30" />
                    <Input value={address.state || ""} readOnly className="rounded-xl bg-muted/30 w-16" />
                  </div>
                </div>
             </div>
          </CardContent>
        </Card>

        {/* CO-ORGANIZADORES */}
        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5 text-secondary" /> Outros Organizadores (Parcerias)</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar marca pelo @username..." 
                  value={searchUsername}
                  onChange={(e) => setSearchUsername(e.target.value)}
                  className="pl-9 h-12 rounded-xl"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearchOrg())}
                />
              </div>
              <Button 
                type="button" 
                onClick={handleSearchOrg} 
                disabled={isSearching || !searchUsername}
                className="h-12 rounded-xl bg-secondary text-white font-bold px-6"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Adicionar
              </Button>
            </div>

            {coOrganizers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {coOrganizers.map((org) => (
                  <div key={org.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-border shadow-sm group">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border">
                        <AvatarImage src={org.avatar || org.orgAvatar} className="object-cover" />
                        <AvatarFallback className="font-bold">{(org.name || org.orgName)?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                           <span className="font-bold text-sm">{org.name || org.orgName}</span>
                           {(org.verified || org.orgVerified) && <CheckCircle2 className="w-3.5 h-3.5 text-secondary fill-secondary text-white" />}
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{org.type || org.orgType || "Marca"}</span>
                           {org.status === 'pending' && <Badge variant="outline" className="text-[7px] h-3 uppercase">Pendente</Badge>}
                        </div>
                      </div>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setOrgToDelete(org)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

         <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="text-lg">Ingressos</CardTitle>
                  <div className="bg-white p-1 rounded-xl border flex gap-1">
                    <Button type="button" variant={ticketMode === 'free' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-4" onClick={() => { setTicketMode('free'); setBatches([{ id: crypto.randomUUID(), name: "Grátis", description: "", startDate: "", endDate: "", ticketTypes: [{ id: crypto.randomUUID(), name: "Entrada Franca", price: 0, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }] }]); }}>Grátis</Button>
                    <Button type="button" variant={ticketMode === 'paid_single' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-4" onClick={() => { setTicketMode('paid_single'); setBatches([{ id: crypto.randomUUID(), name: "Único", description: "", startDate: "", endDate: "", ticketTypes: [{ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }] }]); }}>Único</Button>
                    <Button type="button" variant={ticketMode === 'batches' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-4" onClick={() => setTicketMode('batches')}>Lotes</Button>
                  </div>
               </div>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
               {batches.map((batch, bi) => {
                 const stats = calculateHalfPriceStats(batch);
                 const isFreeMode = ticketMode === 'free';
                 return (
                   <div key={batch.id} className="p-6 rounded-[1.5rem] border-2 bg-muted/10 space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="font-black italic uppercase text-secondary text-xl">{isFreeMode ? "Grátis" : batch.name}</h3>
                        <div className="flex gap-2">
                           {!isFreeMode && <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase border-secondary text-secondary gap-1.5" onClick={() => { setDistributeBatchIdx(bi); setIsDistributeOpen(true); }}><Sparkles className="w-3 h-3" /> Distribuir por Tipo</Button>}
                           {ticketMode === 'batches' && batches.length > 1 && <Button type="button" variant="ghost" size="icon" className="text-destructive rounded-full" onClick={() => removeBatch(bi)}><Trash2 className="w-4 h-4" /></Button>}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nome do Lote</Label><Input value={batch.name} onChange={e => updateBatchField(bi, 'name', e.target.value)} className="rounded-xl h-11" disabled={isFreeMode} /></div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Início das Vendas</Label><Input type="datetime-local" value={batch.startDate} onChange={e => updateBatchField(bi, 'startDate', e.target.value)} className="rounded-xl h-11 text-xs" /></div>
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Fim das Vendas</Label><Input type="datetime-local" value={batch.endDate} onChange={e => updateBatchField(bi, 'endDate', e.target.value)} className="rounded-xl h-11 text-xs" /></div>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <div className="flex items-center justify-between border-b pb-2"><h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tipos de Ingresso</h4>{!isFreeMode && <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase" onClick={() => addTicketType(bi)}>Adicionar Tipo</Button>}</div>
                         <div className="space-y-3">
                            {batch.ticketTypes.map((t, ti) => (
                              <div key={t.id} className="p-4 bg-white rounded-2xl border shadow-sm space-y-4">
                                 <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                    <div className="md:col-span-3 space-y-2">
                                       <Label className="text-[10px] font-black uppercase opacity-40">Nome</Label>
                                       <div className="flex flex-col gap-1">
                                          <Input value={t.name} onChange={e => updateTicketTypeField(bi, ti, 'name', e.target.value)} className="rounded-xl h-10 font-bold" disabled={isFreeMode} />
                                          {t.poolName && <span className="text-[8px] font-black text-secondary uppercase flex items-center gap-1"><Layers className="w-2.5 h-2.5" /> Pool: {t.poolName}</span>}
                                       </div>
                                    </div>
                                    <div className="md:col-span-3 space-y-2">
                                       <Label className="text-[10px] font-black uppercase opacity-40">Tipo/Categoria</Label>
                                       <Select 
                                         value={TICKET_CATEGORIES.find(c => c.name === t.name)?.name || "Personalizado"} 
                                         onValueChange={(val) => {
                                            const cat = TICKET_CATEGORIES.find(c => c.name === val);
                                            if (cat) {
                                              updateTicketTypeField(bi, ti, 'name', cat.name);
                                              updateTicketTypeField(bi, ti, 'isLegalHalf', cat.isLegalHalf);
                                              updateTicketTypeField(bi, ti, 'requiresProof', cat.requiresProof);
                                            }
                                         }}
                                         disabled={isFreeMode}
                                       >
                                          <SelectTrigger className="h-10 rounded-xl">
                                             <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent className="rounded-xl">
                                             {TICKET_CATEGORIES.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                                             <SelectItem value="Personalizado">Personalizado</SelectItem>
                                          </SelectContent>
                                       </Select>
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                       <Label className="text-[10px] font-black uppercase opacity-40">Qtd {t.poolId && "(Pool)"}</Label>
                                       <div className="flex flex-col gap-1">
                                          <Input type="number" value={t.quantity} onChange={e => { const val = e.target.value; if(t.poolId) { const n = [...batches]; n[bi].ticketTypes.forEach((item, idx) => { if(item.poolId === t.poolId) n[bi].ticketTypes[idx].quantity = parseInt(val as any) || 0 }); setBatches(n); } else { updateTicketTypeField(bi, ti, 'quantity', val); } }} className="rounded-xl h-10 font-black" />
                                          {t.poolId && <span className="text-[7px] font-bold text-muted-foreground uppercase text-center">Compartilhado</span>}
                                       </div>
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                       <Label className="text-[10px] font-black uppercase opacity-40">Valor (R$)</Label>
                                       <Input type="number" step="0.01" value={t.price} onChange={e => updateTicketTypeField(bi, ti, 'price', e.target.value)} className="rounded-xl h-10 font-black text-secondary" disabled={isFreeMode} />
                                    </div>
                                    <div className="md:col-span-2 flex items-center justify-end pb-1 gap-2">
                                       <div className="flex flex-col items-center gap-1">
                                          <Switch checked={t.requiresProof} onCheckedChange={v => updateTicketTypeField(bi, ti, 'requiresProof', v)} />
                                          <span className="text-[8px] font-black uppercase">Doc.</span>
                                       </div>
                                       {!isFreeMode && batch.ticketTypes.length > 1 && (
                                         <Button type="button" variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => removeTicketType(bi, ti)}>
                                            <Trash2 className="w-4 h-4" />
                                         </Button>
                                       )}
                                    </div>
                                 </div>
                              </div>
                            ))}
                         </div>
                      </div>

                      <div className={cn("p-5 bg-white rounded-3xl border space-y-4", stats.percentage < 40 ? "border-orange-200" : "border-green-200")}>
                         <div className="flex justify-between items-center">
                            <div className="space-y-1">
                               <div className="flex items-center gap-2"><Info className="w-4 h-4 text-secondary" /><h5 className="text-[10px] font-black uppercase tracking-widest text-primary">Conformidade Legal</h5></div>
                               <p className="text-[9px] text-muted-foreground font-medium">Recomenda-se 40% para Meia-Entrada Legal.</p>
                            </div>
                            <div className="text-right">
                               <p className="text-[9px] font-black uppercase opacity-40">Percentual</p>
                               <p className={cn("text-xl font-black italic", stats.percentage < 40 ? "text-orange-500" : "text-green-600")}>{stats.percentage.toFixed(1)}%</p>
                            </div>
                         </div>
                      </div>
                   </div>
                 );
               })}
               {ticketMode === 'batches' && <Button type="button" variant="outline" className="w-full h-14 rounded-2xl border-dashed font-black uppercase italic tracking-widest gap-2" onClick={addBatch}><Plus className="w-5 h-5" /> Adicionar Lote</Button>}
            </CardContent>
         </Card>

         <Button type="submit" disabled={saving} className="w-full h-16 rounded-[2rem] bg-secondary text-white font-black text-xl shadow-xl uppercase italic">
            {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
            Salvar Alterações
         </Button>
      </form>

      <Dialog open={isDistributeOpen} onOpenChange={setIsDistributeOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Distribuir Ingressos</DialogTitle>
            <DialogDescription>Defina a quantidade total deste lote. Dividiremos em Inteira (60%) e Meias Compartilhadas (40%).</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Quantidade Total do Lote</Label>
              <Input type="number" placeholder="Ex: 200" value={totalToDistribute} onChange={e => setTotalToDistribute(e.target.value)} className="h-14 text-2xl font-black rounded-xl text-center" />
            </div>
            <p className="text-[10px] text-muted-foreground text-center font-medium italic">
              Ao distribuir 200 ingressos: 120 serão Inteiras e 80 serão divididos entre as Meias (Estudante, PCD, Idoso).
            </p>
          </div>
          <DialogFooter><Button onClick={handleDistribute} className="w-full bg-secondary text-white font-black h-12 rounded-xl shadow-lg uppercase italic">Confirmar Distribuição</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!orgToDelete} onOpenChange={(open) => !open && setOrgToDelete(null)}>
        <AlertDialogContent className="rounded-[2rem]">
           <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter">Remover Co-organizador?</AlertDialogTitle>
              <AlertDialogDescription>
                 A organização <strong>{orgToDelete?.name || orgToDelete?.orgName}</strong> deixará de figurar como parceira deste evento. Convites pendentes serão invalidados.
              </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px] tracking-widest">Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleRemoveOrganizer}
                className="bg-destructive text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-destructive/90"
              >
                Confirmar Remoção
              </AlertDialogAction>
           </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}