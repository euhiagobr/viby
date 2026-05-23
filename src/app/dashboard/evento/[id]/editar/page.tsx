
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useFirebaseApp, useCollection, useMemoFirebase } from "@/firebase"
import { updateDoc, doc, collection, serverTimestamp, getDoc, setDoc, deleteDoc, query, where, getDocs, deleteField } from "firebase/firestore"
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
  Info,
  Ticket,
  Sparkles,
  Layers,
  Users,
  AtSign,
  X,
  CheckCircle2,
  Camera,
  XCircle,
  Map as MapIcon,
  Armchair,
  Grid3X3,
  Layout
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
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

export default function EditarEventoPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg, userRole, loading: orgLoading, refreshOrg } = useCurrentOrganization()

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
  const [noTickets, setNoTickets] = useState(false)
  const [ticketMode, setTicketMode] = useState<'free' | 'paid_single' | 'batches' | 'map'>('free')
  const [batches, setBatches] = useState<Batch[]>([])
  
  const [palcoNome, setPalcoNome] = useState("PALCO PRINCIPAL")
  const [address, setAddress] = useState({ street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "" })
  
  const [coOrganizers, setCoOrganizers] = useState<any[]>([])
  const [searchUsername, setSearchUsername] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [orgToDelete, setOrgToDelete] = useState<any | null>(null)

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

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
    if (event && categories && categories.length > 0) {
      if (event.categoryId && categories.some(c => c.id === event.categoryId)) {
        setSelectedCategory(event.categoryId);
      } else {
        const catName = event.categoryName || event.category;
        if (catName) {
          const matched = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
          if (matched) setSelectedCategory(matched.id);
        }
      }

      setNoTickets(event.noTickets || false)
      setTicketMode(event.ticketMode || (event.possuiMapa ? 'map' : (event.isFree ? 'free' : 'batches')))
      setBatches(event.batches || [])
      setPalcoNome(event.palcoNome || "PALCO PRINCIPAL")
      setAddress(event.address || { street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "" })
      setImagePreview(event.image || null)
      setUploadedImageUrl(event.image || null)
    }
  }, [event, categories])

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return
    setImagePreview(URL.createObjectURL(file))
    setUploadProgress(0)
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      const storageRef = ref(storage, `events/${user.uid}/${fileName}`)
      const uploadTask = uploadBytesResumable(storageRef, file)
      uploadTask.on('state_changed', 
        (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), 
        () => setUploadProgress(null), 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setUploadedImageUrl(downloadURL); setUploadProgress(null)
        }
      )
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
    if (usernameInput === currentOrg.username) return
    setIsSearching(true)
    try {
      const usernameRef = doc(db, 'usernames', usernameInput)
      const usernameSnap = await getDoc(usernameRef)
      if (!usernameSnap.exists() || usernameSnap.data().type !== 'organization') throw new Error("Não encontrado")
      const orgSnap = await getDoc(doc(db, 'organizations', usernameSnap.data().uid))
      if (orgSnap.exists()) setCoOrganizers(prev => [...prev, { id: orgSnap.id, ...orgSnap.data(), _isNew: true }])
      setSearchUsername("")
    } catch (error: any) { toast({ variant: "destructive", title: "Busca falhou" }) }
    finally { setIsSearching(false) }
  }

  const handleRemoveOrganizer = async () => {
    if (!orgToDelete) return
    const orgId = orgToDelete.id
    if (!orgToDelete._isNew && db && eventId) {
      try {
        await deleteDoc(doc(db, 'events', eventId, 'partners', orgId))
      } catch (e) { return; }
    }
    setCoOrganizers(coOrganizers.filter(o => o.id !== orgId)); setOrgToDelete(null);
  }

  const addBatch = () => setBatches([...batches, { id: crypto.randomUUID(), name: `Lote ${batches.length + 1}`, description: "", startDate: "", endDate: "", ticketTypes: [{ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 50, requiresProof: false, isLegalHalf: false, description: "" }] }])
  const removeBatch = (i: number) => setBatches(batches.filter((_, idx) => idx !== i))
  const updateBatchField = (i: number, f: keyof Batch, v: any) => { const n = [...batches]; n[i] = { ...n[i], [f]: v }; setBatches(n); }
  const addTicketType = (bi: number) => { const n = [...batches]; n[bi].ticketTypes.push({ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 50, requiresProof: false, isLegalHalf: false, description: "" }); setBatches(n); }
  const removeTicketType = (bi: number, ti: number) => { const n = [...batches]; if(n[bi].ticketTypes.length > 1) { n[bi].ticketTypes.splice(ti, 1); setBatches(n); } }
  const updateTicketTypeField = (bi: number, ti: number, f: keyof TicketType, v: any) => { const n = [...batches]; n[bi].ticketTypes[ti] = { ...n[bi].ticketTypes[ti], [f]: v }; setBatches(n); }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !eventRef || !isAtLeastEditor || !currentOrg) return
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    try {
      const cat = categories?.find(c => c.id === selectedCategory)
      const eventData: any = {
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        date: formData.get("startDate") as string, 
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory, 
        categoryName: cat?.name || "Outros",
        noTickets,
        ticketMode: noTickets ? 'none' : ticketMode,
        isFree: noTickets ? true : (ticketMode === 'free'),
        possuiMapa: ticketMode === 'map',
        palcoNome: ticketMode === 'map' ? palcoNome : null,
        address, image: uploadedImageUrl || event.image || "", city: address.city, 
        updatedAt: serverTimestamp(),
        organizationId: currentOrg.id,
        organizer: {
          id: currentOrg.id, name: currentOrg.name, username: currentOrg.username, avatar: currentOrg.avatar || "", isVerified: currentOrg.verified || false
        }
      }

      if (ticketMode !== 'map') {
        eventData.batches = noTickets ? [] : batches.map(b => ({ ...b, ticketTypes: b.ticketTypes.map(t => ({ ...t, price: parseFloat(t.price as any) || 0, quantity: parseInt(t.quantity as any) || 0 })) }));
      }
      
      await updateDoc(eventRef, eventData)

      for (const org of coOrganizers.filter(o => o._isNew)) {
        const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 24);
        await setDoc(doc(db, 'events', eventId, 'partners', org.id), {
          orgId: org.id, orgName: org.name, orgUsername: org.username, orgAvatar: org.avatar || "", orgType: org.type || "Marca", orgVerified: org.verified || false, status: 'pending', createdAt: serverTimestamp(), expiresAt: expiresAt.toISOString(), eventTitle: eventData.title, inviterOrgName: currentOrg.name
        });
        if (org.contactEmail) await sendPartnerInvitationEmail({ to: org.contactEmail, inviterOrgName: currentOrg.name, eventTitle: eventData.title });
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
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="w-5 h-5 text-secondary" /> Capa</CardTitle></CardHeader>
            <CardContent>
               <div className="relative aspect-video rounded-2xl bg-muted overflow-hidden cursor-pointer" onClick={() => document.getElementById('img-up')?.click()}>
                  {imagePreview ? <Image src={imagePreview} alt="Capa" fill className="object-cover" unoptimized /> : null}
                  <input id="img-up" type="file" className="hidden" onChange={handleImageChange} />
               </div>
            </CardContent>
         </Card>

         <Card className="border-none shadow-sm rounded-[2rem]">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5 text-secondary" /> Dados Gerais</CardTitle></CardHeader>
            <CardContent className="space-y-6">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Nome</Label><Input name="title" defaultValue={event.title} required className="rounded-xl h-11" /></div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent className="rounded-xl">{categories?.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Início</Label><Input name="startDate" type="datetime-local" defaultValue={event.date} className="rounded-xl" /></div>
                  <div className="space-y-2"><Label>Término</Label><Input name="endDate" type="datetime-local" defaultValue={event.endDate} className="rounded-xl" /></div>
               </div>
               <div className="space-y-2"><Label>Descrição</Label><Textarea name="description" defaultValue={event.description} className="min-h-[150px] rounded-xl border-dashed border-secondary/30" /></div>
            </CardContent>
         </Card>

         <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-secondary" /> Localização</CardTitle></CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">CEP</Label><Input value={address.cep} onChange={e => setAddress(prev => ({ ...prev, cep: e.target.value.replace(/\D/g, "").substring(0, 8) }))} onBlur={handleCepBlur} className="rounded-xl h-11" /></div>
                <div className="md:col-span-3 space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Logradouro</Label><Input value={address.street} onChange={e => setAddress(prev => ({ ...prev, street: e.target.value }))} className="rounded-xl h-11" /></div>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Número</Label><Input value={address.number} onChange={e => setAddress(prev => ({ ...prev, number: e.target.value }))} className="rounded-xl h-11" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Bairro</Label><Input value={address.neighborhood} onChange={e => setAddress(prev => ({ ...prev, neighborhood: e.target.value }))} className="rounded-xl h-11" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cidade / UF</Label><div className="flex gap-2"><Input value={address.city} readOnly className="rounded-xl h-11 bg-muted/30" /><Input value={address.state} readOnly className="rounded-xl h-11 bg-muted/30 w-16" /></div></div>
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria</CardTitle>
                <div className="flex items-center gap-2"><Switch checked={noTickets} onCheckedChange={setNoTickets} /><Label className="text-xs font-bold text-muted-foreground uppercase">Sem Ingressos</Label></div>
              </div>
              {!noTickets && (
                <div className="bg-white p-1 rounded-xl border flex gap-1">
                  <Button type="button" variant={ticketMode === 'free' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-4" onClick={() => setTicketMode('free')}>Grátis</Button>
                  <Button type="button" variant={ticketMode === 'paid_single' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-4" onClick={() => setTicketMode('paid_single')}>Único</Button>
                  <Button type="button" variant={ticketMode === 'batches' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-4" onClick={() => setTicketMode('batches')}>Lotes</Button>
                  <Button type="button" variant={ticketMode === 'map' ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-4" onClick={() => setTicketMode('map')}>Mapa</Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
             {noTickets ? <div className="py-12 text-center opacity-30"><XCircle className="w-10 h-10 mx-auto mb-2" /><p className="text-sm font-bold uppercase tracking-widest">Vendas Desativadas</p></div> : 
             ticketMode === 'map' ? (
               <div className="space-y-4 text-center py-8">
                  <MapIcon className="w-12 h-12 mx-auto text-secondary" />
                  <div className="space-y-2">
                     <p className="font-bold text-sm">Este evento utiliza Mapa de Ingressos.</p>
                     <p className="text-xs text-muted-foreground">Utilize o painel dedicado para gerenciar setores, assentos e mesas.</p>
                  </div>
                  <Button variant="outline" asChild className="rounded-xl border-secondary text-secondary"><Link href={`/dashboard/evento/${eventId}/mapa`}>Gerenciar Mapa de Ingressos</Link></Button>
               </div>
             ) : (
               <React.Fragment>
                 {batches.map((batch, bi) => (
                   <div key={batch.id} className="p-6 rounded-[1.5rem] border-2 bg-muted/10 space-y-6">
                      <div className="flex justify-between items-center"><h3 className="font-black italic uppercase text-secondary text-xl">{batch.name}</h3><Button type="button" variant="ghost" size="icon" className="text-destructive rounded-full" onClick={() => removeBatch(bi)}><Trash2 className="w-4 h-4" /></Button></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Lote</Label><Input value={batch.name} onChange={e => updateBatchField(bi, 'name', e.target.value)} className="rounded-xl h-11" /></div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Início</Label><Input type="datetime-local" value={batch.startDate} onChange={e => updateBatchField(bi, 'startDate', e.target.value)} className="rounded-xl h-11 text-xs" /></div>
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Fim</Label><Input type="datetime-local" value={batch.endDate} onChange={e => updateBatchField(bi, 'endDate', e.target.value)} className="rounded-xl h-11 text-xs" /></div>
                         </div>
                      </div>
                      <div className="space-y-4">
                         {batch.ticketTypes.map((t, ti) => (
                           <div key={t.id} className="p-4 bg-white rounded-2xl border shadow-sm grid grid-cols-12 gap-4 items-end">
                              <div className="col-span-4 space-y-2"><Label className="text-[9px] uppercase font-black opacity-40">Tipo</Label><Input value={t.name} onChange={e => updateTicketTypeField(bi, ti, 'name', e.target.value)} className="rounded-xl h-10 font-bold" /></div>
                              <div className="col-span-3 space-y-2"><Label className="text-[9px] uppercase font-black opacity-40">Qtd</Label><Input type="number" value={t.quantity} onChange={e => updateTicketTypeField(bi, ti, 'quantity', e.target.value)} className="rounded-xl h-10 font-black" /></div>
                              <div className="col-span-3 space-y-2"><Label className="text-[9px] uppercase font-black opacity-40">R$</Label><Input type="number" step="0.01" value={t.price} onChange={e => updateTicketTypeField(bi, ti, 'price', e.target.value)} className="rounded-xl h-10 font-black text-secondary" disabled={ticketMode === 'free'} /></div>
                              <div className="col-span-2 flex justify-end pb-1"><Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeTicketType(bi, ti)} disabled={batch.ticketTypes.length === 1}><Trash2 className="w-4 h-4" /></Button></div>
                           </div>
                         ))}
                         <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase" onClick={() => addTicketType(bi)}>Adicionar Tipo</Button>
                      </div>
                   </div>
                 ))}
                 {(ticketMode === 'batches' || ticketMode === 'paid_single' || ticketMode === 'free') && <Button type="button" variant="outline" className="w-full h-14 rounded-2xl border-dashed font-black uppercase italic" onClick={addBatch}><Plus className="w-5 h-5 mr-2" /> Adicionar Lote</Button>}
               </React.Fragment>
             )}
          </CardContent>
        </Card>

         <Button type="submit" disabled={saving} className="w-full h-16 rounded-[2rem] bg-secondary text-white font-black text-xl shadow-xl uppercase italic hover:scale-[1.02] transition-transform">
            {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
            Salvar Evento
         </Button>
      </form>
    </div>
  )
}
