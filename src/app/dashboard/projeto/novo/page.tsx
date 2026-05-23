
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useFirebaseApp, useCollection, useMemoFirebase } from "@/firebase"
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, query, where, getDocs, limit, deleteField, updateDoc, writeBatch } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { 
  Loader2, 
  ArrowLeft, 
  Plus, 
  Upload, 
  Calendar, 
  Ticket, 
  ImageIcon,
  Save,
  Map as MapIcon,
  X,
  Sparkles,
  Layers,
  Clock,
  Info,
  CheckCircle2,
  InfoIcon,
  TicketPercent,
  ChevronRight,
  Settings2
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"

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
  startTime: string
  endDate: string
  endTime: string
  capacidadeInicial: number
  capacidadeAtual: number
  vendidos: number
  restantes: number
  migradosDoLoteAnterior: number
  ticketTypes: TicketType[]
}

const HALF_PRICE_CATEGORIES = [
  { id: "estudante", label: "Estudante" },
  { id: "meia", label: "Meia-Entrada Geral" },
  { id: "obeso", label: "Obeso" },
  { id: "pcd", label: "PCD" },
  { id: "idoso", label: "Idoso" }
]

export default function NovoEventoPage() {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg, userRole, loading: orgLoading } = useCurrentOrganization()

  const storage = React.useMemo(() => app ? getStorage(app, "gs://viby") : null, [app])
  const categoriesQuery = useMemoFirebase(() => db ? collection(db, "categories") : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  
  const [selectedCategory, setSelectedCategory] = useState("")
  const [ticketMode, setTicketMode] = useState<'none' | 'free' | 'paid_single' | 'batches'>('free')
  const [hasMap, setHasMap] = useState(false)
  
  // Independent Half Price Logic
  const [autoHalfPrice, setAutoHalfPrice] = useState(false)
  const [halfPricePercentage, setHalfPricePercentage] = useState(40)
  const [selectedHalfTypes, setSelectedHalfTypes] = useState<string[]>([])
  const [isPercentageDialogOpen, setIsPercentageDialogOpen] = useState(false)

  // Gratuito
  const [freeConfig, setFreeConfig] = useState({ name: "Ingresso Gratuito", quantity: 100, startD: "", startT: "", endD: "", endT: "" })
  
  // Valor Único
  const [singleConfig, setSingleConfig] = useState({ name: "Ingresso Único", quantity: 100, price: 0, startD: "", startT: "", endD: "", endT: "" })
  const [priceInput, setPriceInput] = useState("")

  // Lotes
  const [batches, setBatches] = useState<Batch[]>([
    { 
      id: crypto.randomUUID(), 
      name: "Lote 1", 
      description: "", 
      startDate: "", 
      startTime: "", 
      endDate: "", 
      endTime: "", 
      capacidadeInicial: 100, 
      capacidadeAtual: 100,
      vendidos: 0,
      restantes: 100,
      migradosDoLoteAnterior: 0,
      ticketTypes: [] 
    }
  ])

  const formatCurrency = (value: string) => {
    const numeric = value.replace(/\D/g, "");
    const amount = Number(numeric) / 100;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  const handlePriceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numeric = value.replace(/\D/g, "");
    setPriceInput(formatCurrency(numeric));
    setSingleConfig({ ...singleConfig, price: Number(numeric) / 100 });
  };

  const handleToggleHalfPrice = (checked: boolean) => {
    if (checked) {
      setIsPercentageDialogOpen(true);
    } else {
      setAutoHalfPrice(false);
      setSelectedHalfTypes([]);
    }
  };

  const confirmHalfPriceConfig = () => {
    setAutoHalfPrice(true);
    setIsPercentageDialogOpen(false);
  };

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !currentOrg) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      const cat = categories?.find(c => c.id === selectedCategory)
      
      let finalBatches: any[] = []
      let totalCapacity = 0

      if (ticketMode === 'free') {
        totalCapacity = freeConfig.quantity
        finalBatches = [{
          id: 'free',
          name: freeConfig.name,
          price: 0,
          initialCapacity: freeConfig.quantity,
          currentCapacity: freeConfig.quantity,
          salesStart: `${freeConfig.startD}T${freeConfig.startT}`,
          salesEnd: `${freeConfig.endD}T${freeConfig.endT}`,
          ticketTypes: [{ id: 'free_type', name: 'Gratuito', price: 0, quantity: freeConfig.quantity, requiresProof: false, isLegalHalf: false, description: '' }]
        }]
      } else if (ticketMode === 'paid_single') {
        totalCapacity = singleConfig.quantity
        const poolId = crypto.randomUUID()
        const types: any[] = [{ id: 'single_type', name: singleConfig.name, price: singleConfig.price, quantity: singleConfig.quantity, poolId, poolName: 'Estoque Único', requiresProof: false, isLegalHalf: false, description: '' }]
        
        if (autoHalfPrice) {
          const halfQty = Math.floor(singleConfig.quantity * (halfPricePercentage / 100))
          selectedHalfTypes.forEach(typeId => {
            const catLabel = HALF_PRICE_CATEGORIES.find(c => c.id === typeId)?.label || "Meia"
            types.push({
              id: `half_${typeId}`,
              name: catLabel,
              price: singleConfig.price / 2,
              quantity: halfQty,
              poolId,
              poolName: 'Estoque Único',
              requiresProof: true,
              isLegalHalf: true,
              description: `Válido para ${catLabel}`
            })
          })
        }

        finalBatches = [{
          id: 'single',
          name: 'Venda Geral',
          price: singleConfig.price,
          initialCapacity: singleConfig.quantity,
          currentCapacity: singleConfig.quantity,
          salesStart: `${singleConfig.startD}T${singleConfig.startT}`,
          salesEnd: `${singleConfig.endD}T${singleConfig.endT}`,
          ticketTypes: types
        }]
      }

      const eventData = {
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        date: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory,
        categoryName: cat?.name || "Outros",
        ticketMode,
        hasMap,
        autoHalfPrice,
        halfPricePercentage,
        selectedHalfTypes,
        capacidadeTotal: totalCapacity,
        batches: finalBatches,
        image: uploadedImageUrl || "",
        organizationId: currentOrg.id,
        organizerId: user.uid,
        status: "Ativo",
        createdAt: serverTimestamp()
      }

      await addDoc(collection(db, "events"), eventData)
      toast({ title: "Evento Publicado!" })
      router.push("/dashboard/organizacoes")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 text-foreground">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Novo Evento</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden">
          <CardHeader className="bg-muted/30"><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="w-5 h-5" /> Mídia</CardTitle></CardHeader>
          <CardContent className="p-8">
            <div className="relative aspect-video bg-muted rounded-[2rem] overflow-hidden cursor-pointer group" onClick={() => document.getElementById('img-up')?.click()}>
              {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <div className="h-full flex flex-col items-center justify-center opacity-30"><Upload className="w-10 h-10 mb-2" /><p className="text-[10px] font-black uppercase">Capa do Evento</p></div>}
              <input id="img-up" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
            </div>
            {uploadProgress !== null && <Progress value={uploadProgress} className="h-1 mt-4" />}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2.5rem]">
          <CardHeader><CardTitle className="text-lg">Essenciais</CardTitle></CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Título</Label><Input name="title" required className="rounded-xl h-12" /></div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Categoria</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory} required>
                  <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="rounded-xl">{categories?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Data Início</Label><Input name="startDate" type="datetime-local" required className="rounded-xl h-12" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Data Fim</Label><Input name="endDate" type="datetime-local" required className="rounded-xl h-12" /></div>
            </div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Descrição</Label><Textarea name="description" className="min-h-[150px] rounded-2xl resize-none" required /></div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria</CardTitle>
                <CardDescription>Configure como será o acesso ao evento.</CardDescription>
              </div>
              <div className="bg-white p-1 rounded-xl border flex flex-wrap gap-1">
                {['none', 'free', 'paid_single', 'batches'].map((mode: any) => (
                  <Button key={mode} type="button" variant={ticketMode === mode ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[9px] font-black uppercase px-4" onClick={() => setTicketMode(mode)}>
                    {mode === 'none' ? 'Sem Ingresso' : mode === 'free' ? 'Grátis' : mode === 'paid_single' ? 'Valor Único' : 'Lotes'}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            {ticketMode === 'none' && (
              <div className="py-12 text-center space-y-4 animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                   <InfoIcon className="w-8 h-8 text-muted-foreground opacity-30" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black uppercase italic tracking-tighter">Evento Informativo</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">Esse evento não terá controle de entrada. Ele servirá apenas para divulgação das informações e localização.</p>
                </div>
              </div>
            )}

            {ticketMode === 'free' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nome do Ingresso</Label><Input value={freeConfig.name} onChange={e => setFreeConfig({...freeConfig, name: e.target.value})} className="rounded-xl h-11" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Quantidade Total</Label><Input type="number" value={freeConfig.quantity} onChange={e => setFreeConfig({...freeConfig, quantity: Number(e.target.value)})} className="rounded-xl h-11 font-black" /></div>
                </div>
                <div className="space-y-4">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-secondary">Janela de Distribuição</Label>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-muted/20 rounded-[1.5rem] border-2 border-dashed">
                      <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Abre em</Label><Input type="date" value={freeConfig.startD} onChange={e => setFreeConfig({...freeConfig, startD: e.target.value})} required className="h-10" /></div>
                      <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Hora</Label><Input type="time" value={freeConfig.startT} onChange={e => setFreeConfig({...freeConfig, startT: e.target.value})} required className="h-10" /></div>
                      <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Fecha em</Label><Input type="date" value={freeConfig.endD} onChange={e => setFreeConfig({...freeConfig, endD: e.target.value})} required className="h-10" /></div>
                      <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Hora</Label><Input type="time" value={freeConfig.endT} onChange={e => setFreeConfig({...freeConfig, endT: e.target.value})} required className="h-10" /></div>
                   </div>
                </div>
              </div>
            )}

            {ticketMode === 'paid_single' && (
              <div className="space-y-10 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Nome Comercial</Label>
                    <Input value={singleConfig.name} onChange={e => setSingleConfig({...singleConfig, name: e.target.value})} className="rounded-xl h-11" placeholder="Ex: Ingresso Geral" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Preço</Label>
                    <Input 
                      value={priceInput} 
                      onChange={handlePriceInputChange} 
                      placeholder="R$ 0,00"
                      className="rounded-xl h-11 font-black text-secondary" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Capacidade</Label>
                    <Input type="number" value={singleConfig.quantity} onChange={e => setSingleConfig({...singleConfig, quantity: Number(e.target.value)})} className="rounded-xl h-11 font-black" />
                  </div>
                </div>

                <div className="space-y-4">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-secondary">Janela de Vendas</Label>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-muted/20 rounded-[1.5rem] border-2 border-dashed">
                      <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Abre em</Label><Input type="date" value={singleConfig.startD} onChange={e => setSingleConfig({...singleConfig, startD: e.target.value})} required className="h-10" /></div>
                      <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Hora</Label><Input type="time" value={singleConfig.startT} onChange={e => setSingleConfig({...singleConfig, startT: e.target.value})} required className="h-10" /></div>
                      <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Fecha em</Label><Input type="date" value={singleConfig.endD} onChange={e => setSingleConfig({...singleConfig, endD: e.target.value})} required className="h-10" /></div>
                      <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-40">Hora</Label><Input type="time" value={singleConfig.endT} onChange={e => setSingleConfig({...singleConfig, endT: e.target.value})} required className="h-10" /></div>
                   </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-dashed">
                   <div className="flex items-center justify-between p-5 bg-primary text-white rounded-3xl shadow-xl">
                      <div className="flex items-center gap-4">
                         <div className="p-3 bg-white/10 rounded-2xl"><TicketPercent className="w-6 h-6 text-secondary" /></div>
                         <div className="space-y-0.5">
                            <p className="font-black uppercase text-xs italic tracking-tighter">Meia-Entrada Automática</p>
                            <p className="text-[9px] opacity-60 uppercase font-bold">Gerencie as cotas de meia-entrada de forma automatizada.</p>
                         </div>
                      </div>
                      <Switch checked={autoHalfPrice} onCheckedChange={handleToggleHalfPrice} />
                   </div>

                   {autoHalfPrice && (
                     <div className="p-6 bg-secondary/5 border-2 border-dashed border-secondary/20 rounded-[2rem] space-y-6 animate-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center justify-between">
                           <div className="space-y-1">
                              <h4 className="text-sm font-black uppercase italic text-primary">Cota de Meia: {halfPricePercentage}%</h4>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">{Math.floor(singleConfig.quantity * (halfPricePercentage / 100))} ingressos reservados.</p>
                           </div>
                           <Button type="button" variant="outline" size="sm" onClick={() => setIsPercentageDialogOpen(true)} className="rounded-xl h-8 text-[9px] font-black uppercase border-secondary text-secondary">Alterar %</Button>
                        </div>
                        
                        <div className="space-y-3">
                           <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Categorias Habilitadas</Label>
                           <div className="flex flex-wrap gap-2">
                              {HALF_PRICE_CATEGORIES.map((cat) => (
                                <div key={cat.id} className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl border border-border shadow-sm">
                                  <Checkbox 
                                    id={`cat-${cat.id}`} 
                                    checked={selectedHalfTypes.includes(cat.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) setSelectedHalfTypes([...selectedHalfTypes, cat.id]);
                                      else setSelectedHalfTypes(selectedHalfTypes.filter(id => id !== cat.id));
                                    }}
                                  />
                                  <label htmlFor={`cat-${cat.id}`} className="text-[11px] font-bold uppercase cursor-pointer">{cat.label}</label>
                                </div>
                              ))}
                           </div>
                        </div>
                     </div>
                   )}

                   <div className="flex items-center justify-between p-5 bg-muted/50 rounded-3xl">
                      <div className="flex items-center gap-4">
                         <div className="p-3 bg-background rounded-2xl"><MapIcon className="w-6 h-6 text-secondary" /></div>
                         <div className="space-y-0.5">
                            <p className="font-black uppercase text-xs italic tracking-tighter">Habilitar Lugar Marcado</p>
                            <p className="text-[9px] opacity-60 uppercase font-bold">Permita que o público escolha cadeiras ou mesas no mapa visual.</p>
                         </div>
                      </div>
                      <Switch checked={hasMap} onCheckedChange={setHasMap} />
                   </div>

                   {hasMap && (
                     <div className="flex justify-center pt-2">
                        <Button type="button" className="bg-secondary text-white font-black h-12 rounded-xl px-10 shadow-lg uppercase italic text-xs gap-2 hover:scale-105 transition-all">
                           <Settings2 className="w-4 h-4" /> Configurar Mapa de Locais
                        </Button>
                     </div>
                   )}
                </div>
              </div>
            )}
            
            {ticketMode === 'batches' && (
              <div className="py-20 text-center opacity-30 italic">Lógica de lotes preservada para preenchimento futuro.</div>
            )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading} className="w-full h-16 rounded-[2rem] bg-secondary text-white font-black text-xl shadow-xl uppercase italic hover:scale-[1.02] transition-transform">
          {loading ? <Loader2 className="animate-spin mr-2" /> : <><CheckCircle2 className="mr-2" /> Publicar Evento</>}
        </Button>
      </form>

      {/* DIALOG PARA % DE MEIA */}
      <Dialog open={isPercentageDialogOpen} onOpenChange={setIsPercentageDialogOpen}>
        <DialogContent className="max-w-sm rounded-[2.5rem]">
           <DialogHeader>
              <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-2 text-secondary">
                 <TicketPercent className="w-8 h-8" />
              </div>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center">Configurar Cota</DialogTitle>
              <DialogDescription className="text-center font-medium">Quantos % da capacidade total do evento serão destinados à meia-entrada?</DialogDescription>
           </DialogHeader>
           <div className="py-6 space-y-6">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Porcentagem (%)</Label>
                 <div className="relative">
                    <Input 
                      type="number" 
                      value={halfPricePercentage} 
                      onChange={e => setHalfPricePercentage(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="h-16 text-3xl font-black rounded-2xl text-center pr-12 border-secondary/20" 
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-black text-muted-foreground opacity-30">%</span>
                 </div>
              </div>
              <div className="p-4 bg-muted/30 rounded-2xl border border-dashed flex gap-3">
                 <Info className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                 <p className="text-[9px] text-muted-foreground font-bold uppercase leading-tight">Por padrão, a legislação brasileira exige reserva mínima de 40% para categorias beneficiadas.</p>
              </div>
           </div>
           <DialogFooter>
              <Button onClick={confirmHalfPriceConfig} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">Confirmar Cota</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
