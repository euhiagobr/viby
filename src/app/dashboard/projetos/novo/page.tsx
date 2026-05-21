
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useFirebaseApp, useCollection, useMemoFirebase } from "@/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
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
  Clock,
  Building2,
  AlertTriangle,
  Info,
  CheckCircle2,
  Ticket,
  ChevronDown
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"

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

export default function NovoEventoPage() {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg, userRole, loading: orgLoading } = useCurrentOrganization()

  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app, "gs://viby");
  }, [app])

  const categoriesQuery = useMemoFirebase(() => db ? collection(db, "categories") : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const sortedCategories = React.useMemo(() => {
    if (!categories) return []
    return [...categories].sort((a, b) => a.name.localeCompare(b.name))
  }, [categories])

  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  
  const [selectedCategory, setSelectedCategory] = useState("")
  const [tags, setTags] = useState("")
  
  const [ticketMode, setTicketMode] = useState<'free' | 'paid_single' | 'batches'>('free')
  const [batches, setBatches] = useState<Batch[]>([
    { 
      id: crypto.randomUUID(),
      name: "Lote Gratuito", 
      description: "", 
      startDate: "", 
      endDate: "", 
      ticketTypes: [
        { id: crypto.randomUUID(), name: "Entrada Franca", price: 0, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }
      ] 
    }
  ])

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
    if (!orgLoading && (!currentOrg || !isAtLeastEditor)) {
      toast({
        variant: "destructive",
        title: "Acesso Restrito",
        description: "Selecione uma organização onde você seja Editor para publicar eventos."
      })
      router.push("/dashboard/organizacoes")
    }
  }, [currentOrg, isAtLeastEditor, orgLoading, router])

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return

    setImagePreview(URL.createObjectURL(file))
    setUploadProgress(0)

    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      const storagePath = `events/${user.uid}/${fileName}`
      const storageRef = ref(storage, storagePath)
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100), 
        (error: any) => {
          setUploadProgress(null)
          toast({ variant: "destructive", title: "Erro no upload" })
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setUploadedImageUrl(downloadURL)
          setUploadProgress(null)
          toast({ title: "Imagem carregada!" })
        }
      )
    } catch (err: any) {
      setUploadProgress(null)
      toast({ variant: "destructive", title: "Erro no upload", description: err.message })
    }
  }

  const geocodeAddress = async () => {
    if (!address.street || !address.city || !address.number) return;
    setIsGeocoding(true);
    const queryStr = `${address.street}, ${address.number}, ${address.neighborhood}, ${address.city}, ${address.state}, Brasil`;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}&limit=1`);
      const data = await response.json();
      if (data && data[0]) {
        setCoords({ lat: data[0].lat, lng: data[0].lon });
      }
    } catch (e) {
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleCepBlur = async () => {
    const cleanCep = cep.replace(/\D/g, "")
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

  const addBatch = () => {
    setBatches([...batches, { 
      id: crypto.randomUUID(),
      name: `Lote ${batches.length + 1}`, 
      description: "", 
      startDate: "", 
      endDate: "", 
      ticketTypes: [
        { id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 50, requiresProof: false, isLegalHalf: false, description: "" }
      ] 
    }])
  }

  const removeBatch = (index: number) => {
    if (batches.length > 1) {
      setBatches(batches.filter((_, i) => i !== index))
    }
  }

  const addTicketType = (batchIndex: number) => {
    const newBatches = [...batches]
    newBatches[batchIndex].ticketTypes.push({
      id: crypto.randomUUID(),
      name: "Novo Tipo",
      price: 0,
      quantity: 0,
      requiresProof: false,
      isLegalHalf: false,
      description: ""
    })
    setBatches(newBatches)
  }

  const removeTicketType = (batchIndex: number, typeIndex: number) => {
    const newBatches = [...batches]
    if (newBatches[batchIndex].ticketTypes.length > 1) {
      newBatches[batchIndex].ticketTypes.splice(typeIndex, 1)
      setBatches(newBatches)
    }
  }

  const updateBatchField = (index: number, field: keyof Batch, value: any) => {
    const newBatches = [...batches]
    newBatches[index] = { ...newBatches[index], [field]: value }
    setBatches(newBatches)
  }

  const updateTicketTypeField = (batchIndex: number, typeIndex: number, field: keyof TicketType, value: any) => {
    const newBatches = [...batches]
    newBatches[batchIndex].ticketTypes[typeIndex] = { ...newBatches[batchIndex].ticketTypes[typeIndex], [field]: value }
    setBatches(newBatches)
  }

  const calculateHalfPriceStats = (batch: Batch) => {
    const total = batch.ticketTypes.reduce((acc, t) => acc + (parseInt(t.quantity as any) || 0), 0)
    const legalHalf = batch.ticketTypes.filter(t => t.isLegalHalf).reduce((acc, t) => acc + (parseInt(t.quantity as any) || 0), 0)
    const percentage = total > 0 ? (legalHalf / total) * 100 : 0
    return { total, legalHalf, percentage }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !currentOrg || !isAtLeastEditor) return
    if (!selectedCategory) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione uma categoria." })
      return
    }

    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const currentCategory = categories?.find(c => c.id === selectedCategory);
    
    try {
      const eventData = {
        title: formData.get("title") as string,
        shortDescription: formData.get("shortDescription") as string,
        description: formData.get("description") as string,
        date: formData.get("startDate") as string, 
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory,
        categoryName: currentCategory?.name || "Outros",
        tags: tags.split(",").map(t => t.trim()).filter(t => t !== ""),
        ticketMode: ticketMode,
        isFree: ticketMode === 'free',
        batches: batches.map(b => ({
          ...b,
          totalCapacity: b.ticketTypes.reduce((acc, t) => acc + (parseInt(t.quantity as any) || 0), 0),
          ticketTypes: b.ticketTypes.map(t => ({
            ...t,
            price: parseFloat(t.price as any) || 0,
            quantity: parseInt(t.quantity as any) || 0
          }))
        })),
        cep,
        address,
        latitude: parseFloat(coords.lat) || 0,
        longitude: parseFloat(coords.lng) || 0,
        image: uploadedImageUrl || "",
        organizationId: currentOrg.id,
        organizerId: user.uid, 
        organizer: {
          name: currentOrg.name,
          avatar: currentOrg.avatar || "",
          isVerified: !!currentOrg.verified,
          username: currentOrg.username
        },
        status: "Ativo",
        city: address.city,
        createdAt: serverTimestamp()
      }

      await addDoc(collection(db, "events"), eventData)
      toast({ title: "Evento Publicado!" })
      router.push("/dashboard/projetos")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao publicar", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  if (orgLoading) {
    return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/projetos"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary uppercase italic">Novo Evento</h1>
          <div className="flex items-center gap-2 mt-1">
             <Badge variant="secondary" className="gap-1.5 font-black uppercase text-[10px] italic">
                <Building2 className="w-3 h-3" />
                {currentOrg?.name}
             </Badge>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="overflow-hidden border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="w-5 h-5 text-secondary" /> Capa do Evento</CardTitle></CardHeader>
          <CardContent className="px-6 pb-6">
            <div 
              className="relative aspect-video rounded-[1.5rem] bg-muted border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden cursor-pointer"
              onClick={() => document.getElementById('image-upload')?.click()}
            >
              {imagePreview ? <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" /> : <><Upload className="w-10 h-10 text-muted-foreground mb-2" /><p className="text-sm font-bold opacity-40">Carregar Imagem (16:9)</p></>}
              <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>
            {uploadProgress !== null && <Progress value={uploadProgress} className="h-1 mt-4" />}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5 text-secondary" /> Informações do Evento</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label>Nome do Evento</Label><Input name="title" required className="rounded-xl" /></div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {sortedCategories.map((cat: any) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label>Data e Hora Início</Label><Input name="startDate" type="datetime-local" required className="rounded-xl" /></div>
              <div className="space-y-2"><Label>Data e Hora Fim</Label><Input name="endDate" type="datetime-local" required className="rounded-xl" /></div>
            </div>
            <div className="space-y-2"><Label>Descrição Curta (Slogan)</Label><Input name="shortDescription" required className="rounded-xl" /></div>
            <div className="space-y-2"><Label>Descrição Detalhada</Label><Textarea name="description" className="min-h-[120px] rounded-xl" required /></div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-secondary" /> Localização</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2"><Label>CEP</Label><Input value={cep} onChange={e => setCep(e.target.value)} onBlur={handleCepBlur} className="rounded-xl" /></div>
              <div className="md:col-span-3 space-y-2"><Label>Endereço</Label><Input value={address.street} onChange={e => setAddress({...address, street: e.target.value})} onBlur={geocodeAddress} className="rounded-xl" /></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-2"><Label>Número</Label><Input value={address.number} onChange={e => setAddress({...address, number: e.target.value})} onBlur={geocodeAddress} className="rounded-xl" /></div>
              <div className="space-y-2"><Label>Bairro</Label><Input value={address.neighborhood} onChange={e => setAddress({...address, neighborhood: e.target.value})} className="rounded-xl" /></div>
              <div className="space-y-2"><Label>Cidade</Label><Input value={address.city} readOnly className="bg-muted/30 rounded-xl" /></div>
              <div className="space-y-2"><Label>UF</Label><Input value={address.state} readOnly className="bg-muted/30 rounded-xl" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Configuração de Ingressos</CardTitle>
              <div className="bg-white p-1 rounded-xl border flex gap-1">
                <Button 
                  type="button" 
                  variant={ticketMode === 'free' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="rounded-lg text-[10px] font-black uppercase px-4"
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
                  className="rounded-lg text-[10px] font-black uppercase px-4"
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
                  className="rounded-lg text-[10px] font-black uppercase px-4"
                  onClick={() => setTicketMode('batches')}
                >Lotes</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
             {batches.map((batch, bIdx) => {
               const stats = calculateHalfPriceStats(batch)
               const isFreeMode = ticketMode === 'free'
               
               return (
                 <div key={batch.id} className="p-6 rounded-[1.5rem] border-2 bg-muted/10 space-y-6 relative animate-in fade-in zoom-in-95">
                    <div className="flex justify-between items-center">
                       <div className="space-y-1">
                          <h3 className="font-black italic uppercase text-secondary tracking-tighter text-xl">{isFreeMode ? "Grátis" : batch.name}</h3>
                       </div>
                       {ticketMode === 'batches' && batches.length > 1 && (
                         <Button type="button" variant="ghost" size="icon" className="text-destructive rounded-full" onClick={() => removeBatch(bIdx)}><Trash2 className="w-4 h-4" /></Button>
                       )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase opacity-60">Nome do Lote / Ingresso</Label>
                          <Input 
                            value={isFreeMode ? "Grátis" : batch.name} 
                            onChange={e => updateBatchField(bIdx, 'name', e.target.value)} 
                            className="rounded-xl h-11" 
                            disabled={isFreeMode}
                          />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase opacity-60">Início Vendas</Label>
                             <Input type="datetime-local" value={batch.startDate} onChange={e => updateBatchField(bIdx, 'startDate', e.target.value)} className="rounded-xl h-11 text-xs" />
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase opacity-60">Fim Vendas</Label>
                             <Input type="datetime-local" value={batch.endDate} onChange={e => updateBatchField(bIdx, 'endDate', e.target.value)} className="rounded-xl h-11 text-xs" />
                          </div>
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
                                  updateBatchField(bIdx, 'ticketTypes', newTypes);
                                }
                              }}>
                                  <SelectTrigger className="h-8 rounded-lg text-[10px] font-black uppercase border-dashed w-40"><SelectValue placeholder="Presets de Tipos" /></SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {DEFAULT_TICKET_TYPES.map(p => <SelectItem key={p.name} value={p.name} className="text-xs font-bold">{p.name}</SelectItem>)}
                                  </SelectContent>
                              </Select>
                              <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase border-dashed" onClick={() => addTicketType(bIdx)}>Adicionar Personalizado</Button>
                            </div>
                          )}
                       </div>

                       <div className="space-y-3">
                          {batch.ticketTypes.map((type, tIdx) => (
                            <div key={type.id} className="p-4 bg-white rounded-2xl border shadow-sm space-y-4 group transition-all hover:ring-2 hover:ring-secondary/10">
                               <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                  <div className="md:col-span-4 space-y-2">
                                     <Label className="text-[10px] font-black uppercase opacity-40">Nome do Tipo</Label>
                                     <Input value={type.name} onChange={e => updateTicketTypeField(bIdx, tIdx, 'name', e.target.value)} className="rounded-xl h-10 font-bold" />
                                  </div>
                                  <div className="md:col-span-2 space-y-2">
                                     <Label className="text-[10px] font-black uppercase opacity-40">Qtd</Label>
                                     <Input type="number" value={type.quantity} onChange={e => updateTicketTypeField(bIdx, tIdx, 'quantity', e.target.value)} className="rounded-xl h-10 font-black" />
                                  </div>
                                  <div className="md:col-span-2 space-y-2">
                                     <Label className="text-[10px] font-black uppercase opacity-40">Valor (R$)</Label>
                                     <Input 
                                      type="number" 
                                      step="0.01" 
                                      disabled={isFreeMode}
                                      value={type.price} 
                                      onChange={e => updateTicketTypeField(bIdx, tIdx, 'price', e.target.value)} 
                                      className="rounded-xl h-10 font-black text-secondary" 
                                     />
                                  </div>
                                  <div className="md:col-span-3 flex items-center justify-around pb-2">
                                     <div className="flex flex-col items-center gap-1">
                                        <Switch checked={type.isLegalHalf} onCheckedChange={v => updateTicketTypeField(bIdx, tIdx, 'isLegalHalf', v)} disabled={isFreeMode} />
                                        <Label className="text-[8px] font-black uppercase">Meia-Entrada</Label>
                                     </div>
                                     <div className="flex flex-col items-center gap-1">
                                        <Switch checked={type.requiresProof} onCheckedChange={v => updateTicketTypeField(bIdx, tIdx, 'requiresProof', v)} />
                                        <Label className="text-[8px] font-black uppercase">Doc. Obrigatório</Label>
                                     </div>
                                  </div>
                                  <div className="md:col-span-1 flex justify-end pb-1">
                                     {!isFreeMode && batch.ticketTypes.length > 1 && (
                                       <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-full hover:bg-destructive/10" onClick={() => removeTicketType(bIdx, tIdx)}><Trash2 className="w-4 h-4" /></Button>
                                     )}
                                  </div>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="p-5 bg-white rounded-3xl border shadow-inner space-y-4">
                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                             <div className="flex items-center gap-2">
                                <Info className="w-4 h-4 text-secondary" />
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-primary">Cálculo de Meia-Entrada Legal</h5>
                             </div>
                             <p className="text-[9px] text-muted-foreground font-medium leading-tight">Lei Federal nº 12.933/2013 recomenda reserva de 40% para Estudante, PCD, Idoso e ID Jovem.</p>
                          </div>
                          <div className="flex items-center gap-3">
                             <div className="text-right">
                                <p className="text-[9px] font-black uppercase opacity-40">Percentual do Lote</p>
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
                               Aviso: A quantidade de meias legais ({stats.legalHalf}) está abaixo de 40% da capacidade total ({stats.total}). Considere revisar antes de publicar.
                            </p>
                         </div>
                       )}
                    </div>
                 </div>
               )
             })}
             
             {ticketMode === 'batches' && (
               <Button type="button" variant="outline" className="w-full h-14 rounded-2xl border-dashed font-black uppercase italic tracking-widest gap-2 hover:bg-secondary/5 hover:border-secondary/40 transition-all" onClick={addBatch}>
                  <Plus className="w-5 h-5" /> Adicionar Outro Lote de Vendas
               </Button>
             )}
          </CardContent>
        </Card>

        <Button 
          type="submit" 
          className="w-full bg-secondary text-white hover:bg-secondary/90 h-16 rounded-[2rem] font-black text-xl shadow-xl shadow-secondary/20 uppercase italic transition-all hover:scale-[1.02]" 
          disabled={loading}
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Plus className="w-6 h-6 mr-2" />}
          Publicar Evento
        </Button>
      </form>
    </div>
  )
}
