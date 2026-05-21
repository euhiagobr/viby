
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useFirestore, useAuth, useUser, useFirebaseApp, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { updateDoc, doc, collection, serverTimestamp } from "firebase/firestore"
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
  Ticket
} from "lucide-react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { cn } from "@/lib/utils"

interface TicketType {
  id: string
  name: string
  price: number
  quantity: number
  requiresProof: boolean
  isLegalHalf: boolean
  description: string
}

interface Batch {
  id: string
  name: string
  description: string
  startDate: string
  endDate: string
  ticketTypes: TicketType[]
}

const DEFAULT_TICKET_TYPES = [
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

  const sortedCategories = React.useMemo(() => {
    if (!categories) return []
    return [...categories].sort((a, b) => a.name.localeCompare(b.name))
  }, [categories])

  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  
  const [selectedCategory, setSelectedCategory] = useState("")
  const [tags, setTags] = useState("")
  
  const [ticketMode, setTicketMode] = useState<'free' | 'paid_single' | 'batches'>('free')
  const [batches, setBatches] = useState<Batch[]>([])

  const [cep, setCep] = useState("")
  const [address, setAddress] = useState({
    street: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "Brasil",
    number: "",
    complement: ""
  })
  const [coords, setCoords] = useState({ lat: "", lng: "" })
  const [isGeocoding, setIsGeocoding] = useState(false)

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

  useEffect(() => {
    if (event) {
      setSelectedCategory(event.categoryId || event.category || "")
      setTags(event.tags?.join(", ") || "")
      setTicketMode(event.ticketMode || (event.isFree ? 'free' : 'batches'))
      
      if (event.batches && Array.isArray(event.batches)) {
        setBatches(event.batches.map((b: any) => ({
          id: b.id || crypto.randomUUID(),
          name: b.name || "",
          description: b.description || "",
          startDate: b.startDate || "",
          endDate: b.endDate || "",
          ticketTypes: (b.ticketTypes || []).map((t: any) => ({
            id: t.id || crypto.randomUUID(),
            name: t.name || "",
            price: t.price || 0,
            quantity: t.quantity || b.available || 0,
            requiresProof: t.requiresProof || false,
            isLegalHalf: t.isLegalHalf || false,
            description: t.description || ""
          }))
        })))
      }
      
      setCep(event.cep || "")
      setAddress(event.address || { street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "" })
      setCoords({ lat: event.latitude?.toString() || "", lng: event.longitude?.toString() || "" })
      setImagePreview(event.image || null)
      setUploadedImageUrl(event.image || null)
    }
  }, [event])

  useEffect(() => {
    if (!orgLoading && (!currentOrg || !isAtLeastEditor)) {
      toast({ variant: "destructive", title: "Acesso Restrito" })
      router.push("/dashboard/projetos")
    }
  }, [currentOrg, isAtLeastEditor, orgLoading, router])

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
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setUploadedImageUrl(downloadURL);
        setUploadProgress(null);
        toast({ title: "Imagem carregada!" });
      })
    } catch (err) { setUploadProgress(null) }
  }

  const handleCepBlur = async () => {
    const cleanCep = cep.replace(/\D/g, "")
    if (cleanCep.length !== 8) return
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await response.json()
      if (!data.erro) {
        setAddress(prev => ({ ...prev, street: data.logradouro || "", neighborhood: data.bairro || "", city: data.localidade || "", state: data.uf || "" }))
      }
    } catch (e) {}
  }

  const geocodeAddress = async () => {
    if (!address.street || !address.city || !address.number) return;
    setIsGeocoding(true);
    const q = `${address.street}, ${address.number}, ${address.neighborhood}, ${address.city}, ${address.state}, Brasil`;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
      const data = await res.json();
      if (data?.[0]) setCoords({ lat: data[0].lat, lng: data[0].lon });
    } catch (e) {} finally { setIsGeocoding(false); }
  }

  const addBatch = () => setBatches([...batches, { id: crypto.randomUUID(), name: `Lote ${batches.length + 1}`, description: "", startDate: "", endDate: "", ticketTypes: [{ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 50, requiresProof: false, isLegalHalf: false, description: "" }] }])
  const removeBatch = (i: number) => setBatches(batches.filter((_, idx) => idx !== i))
  const updateBatchField = (i: number, f: keyof Batch, v: any) => { const n = [...batches]; n[i] = { ...n[i], [f]: v }; setBatches(n); }
  
  const addTicketType = (bi: number) => { const n = [...batches]; n[bi].ticketTypes.push({ id: crypto.randomUUID(), name: "Novo Tipo", price: 0, quantity: 0, requiresProof: false, isLegalHalf: false, description: "" }); setBatches(n); }
  const removeTicketType = (bi: number, ti: number) => { const n = [...batches]; if(n[bi].ticketTypes.length > 1) { n[bi].ticketTypes.splice(ti, 1); setBatches(n); } }
  const updateTicketTypeField = (bi: number, ti: number, f: keyof TicketType, v: any) => { const n = [...batches]; n[bi].ticketTypes[ti] = { ...n[bi].ticketTypes[ti], [f]: v }; setBatches(n); }

  const calculateHalfPriceStats = (batch: Batch) => {
    const total = batch.ticketTypes.reduce((acc, t) => acc + (parseInt(t.quantity as any) || 0), 0)
    const legalHalf = batch.ticketTypes.filter(t => t.isLegalHalf).reduce((acc, t) => acc + (parseInt(t.quantity as any) || 0), 0)
    const percentage = total > 0 ? (legalHalf / total) * 100 : 0
    return { total, legalHalf, percentage }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !eventRef || !currentOrg || !isAtLeastEditor) return
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    const cat = categories?.find(c => c.id === selectedCategory)
    try {
      await updateDoc(eventRef, {
        title: formData.get("title") as string,
        shortDescription: formData.get("shortDescription") as string,
        description: formData.get("description") as string,
        date: formData.get("startDate") as string, 
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory,
        categoryName: cat?.name || "Outros",
        tags: tags.split(",").map(t => t.trim()).filter(t => t !== ""),
        ticketMode: ticketMode,
        isFree: ticketMode === 'free',
        batches: batches.map(b => ({ 
          ...b, 
          totalCapacity: b.ticketTypes.reduce((acc, t) => acc + (parseInt(t.quantity as any) || 0), 0), 
          ticketTypes: b.ticketTypes.map(t => ({ ...t, price: parseFloat(t.price as any) || 0, quantity: parseInt(t.quantity as any) || 0 })) 
        })),
        cep, address, latitude: parseFloat(coords.lat) || 0, longitude: parseFloat(coords.lng) || 0,
        image: uploadedImageUrl || event.image || "", city: address.city,
        updatedAt: serverTimestamp()
      })
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
            <CardHeader><CardTitle className="text-lg">Capa do Evento</CardTitle></CardHeader>
            <CardContent>
               <div className="relative aspect-video rounded-2xl bg-muted overflow-hidden cursor-pointer" onClick={() => document.getElementById('img-up')?.click()}>
                  {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : null}
                  <input id="img-up" type="file" className="hidden" onChange={handleImageChange} />
               </div>
               {uploadProgress !== null && <Progress value={uploadProgress} className="h-1 mt-4" />}
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
                      <SelectContent className="rounded-xl">{sortedCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Início</Label><Input name="startDate" type="datetime-local" defaultValue={event.date} className="rounded-xl" /></div>
                  <div className="space-y-2"><Label>Término</Label><Input name="endDate" type="datetime-local" defaultValue={event.endDate} className="rounded-xl" /></div>
               </div>
               <div className="space-y-2"><Label>Descrição Curta</Label><Input name="shortDescription" defaultValue={event.shortDescription} className="rounded-xl" /></div>
               <div className="space-y-2"><Label>Descrição Completa</Label><Textarea name="description" defaultValue={event.description} className="min-h-[100px] rounded-xl" /></div>
            </CardContent>
         </Card>

         <Card className="border-none shadow-sm rounded-[2rem]">
            <CardHeader><CardTitle className="text-lg">Localização</CardTitle></CardHeader>
            <CardContent className="space-y-6">
               <div className="grid grid-cols-4 gap-6">
                  <div className="space-y-2"><Label>CEP</Label><Input value={cep} onChange={e => setCep(e.target.value)} onBlur={handleCepBlur} className="rounded-xl" /></div>
                  <div className="col-span-3 space-y-2"><Label>Rua</Label><Input value={address.street} onChange={e => setAddress({...address, street: e.target.value})} onBlur={geocodeAddress} className="rounded-xl" /></div>
               </div>
               <div className="grid grid-cols-4 gap-6">
                  <div className="space-y-2"><Label>Nº</Label><Input value={address.number} onChange={e => setAddress({...address, number: e.target.value})} onBlur={geocodeAddress} className="rounded-xl" /></div>
                  <div className="space-y-2"><Label>Bairro</Label><Input value={address.neighborhood} onChange={e => setAddress({...address, neighborhood: e.target.value})} className="rounded-xl" /></div>
                  <div className="space-y-2"><Label>Cidade</Label><Input value={address.city} readOnly className="bg-muted rounded-xl" /></div>
                  <div className="space-y-2"><Label>UF</Label><Input value={address.state} readOnly className="bg-muted rounded-xl" /></div>
               </div>
            </CardContent>
         </Card>

         <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="text-lg">Configuração de Ingressos</CardTitle>
                  <div className="bg-white p-1 rounded-xl border flex gap-1">
                    <Button 
                      type="button" 
                      variant={ticketMode === 'free' ? 'secondary' : 'ghost'} 
                      size="sm" 
                      className="text-[10px] font-black uppercase px-4" 
                      onClick={() => {
                        setTicketMode('free');
                        setBatches([{ 
                          id: crypto.randomUUID(), 
                          name: "Grátis", 
                          description: "", 
                          startDate: "", 
                          endDate: "", 
                          ticketTypes: [{ id: crypto.randomUUID(), name: "Entrada Franca", price: 0, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }] 
                        }]);
                      }}
                    >Grátis</Button>
                    <Button 
                      type="button" 
                      variant={ticketMode === 'paid_single' ? 'secondary' : 'ghost'} 
                      size="sm" 
                      className="text-[10px] font-black uppercase px-4" 
                      onClick={() => {
                        setTicketMode('paid_single');
                        setBatches([{ 
                          id: crypto.randomUUID(), 
                          name: "Ingresso Único", 
                          description: "", 
                          startDate: "", 
                          endDate: "", 
                          ticketTypes: [{ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }] 
                        }]);
                      }}
                    >Único Pago</Button>
                    <Button 
                      type="button" 
                      variant={ticketMode === 'batches' ? 'secondary' : 'ghost'} 
                      size="sm" 
                      className="text-[10px] font-black uppercase px-4" 
                      onClick={() => setTicketMode('batches')}
                    >Lotes</Button>
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
                        <div className="space-y-1">
                           <h3 className="font-black italic uppercase text-secondary tracking-tighter text-xl">{isFreeMode ? "Grátis" : batch.name}</h3>
                        </div>
                        {ticketMode === 'batches' && batches.length > 1 && <Button type="button" variant="ghost" size="icon" className="text-destructive rounded-full" onClick={() => removeBatch(bi)}><Trash2 className="w-4 h-4" /></Button>}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase opacity-60">Nome do Lote / Ingresso</Label>
                            <Input 
                              value={isFreeMode ? "Grátis" : batch.name} 
                              onChange={e => updateBatchField(bi, 'name', e.target.value)} 
                              className="rounded-xl h-11" 
                              disabled={isFreeMode}
                            />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label className="text-[10px] uppercase font-black opacity-40">Início Vendas</Label><Input type="datetime-local" value={batch.startDate} onChange={e => updateBatchField(bi, 'startDate', e.target.value)} className="rounded-xl h-11 text-xs" /></div>
                            <div className="space-y-2"><Label className="text-[10px] uppercase font-black opacity-40">Fim Vendas</Label><Input type="datetime-local" value={batch.endDate} onChange={e => updateBatchField(bi, 'endDate', e.target.value)} className="rounded-xl h-11 text-xs" /></div>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <div className="flex items-center justify-between border-b pb-2 mb-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tipos de Ingresso</h4>
                            {!isFreeMode && (
                              <div className="flex gap-2">
                                <Select onValueChange={(v) => {
                                  const preset = DEFAULT_TICKET_TYPES.find(p => p.name === v);
                                  if (preset) {
                                    const newTypes = [...batch.ticketTypes, { id: crypto.randomUUID(), name: preset.name, price: 0, quantity: 0, requiresProof: preset.requiresProof, isLegalHalf: preset.isLegalHalf, description: "" }];
                                    updateBatchField(bi, 'ticketTypes', newTypes);
                                  }
                                }}>
                                    <SelectTrigger className="h-8 rounded-lg text-[10px] font-black uppercase border-dashed w-40"><SelectValue placeholder="Presets de Tipos" /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                      {DEFAULT_TICKET_TYPES.map(p => <SelectItem key={p.name} value={p.name} className="text-xs font-bold">{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase border-dashed" onClick={() => addTicketType(bi)}>Adicionar Personalizado</Button>
                              </div>
                            )}
                         </div>
                         <div className="space-y-3">
                            {batch.ticketTypes.map((t, ti) => (
                              <div key={t.id} className="p-4 bg-white rounded-2xl border shadow-sm space-y-4 group">
                                 <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                    <div className="md:col-span-4 space-y-2">
                                       <Label className="text-[10px] font-black uppercase opacity-40">Nome do Tipo</Label>
                                       <Input value={t.name} onChange={e => updateTicketTypeField(bi, ti, 'name', e.target.value)} className="rounded-xl h-10 font-bold" />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                       <Label className="text-[10px] font-black uppercase opacity-40">Qtd</Label>
                                       <Input type="number" value={t.quantity} onChange={e => updateTicketTypeField(bi, ti, 'quantity', e.target.value)} className="rounded-xl h-10 font-black" />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                       <Label className="text-[10px] font-black uppercase opacity-40">Valor (R$)</Label>
                                       <Input 
                                          type="number" 
                                          step="0.01" 
                                          value={t.price} 
                                          onChange={e => updateTicketTypeField(bi, ti, 'price', e.target.value)} 
                                          className="w-full rounded-xl h-10 font-black text-secondary" 
                                          disabled={isFreeMode} 
                                       />
                                    </div>
                                    <div className="md:col-span-3 flex items-center justify-around pb-2">
                                      <div className="flex flex-col items-center gap-1">
                                        <Switch checked={t.isLegalHalf} onCheckedChange={v => updateTicketTypeField(bi, ti, 'isLegalHalf', v)} disabled={isFreeMode} />
                                        <span className="text-[8px] font-black uppercase">Meia-Entrada</span>
                                      </div>
                                      <div className="flex flex-col items-center gap-1">
                                        <Switch checked={t.requiresProof} onCheckedChange={v => updateTicketTypeField(bi, ti, 'requiresProof', v)} />
                                        <span className="text-[8px] font-black uppercase">Doc. Obrigatório</span>
                                      </div>
                                    </div>
                                    <div className="md:col-span-1 flex justify-end pb-1">
                                      {!isFreeMode && batch.ticketTypes.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" className="text-destructive rounded-full hover:bg-destructive/10" onClick={() => removeTicketType(bi, ti)}><Trash2 className="w-4 h-4" /></Button>
                                      )}
                                    </div>
                                 </div>
                              </div>
                            ))}
                         </div>
                      </div>

                      <div className={cn("p-5 bg-white rounded-3xl border shadow-inner space-y-4", stats.percentage < 40 ? "border-orange-200" : "border-green-200")}>
                         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                               <div className="flex items-center gap-2">
                                  <Info className="w-4 h-4 text-secondary" />
                                  <h5 className="text-[10px] font-black uppercase tracking-widest text-primary">Conformidade Legal</h5>
                               </div>
                               <p className="text-[9px] text-muted-foreground font-medium leading-tight">Lei Federal nº 12.933/2013 recomenda reserva de 40% para Meia-Entrada.</p>
                            </div>
                            <div className="flex items-center gap-3">
                               <div className="text-right">
                                  <p className="text-[9px] font-black uppercase opacity-40">Percentual</p>
                                  <p className={cn("text-xl font-black italic", stats.percentage < 40 ? "text-orange-500" : "text-green-600")}>{stats.percentage.toFixed(1)}%</p>
                               </div>
                               <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shadow-lg", stats.percentage < 40 ? "bg-orange-500 text-white" : "bg-green-600 text-white")}>
                                  {stats.percentage < 40 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                               </div>
                            </div>
                         </div>
                         {stats.percentage < 40 && (
                           <div className="p-3 rounded-xl bg-orange-50 border border-orange-100 flex gap-2 items-start">
                              <AlertTriangle className="w-3 h-3 text-orange-600 shrink-0 mt-0.5" />
                              <p className="text-[9px] text-orange-800 font-bold uppercase leading-relaxed">
                                 Este lote possui apenas {stats.legalHalf} ingressos de meia-entrada recomendada.
                              </p>
                           </div>
                         )}
                      </div>
                   </div>
                 );
               })}
               {ticketMode === 'batches' && <Button type="button" variant="outline" className="w-full h-14 rounded-2xl border-dashed font-black uppercase italic tracking-widest gap-2 hover:bg-secondary/5 transition-all" onClick={addBatch}><Plus className="w-5 h-5" /> Adicionar Novo Lote</Button>}
            </CardContent>
         </Card>

         <Button type="submit" disabled={saving} className="w-full h-16 rounded-[2rem] bg-secondary text-white font-black text-xl shadow-xl shadow-secondary/20 uppercase italic transition-all hover:scale-[1.02]">
            {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
            Salvar Alterações
         </Button>
      </form>
    </div>
  )
}
