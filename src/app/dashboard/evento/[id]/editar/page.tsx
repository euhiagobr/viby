
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useFirebaseApp, useCollection, useMemoFirebase } from "@/firebase"
import { updateDoc, doc, collection, serverTimestamp, deleteField } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { 
  Loader2, 
  ArrowLeft, 
  Upload, 
  Calendar, 
  Ticket, 
  ImageIcon,
  Save,
  MapPin,
  X,
  Plus,
  Sparkles,
  Trash2,
  ArrowDown,
  Users2,
  InfoIcon,
  XCircle,
  Layout,
  Armchair,
  Grid3X3,
  Map as MapIcon
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"

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
  startDate: string
  endDate: string
  capacidadeInicial: number
  capacidadeAtual: number
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

  const eventRef = React.useMemo(() => (db && eventId) ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const storage = React.useMemo(() => app ? getStorage(app, "gs://viby") : null, [app])
  const categoriesQuery = useMemoFirebase(() => db ? collection(db, "categories") : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  
  const [selectedCategory, setSelectedCategory] = useState("")
  const [ticketMode, setTicketMode] = useState<'none' | 'free' | 'paid_single' | 'batches'>('none')
  const [mapMode, setMapMode] = useState<'none' | 'setores' | 'assentos' | 'mesas'>('none')
  
  const [globalCapacity, setGlobalCapacity] = useState<number>(0)
  const [batches, setBatches] = useState<Batch[]>([])
  const [address, setAddress] = useState({ street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "" })

  // --- Valor Único State ---
  const [singlePriceInput, setSinglePriceInput] = useState("")
  const [singleHalfPriceInput, setSingleHalfPriceInput] = useState("")
  const [hasHalfPriceSingle, setHasHalfPriceSingle] = useState(false)
  const [singleHalfTypes, setSingleHalfTypes] = useState<string[]>(["Estudante", "PCD", "Idoso"])
  const [singleSalesStart, setSingleSalesStart] = useState("")
  const [singleSalesEnd, setSingleSalesEnd] = useState("")

  // --- Gratuito State ---
  const [freeSalesStart, setFreeSalesStart] = useState("")
  const [freeSalesEnd, setFreeSalesEnd] = useState("")

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  const handlePriceMask = (value: string, setter: (v: string) => void) => {
    const numeric = value.replace(/\D/g, "");
    const amount = Number(numeric) / 100;
    setter(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount));
  }

  const parseCurrencyToNumber = (value: string) => {
    const numeric = value.replace(/\D/g, "");
    return Number(numeric) / 100;
  }

  useEffect(() => {
    if (event) {
      setSelectedCategory(event.categoryId || "")
      setTicketMode(event.ticketMode || 'none')
      setMapMode(event.mapMode || 'none')
      setGlobalCapacity(event.capacidadeTotal || 0)
      setImagePreview(event.image || null)
      if (event.address) setAddress({ ...address, ...event.address })

      if (event.ticketMode === 'batches') {
        setBatches(event.batches || [])
      } else if (event.ticketMode === 'paid_single' && event.batches?.length > 0) {
        const b = event.batches[0];
        setSinglePriceInput(formatCurrency(b.price));
        setSingleSalesStart(b.startDate || "");
        setSingleSalesEnd(b.endDate || "");
        const halfs = b.ticketTypes?.filter((t: any) => t.isLegalHalf);
        if (halfs?.length > 0) {
          setHasHalfPriceSingle(true);
          setSingleHalfPriceInput(formatCurrency(halfs[0].price));
          setSingleHalfTypes(halfs.map((t: any) => t.name.replace("Meia ", "")));
        }
      } else if (event.ticketMode === 'free' && event.batches?.length > 0) {
        const b = event.batches[0];
        setFreeSalesStart(b.startDate || "");
        setFreeSalesEnd(b.endDate || "");
      }
    }
  }, [event])

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return
    setImagePreview(URL.createObjectURL(file))
    setUploadProgress(0)
    const storageRef = ref(storage, `events/${user.uid}/${Date.now()}_${file.name}`)
    const uploadTask = uploadBytesResumable(storageRef, file)
    uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), () => setUploadProgress(null), async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref)
      setUploadedImageUrl(url); setUploadProgress(null)
    })
  }

  const handleBatchTicketPriceChange = (bi: number, ti: number, value: string) => {
    const numeric = value.replace(/\D/g, "");
    const price = Number(numeric) / 100;
    const n = [...batches];
    n[bi].ticketTypes[ti].price = price;
    setBatches(n);
  }

  const generateHalfPriceTypes = (bi: number) => {
    const n = [...batches];
    const batch = n[bi];
    const poolId = crypto.randomUUID();
    const currentInteiraPrice = batch.ticketTypes.find(t => t.name === "Inteira")?.price || 100;
    
    const types: TicketType[] = [
      { id: crypto.randomUUID(), name: "Inteira", price: currentInteiraPrice, quantity: batch.capacidadeInicial, poolId, poolName: "Estoque Lote", requiresProof: false, isLegalHalf: false, description: "" },
      { id: crypto.randomUUID(), name: "Meia Estudante", price: currentInteiraPrice / 2, quantity: batch.capacidadeInicial, poolId, poolName: "Estoque Lote", requiresProof: true, isLegalHalf: true, description: "" },
      { id: crypto.randomUUID(), name: "Meia PCD", price: currentInteiraPrice / 2, quantity: batch.capacidadeInicial, poolId, poolName: "Estoque Lote", requiresProof: true, isLegalHalf: true, description: "" },
      { id: crypto.randomUUID(), name: "Meia Idoso", price: currentInteiraPrice / 2, quantity: batch.capacidadeInicial, poolId, poolName: "Estoque Lote", requiresProof: true, isLegalHalf: true, description: "" }
    ];
    
    n[bi].ticketTypes = types;
    setBatches(n);
    toast({ title: "Categorias de meia geradas!" });
  }

  const addBatch = () => {
    const newB: Batch = {
      id: crypto.randomUUID(),
      name: `${batches.length + 1}º Lote`,
      startDate: "",
      endDate: "",
      capacidadeInicial: 100,
      capacidadeAtual: 100,
      ticketTypes: [{ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }]
    }
    setBatches([...batches, newB])
  }

  const removeBatch = (i: number) => {
    if(batches.length > 1) setBatches(batches.filter((_, idx) => idx !== i))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !eventRef) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      const cat = categories?.find(c => c.id === selectedCategory)
      
      let finalBatches: any[] = []
      let totalCapacity = globalCapacity

      if (ticketMode === 'free') {
        finalBatches = [{
          id: 'free',
          name: 'Ingresso Gratuito',
          startDate: freeSalesStart,
          endDate: freeSalesEnd,
          price: 0,
          initialCapacity: globalCapacity,
          currentCapacity: globalCapacity,
          ticketTypes: [{ id: 'free_type', name: 'Gratuito', price: 0, quantity: globalCapacity, requiresProof: false, isLegalHalf: false, description: '' }]
        }]
      } else if (ticketMode === 'paid_single') {
        const poolId = crypto.randomUUID();
        const mainPrice = parseCurrencyToNumber(singlePriceInput);
        const types = [{ id: crypto.randomUUID(), name: 'Inteira', price: mainPrice, quantity: globalCapacity, poolId, poolName: 'Lote Único', requiresProof: false, isLegalHalf: false, description: '' }];
        
        if (hasHalfPriceSingle) {
          const hp = parseCurrencyToNumber(singleHalfPriceInput);
          singleHalfTypes.forEach(t => {
            types.push({ id: crypto.randomUUID(), name: `Meia ${t}`, price: hp, quantity: globalCapacity, poolId, poolName: 'Lote Único', requiresProof: true, isLegalHalf: true, description: '' });
          });
        }

        finalBatches = [{
          id: 'single',
          name: 'Valor Único',
          startDate: singleSalesStart,
          endDate: singleSalesEnd,
          price: mainPrice,
          initialCapacity: globalCapacity,
          currentCapacity: globalCapacity,
          ticketTypes: types
        }]
      } else if (ticketMode === 'batches') {
        finalBatches = batches;
        totalCapacity = batches.reduce((acc, b) => acc + (b.capacidadeInicial || 0), 0)
      }

      const updateData: any = {
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        date: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory,
        categoryName: cat?.name || "Outros",
        ticketMode,
        mapMode,
        possuiMapa: mapMode !== 'none',
        capacidadeTotal: totalCapacity,
        batches: ticketMode === 'none' ? [] : finalBatches,
        address,
        image: uploadedImageUrl || event.image || "",
        updatedAt: serverTimestamp()
      }
      await updateDoc(eventRef, updateData)
      toast({ title: "Evento Atualizado!" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message })
    } finally {
      setLoading(false)
    }
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 text-foreground">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Editar Evento</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden">
          <CardHeader className="bg-muted/30"><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="w-5 h-5" /> Mídia</CardTitle></CardHeader>
          <CardContent className="p-8">
            <div className="relative aspect-video bg-muted rounded-[2rem] overflow-hidden cursor-pointer group" onClick={() => document.getElementById('edit-img-up')?.click()}>
              {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <div className="h-full flex flex-col items-center justify-center opacity-30"><Upload className="w-10 h-10 mb-2" /></div>}
              <input id="edit-img-up" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
            </div>
            {uploadProgress !== null && <Progress value={uploadProgress} className="h-1 mt-4" />}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2.5rem]">
          <CardHeader><CardTitle className="text-lg">Informações</CardTitle></CardHeader>
          <CardContent className="p-8 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Título</Label><Input name="title" defaultValue={event.title} required className="rounded-xl h-11" /></div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Categoria</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory} required>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="rounded-xl">{categories?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Início</Label><Input name="startDate" type="datetime-local" defaultValue={event.date} required className="rounded-xl h-11" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Fim</Label><Input name="endDate" type="datetime-local" defaultValue={event.endDate} required className="rounded-xl h-11" /></div>
             </div>
             <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Descrição</Label><Textarea name="description" defaultValue={event.description} className="min-h-[120px] rounded-xl" required /></div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-secondary" /> Localização</CardTitle></CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest opacity-60">CEP</Label><Input value={address.cep} onChange={e => setAddress({...address, cep: e.target.value})} placeholder="00000-000" className="rounded-xl h-11" /></div>
                <div className="md:col-span-3 space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Rua</Label><Input value={address.street} onChange={e => setAddress({...address, street: e.target.value})} className="rounded-xl h-11" /></div>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Número</Label><Input value={address.number} onChange={e => setAddress({...address, number: e.target.value})} className="rounded-xl h-11" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Bairro</Label><Input value={address.neighborhood} onChange={e => setAddress({...address, neighborhood: e.target.value})} className="rounded-xl h-11" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cidade</Label><Input value={address.city} readOnly className="rounded-xl h-11 bg-muted/30" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">UF</Label><Input value={address.state} readOnly className="rounded-xl h-11 bg-muted/30 w-16" /></div>
             </div>
          </CardContent>
        </Card>

        {/* ESTRUTURA DO EVENTO (MAPA) */}
        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden">
           <CardHeader className="bg-primary/5">
              <CardTitle className="text-lg flex items-center gap-2"><MapIcon className="w-5 h-5 text-primary" /> Estrutura do Evento (Mapa)</CardTitle>
              <CardDescription>O mapa visual é opcional e independente do tipo de ingresso.</CardDescription>
           </CardHeader>
           <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                 {[
                   { id: 'none', label: 'Sem Mapa', icon: XCircle, desc: 'Lista simples' },
                   { id: 'setores', label: 'Setores', icon: Layout, desc: 'Áreas livres' },
                   { id: 'assentos', label: 'Assentos', icon: Armchair, desc: 'Cadeiras' },
                   { id: 'mesas', label: 'Mesas', icon: Grid3X3, desc: 'Numeradas' }
                 ].map((mode) => (
                   <Button 
                     key={mode.id} 
                     type="button"
                     variant={mapMode === mode.id ? 'secondary' : 'outline'}
                     className={cn("h-24 flex-col gap-2 rounded-2xl border-dashed", mapMode === mode.id && "border-solid ring-2 ring-secondary/20")}
                     onClick={() => setMapMode(mode.id as any)}
                   >
                     <mode.icon className="w-6 h-6" />
                     <div className="text-center">
                        <p className="text-[10px] font-black uppercase">{mode.label}</p>
                        <p className="text-[8px] font-bold opacity-50 uppercase">{mode.desc}</p>
                     </div>
                   </Button>
                 ))}
              </div>
           </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1"><CardTitle className="text-lg flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria</CardTitle></div>
              <div className="bg-white p-1 rounded-xl border flex flex-wrap gap-1">
                {['none', 'free', 'paid_single', 'batches'].map((mode: any) => (
                  <Button key={mode} type="button" variant={ticketMode === mode ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-4" onClick={() => setTicketMode(mode)}>
                    {mode === 'none' ? 'Sem Ingresso' : mode === 'free' ? 'Grátis' : mode === 'paid_single' ? 'Valor Único' : 'Lotes'}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            {ticketMode === 'none' && (
              <div className="py-12 text-center space-y-4">
                <InfoIcon className="w-12 h-12 mx-auto text-muted-foreground opacity-20" />
                <h3 className="text-lg font-black uppercase italic">Evento Informativo</h3>
                <p className="text-sm text-muted-foreground font-bold">Esse evento não terá controle de entrada.</p>
              </div>
            )}

            {ticketMode === 'free' && (
               <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Início das Vendas</Label><Input type="datetime-local" value={freeSalesStart} onChange={e => setFreeSalesStart(e.target.value)} required className="rounded-xl h-11" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Fim das Vendas</Label><Input type="datetime-local" value={freeSalesEnd} onChange={e => setFreeSalesEnd(e.target.value)} required className="rounded-xl h-11" /></div>
                  </div>
                  <div className="p-6 bg-muted/20 rounded-[1.5rem] border-2 border-dashed flex flex-col items-center gap-3">
                     <Label className="text-[10px] font-black uppercase tracking-widest text-secondary">Quantidade de Ingressos</Label>
                     <Input type="number" value={globalCapacity} onChange={e => setGlobalCapacity(Number(e.target.value))} className="h-14 text-2xl font-black rounded-2xl w-32 text-center border-secondary/20" />
                  </div>
               </div>
            )}

            {ticketMode === 'paid_single' && (
               <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-dashed">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Início das Vendas</Label><Input type="datetime-local" value={singleSalesStart} onChange={e => setSingleSalesStart(e.target.value)} required className="rounded-xl h-11" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-40">Fim das Vendas</Label><Input type="datetime-local" value={singleSalesEnd} onChange={e => setSingleSalesEnd(e.target.value)} required className="rounded-xl h-11" /></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Valor do Ingresso (Inteira)</Label>
                        <div className="relative">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-secondary">R$</span>
                           <Input value={singlePriceInput} onChange={e => handlePriceMask(e.target.value, setSinglePriceInput)} placeholder="R$ 0,00" className="h-14 text-2xl font-black rounded-2xl pl-12 border-secondary/20" />
                        </div>
                     </div>
                     <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Capacidade Total</Label>
                        <Input type="number" value={globalCapacity} onChange={e => setGlobalCapacity(Number(e.target.value))} className="h-14 text-2xl font-black rounded-2xl border-secondary/20" />
                     </div>
                  </div>

                  <div className="p-6 bg-secondary/5 rounded-3xl border-2 border-dashed border-secondary/20 space-y-6">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <Sparkles className="w-5 h-5 text-secondary" />
                           <Label className="font-bold text-sm">Habilitar Meia-Entrada Automática</Label>
                        </div>
                        <Switch checked={hasHalfPriceSingle} onCheckedChange={setHasHalfPriceSingle} />
                     </div>

                     {hasHalfPriceSingle && (
                        <div className="space-y-6 animate-in slide-in-from-top-2">
                           <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase opacity-40">Valor da Meia-Entrada</Label>
                              <div className="relative max-w-[200px]">
                                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-primary">R$</span>
                                 <Input value={singleHalfPriceInput} onChange={e => handlePriceMask(e.target.value, setSingleHalfPriceInput)} className="h-10 pl-10 rounded-xl font-bold" />
                              </div>
                           </div>
                           <div className="space-y-3">
                              <Label className="text-[10px] font-black uppercase opacity-40">Categorias Disponíveis</Label>
                              <div className="flex flex-wrap gap-4">
                                 {["Estudante", "PCD", "Idoso", "Professor", "Meia Social"].map(t => (
                                    <div key={t} className="flex items-center gap-2">
                                       <Checkbox checked={singleHalfTypes.includes(t)} onCheckedChange={(c) => c ? setSingleHalfTypes([...singleHalfTypes, t]) : setSingleHalfTypes(singleHalfTypes.filter(x => x !== t))} />
                                       <span className="text-xs font-medium">{t}</span>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            )}

            {ticketMode === 'batches' && (
              <div className="space-y-10 animate-in fade-in duration-500">
                <div className="p-6 bg-primary/5 rounded-[2rem] border-2 border-dashed border-primary/10 flex flex-col items-center gap-3">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Capacidade Total do Local (Todos os Lotes)</Label>
                   <Input type="number" value={globalCapacity} onChange={e => setGlobalCapacity(Number(e.target.value))} className="h-14 text-2xl font-black rounded-2xl w-32 text-center border-primary/20" />
                </div>

                {batches.map((batch, bi) => (
                  <div key={batch.id} className="p-6 rounded-[2rem] border-2 bg-muted/10 space-y-6 relative">
                     <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                           <h3 className="font-black italic uppercase text-secondary text-xl">{batch.name}</h3>
                           <Badge variant="outline" className="text-[10px] font-bold uppercase">{batch.capacidadeInicial} Lugares</Badge>
                        </div>
                        <div className="flex gap-2">
                           <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase border-secondary text-secondary gap-1.5" onClick={() => generateHalfPriceTypes(bi)}>
                              <Sparkles className="w-3 h-3" /> Gerar Categorias de Meia
                           </Button>
                           <Button type="button" variant="ghost" size="icon" className="text-destructive rounded-full" onClick={() => removeBatch(bi)} disabled={batches.length === 1}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-60">Vigência Início</Label><Input type="datetime-local" value={batch.startDate} onChange={e => { const n = [...batches]; n[bi].startDate = e.target.value; setBatches(n); }} className="h-10 text-xs rounded-xl" /></div>
                        <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-60">Vigência Fim</Label><Input type="datetime-local" value={batch.endDate} onChange={e => { const n = [...batches]; n[bi].endDate = e.target.value; setBatches(n); }} className="h-10 text-xs rounded-xl" /></div>
                     </div>

                     <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Categorias e Valores Individuais</Label>
                        {batch.ticketTypes.map((t, ti) => (
                           <div key={t.id} className="p-4 bg-white rounded-2xl border shadow-sm grid grid-cols-12 gap-4 items-end">
                              <div className="col-span-6 space-y-2">
                                 <Label className="text-[9px] uppercase font-black opacity-40">Título do Ingresso</Label>
                                 <Input value={t.name} onChange={e => { const n = [...batches]; n[bi].ticketTypes[ti].name = e.target.value; setBatches(n); }} className="rounded-xl h-10 font-bold" />
                              </div>
                              <div className="col-span-4 space-y-2">
                                 <Label className="text-[9px] uppercase font-black opacity-40">Preço (R$)</Label>
                                 <Input 
                                    value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.price)}
                                    onChange={e => handleBatchTicketPriceChange(bi, ti, e.target.value)}
                                    className="rounded-xl h-10 font-black text-secondary"
                                 />
                              </div>
                              <div className="col-span-2 flex justify-end pb-1">
                                 <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => { if(batch.ticketTypes.length > 1) { const n = [...batches]; n[bi].ticketTypes.splice(ti, 1); setBatches(n); } }}><Trash2 className="w-4 h-4" /></Button>
                              </div>
                           </div>
                        ))}
                        <Button type="button" variant="ghost" size="sm" className="text-secondary font-black uppercase text-[10px] gap-1" onClick={() => { const n = [...batches]; n[bi].ticketTypes.push({ id: crypto.randomUUID(), name: "Nova Categoria", price: 100, quantity: batch.capacidadeInicial, requiresProof: false, isLegalHalf: false, description: "" }); setBatches(n); }}>
                           <Plus className="w-3 h-3" /> Adicionar Categoria
                        </Button>
                     </div>
                  </div>
                ))}
                <Button type="button" variant="outline" className="w-full h-14 rounded-2xl border-dashed font-black uppercase italic" onClick={addBatch}><Plus className="w-5 h-5 mr-2" /> Adicionar Lote</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading} className="w-full h-16 bg-secondary text-white font-black text-xl rounded-[2rem] shadow-xl uppercase italic">
          {loading ? <Loader2 className="animate-spin mr-2" /> : "Salvar Alterações"}
        </Button>
      </form>
    </div>
  )
}
