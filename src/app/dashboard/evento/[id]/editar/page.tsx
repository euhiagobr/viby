
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
  Zap,
  Users2,
  ArrowDown
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
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
import { Separator } from "@/components/ui/separator"

interface TicketType {
  id: string
  name: string
  price: number
  quantity: number // This will now represent the share in the current batch
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
  capacidadeInicial: number
  capacidadeAtual: number
  vendidos: number
  restantes: number
  migradosDoLoteAnterior: number
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
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  
  const [selectedCategory, setSelectedCategory] = useState("")
  const [noTickets, setNoTickets] = useState(false)
  const [ticketMode, setTicketMode] = useState<'free' | 'paid_single' | 'batches' | 'map'>('free')
  const [batches, setBatches] = useState<Batch[]>([])
  const [capacidadeTotal, setCapacidadeTotal] = useState(0)
  
  const [address, setAddress] = useState({ street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "" })
  
  const [isDistributeOpen, setIsDistributeOpen] = useState(false)
  const [distributeBatchIdx, setDistributeBatchIdx] = useState<number | null>(null)
  const [totalToDistribute, setTotalToDistribute] = useState("")

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

  useEffect(() => {
    if (event && categories) {
      setSelectedCategory(event.categoryId || "");
      setNoTickets(event.noTickets || false)
      setTicketMode(event.ticketMode || 'free')
      setBatches(event.batches || [])
      setCapacidadeTotal(event.capacidadeTotal || 0)
      setAddress(event.address || { street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "" })
      setImagePreview(event.image || null)
    }
  }, [event, categories])

  // Recalcular lotes sempre que a capacidade inicial de um deles mudar
  const recalculateBatches = (currentBatches: Batch[]) => {
    const updated = [...currentBatches];
    let carryOver = 0;

    for (let i = 0; i < updated.length; i++) {
      const b = updated[i];
      b.migradosDoLoteAnterior = carryOver;
      b.capacidadeAtual = b.capacidadeInicial + carryOver;
      b.restantes = b.capacidadeAtual - (b.vendidos || 0);
      
      // A sobra que migra é o que sobrou deste lote após as vendas
      carryOver = Math.max(0, b.restantes);
    }
    return updated;
  }

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

  const handleDistribute = () => {
    if (distributeBatchIdx === null || !totalToDistribute) return
    const total = parseInt(totalToDistribute)
    if (isNaN(total)) return

    const poolId = crypto.randomUUID()
    const meiaQuantity = Math.floor(total * 0.4)

    const newTypes: TicketType[] = [
      { id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: total, poolId, poolName: "Estoque Compartilhado", requiresProof: false, isLegalHalf: false, description: "" },
      { id: crypto.randomUUID(), name: "Meia Estudante", price: 50, quantity: meiaQuantity, poolId, poolName: "Estoque Compartilhado", requiresProof: true, isLegalHalf: true, description: "" },
      { id: crypto.randomUUID(), name: "Meia PCD", price: 50, quantity: meiaQuantity, poolId, poolName: "Estoque Compartilhado", requiresProof: true, isLegalHalf: true, description: "" },
      { id: crypto.randomUUID(), name: "Meia Idoso", price: 50, quantity: meiaQuantity, poolId, poolName: "Estoque Compartilhado", requiresProof: true, isLegalHalf: true, description: "" }
    ]

    const newBatches = [...batches]
    newBatches[distributeBatchIdx].ticketTypes = newTypes
    newBatches[distributeBatchIdx].capacidadeInicial = total
    const recalculated = recalculateBatches(newBatches)
    setBatches(recalculated)
    setIsDistributeOpen(false)
    setTotalToDistribute("")
    toast({ title: "Ingressos distribuídos!", description: "Lote configurado como janela de venda." })
  }

  const addBatch = () => {
    const newBatch: Batch = { 
      id: crypto.randomUUID(), 
      name: `Lote ${batches.length + 1}`, 
      description: "", 
      startDate: "", 
      endDate: "", 
      capacidadeInicial: 100,
      capacidadeAtual: 100,
      vendidos: 0,
      restantes: 100,
      migradosDoLoteAnterior: 0,
      ticketTypes: [{ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }] 
    }
    const updated = recalculateBatches([...batches, newBatch])
    setBatches(updated)
  }

  const removeBatch = (i: number) => {
    const filtered = batches.filter((_, idx) => idx !== i)
    setBatches(recalculateBatches(filtered))
  }

  const updateBatchField = (i: number, f: keyof Batch, v: any) => { 
    const n = [...batches]; 
    n[i] = { ...n[i], [f]: v }; 
    if (f === 'capacidadeInicial') {
      setBatches(recalculateBatches(n))
    } else {
      setBatches(n)
    }
  }

  const addTicketType = (bi: number) => { 
    const n = [...batches]; 
    n[bi].ticketTypes.push({ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }); 
    setBatches(n); 
  }

  const removeTicketType = (bi: number, ti: number) => { 
    const n = [...batches]; 
    if(n[bi].ticketTypes.length > 1) { 
      n[bi].ticketTypes.splice(ti, 1); 
      setBatches(n); 
    } 
  }

  const updateTicketTypeField = (bi: number, ti: number, f: keyof TicketType, v: any) => { 
    const n = [...batches]; 
    n[bi].ticketTypes[ti] = { ...n[bi].ticketTypes[ti], [f]: v }; 
    setBatches(n); 
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !eventRef || !isAtLeastEditor) return
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    try {
      const cat = categories?.find(c => c.id === selectedCategory)
      
      const finalBatches = recalculateBatches(batches)
      const totalCapacity = finalBatches.reduce((acc, b) => acc + (b.capacidadeInicial || 0), 0)

      const eventData: any = {
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        date: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory,
        categoryName: cat?.name || "Outros",
        noTickets,
        capacidadeTotal: totalCapacity,
        ticketMode: noTickets ? 'none' : ticketMode,
        isFree: noTickets ? true : (ticketMode === 'free'),
        batches: noTickets ? [] : finalBatches,
        address, image: uploadedImageUrl || event.image || "", 
        updatedAt: serverTimestamp()
      }

      await updateDoc(eventRef, eventData)
      toast({ title: "Evento Atualizado!", description: "Lotes recalculados com base na migração de capacidade." }); 
      router.push("/dashboard/organizacoes")
    } catch (err: any) { 
      toast({ variant: "destructive", title: "Erro ao salvar" }) 
    } finally { 
      setSaving(false) 
    }
  }

  if (eventLoading || orgLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  const totalSum = batches.reduce((acc, b) => acc + (b.capacidadeInicial || 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <h1 className="text-3xl font-black italic tracking-tighter text-primary uppercase">Editar Evento</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
         <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="w-5 h-5 text-secondary" /> Capa do Evento</CardTitle></CardHeader>
            <CardContent>
               <div className="relative aspect-video rounded-2xl bg-muted overflow-hidden cursor-pointer group" onClick={() => document.getElementById('img-up')?.click()}>
                  {imagePreview ? <Image src={imagePreview} alt="Capa" fill className="object-cover" unoptimized /> : <div className="flex flex-col items-center justify-center h-full opacity-20"><Upload className="w-10 h-10 mb-2" /><p className="text-xs font-bold uppercase tracking-widest">Carregar Capa</p></div>}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                     <Camera className="text-white w-10 h-10" />
                  </div>
                  <input id="img-up" type="file" className="hidden" onChange={handleImageChange} />
               </div>
            </CardContent>
         </Card>

         <Card className="border-none shadow-sm rounded-[2rem]">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5 text-secondary" /> Informações Básicas</CardTitle></CardHeader>
            <CardContent className="space-y-6">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Título</Label><Input name="title" defaultValue={event.title} required className="rounded-xl h-11" /></div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent className="rounded-xl">{categories?.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Início</Label><Input name="startDate" type="datetime-local" defaultValue={event.date} className="rounded-xl h-11 text-xs" /></div>
                  <div className="space-y-2"><Label>Término</Label><Input name="endDate" type="datetime-local" defaultValue={event.endDate} className="rounded-xl h-11 text-xs" /></div>
               </div>
               <div className="space-y-2"><Label>Descrição</Label><Textarea name="description" defaultValue={event.description} className="min-h-[150px] rounded-xl border-dashed border-secondary/30" /></div>
            </CardContent>
         </Card>

        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Janelas de Venda (Lotes)</CardTitle>
                <div className="flex items-center gap-2"><Switch checked={noTickets} onCheckedChange={setNoTickets} /><Label className="text-xs font-bold text-muted-foreground uppercase">Desativar Ingressos</Label></div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase text-muted-foreground">Capacidade Total Evento</p>
                <p className="text-xl font-black text-primary">{totalSum} Lugares</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
             {noTickets ? <div className="py-12 text-center opacity-30"><XCircle className="w-10 h-10 mx-auto mb-2" /><p className="text-sm font-bold uppercase tracking-widest">Vendas Desativadas</p></div> : 
             (
               <React.Fragment>
                 {batches.map((batch, bi) => (
                   <div key={batch.id} className="p-6 rounded-[1.5rem] border-2 border-border bg-white space-y-6 relative overflow-hidden">
                      <div className="flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-3">
                           <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary font-black">#{bi+1}</div>
                           <h3 className="font-black italic uppercase text-primary text-xl">{batch.name}</h3>
                        </div>
                        <div className="flex gap-2">
                           <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase border-secondary text-secondary gap-1.5" onClick={() => { setDistributeBatchIdx(bi); setTotalToDistribute(batch.capacidadeInicial.toString()); setIsDistributeOpen(true); }}>
                              <Sparkles className="w-3 h-3" /> Distribuir Meia
                           </Button>
                           <Button type="button" variant="ghost" size="icon" className="text-destructive rounded-full" onClick={() => removeBatch(bi)} disabled={batches.length === 1}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                         <div className="md:col-span-2 space-y-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase opacity-60">Nome da Janela (Lote)</Label>
                              <Input value={batch.name} onChange={e => updateBatchField(bi, 'name', e.target.value)} className="rounded-xl h-11" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Início</Label><Input type="datetime-local" value={batch.startDate} onChange={e => updateBatchField(bi, 'startDate', e.target.value)} className="rounded-xl h-10 text-[10px] px-2" /></div>
                               <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Fim</Label><Input type="datetime-local" value={batch.endDate} onChange={e => updateBatchField(bi, 'endDate', e.target.value)} className="rounded-xl h-10 text-[10px] px-2" /></div>
                            </div>
                         </div>

                         <div className="md:col-span-3 bg-muted/30 rounded-2xl p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="space-y-1">
                               <p className="text-[9px] font-black uppercase opacity-40">Carga Inicial</p>
                               <Input 
                                 type="number" 
                                 value={batch.capacidadeInicial} 
                                 onChange={e => updateBatchField(bi, 'capacidadeInicial', parseInt(e.target.value) || 0)} 
                                 className="h-10 text-lg font-black border-secondary/20 rounded-xl"
                               />
                            </div>
                            <div className="space-y-1">
                               <p className="text-[9px] font-black uppercase opacity-40">Migrado</p>
                               <div className="h-10 flex items-center font-bold text-secondary text-sm px-2 bg-white/50 rounded-xl">
                                  <ArrowDown className="w-3 h-3 mr-1" /> {batch.migradosDoLoteAnterior}
                               </div>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[9px] font-black uppercase opacity-40">Vendidos</p>
                               <div className="h-10 flex items-center font-black text-primary text-sm px-2 bg-white/50 rounded-xl">
                                  {batch.vendidos || 0}
                               </div>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[9px] font-black uppercase text-secondary">Carga Atual</p>
                               <div className="h-10 flex items-center font-black text-primary text-xl px-2 bg-secondary/5 rounded-xl border border-secondary/10">
                                  {batch.capacidadeAtual}
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <div className="flex items-center justify-between">
                           <Label className="text-[10px] font-black uppercase opacity-40">Categorias de Preço neste Lote</Label>
                         </div>
                         {batch.ticketTypes.map((t, ti) => (
                           <div key={t.id} className="p-4 bg-white rounded-2xl border shadow-sm grid grid-cols-12 gap-4 items-end transition-all hover:border-secondary/20">
                              <div className="col-span-5 space-y-2">
                                 <Label className="text-[9px] uppercase font-black opacity-40">Título do Ingresso</Label>
                                 <Input value={t.name} onChange={e => updateTicketTypeField(bi, ti, 'name', e.target.value)} className="rounded-xl h-10 font-bold" />
                              </div>
                              <div className="col-span-4 space-y-2">
                                 <Label className="text-[9px] uppercase font-black opacity-40">Preço Base (R$)</Label>
                                 <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black opacity-40">R$</span>
                                    <Input type="number" step="0.01" value={t.price} onChange={e => updateTicketTypeField(bi, ti, 'price', parseFloat(e.target.value) || 0)} className="rounded-xl h-10 font-black pl-8 text-primary" />
                                 </div>
                              </div>
                              <div className="col-span-3 flex justify-end pb-1">
                                 <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeTicketType(bi, ti)} disabled={batch.ticketTypes.length === 1}><Trash2 className="w-4 h-4" /></Button>
                              </div>
                              {t.poolId && (
                                <div className="col-span-12">
                                   <Badge variant="secondary" className="text-[7px] h-4 uppercase gap-1 bg-secondary/5 text-secondary border-none"><Layers className="w-2.5 h-2.5" /> {t.poolName}</Badge>
                                </div>
                              )}
                           </div>
                         ))}
                         <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl text-[9px] font-black uppercase gap-1.5 border-dashed" onClick={() => addTicketType(bi)}><Plus className="w-3.5 h-3.5" /> Adicionar Categoria Manual</Button>
                      </div>

                      {bi < batches.length - 1 && (
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20">
                           <div className="bg-secondary text-white p-1 rounded-full shadow-lg">
                              <ArrowDown className="w-4 h-4" />
                           </div>
                        </div>
                      )}
                   </div>
                 ))}
                 
                 <Button type="button" variant="outline" className="w-full h-16 rounded-2xl border-dashed border-2 font-black uppercase italic text-muted-foreground hover:text-secondary hover:border-secondary transition-all" onClick={addBatch}>
                   <Plus className="w-6 h-6 mr-2" /> Adicionar Próxima Janela de Venda
                 </Button>

                 <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
                    <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                    <div className="space-y-1">
                       <p className="text-[10px] font-black uppercase text-secondary">Lógica de Migração Ativa</p>
                       <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                         O que não for vendido em uma janela será automaticamente transferido para a próxima. A capacidade total do evento é a soma de todas as cargas iniciais definidas acima.
                       </p>
                    </div>
                 </div>
               </React.Fragment>
             )}
          </CardContent>
        </Card>

         <Button type="submit" disabled={saving} className="w-full h-16 rounded-[2rem] bg-secondary text-white font-black text-xl shadow-xl uppercase italic hover:scale-[1.02] transition-transform">
            {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 w-6 h-6" />}
            Salvar Alterações de Lote
         </Button>
      </form>

      <Dialog open={isDistributeOpen} onOpenChange={setIsDistributeOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Gerar Meia-Entrada</DialogTitle>
            <DialogDescription>O sistema criará as cotas de meia-entrada baseadas na carga do lote.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
             <Label className="text-[10px] font-black uppercase opacity-60">Carga Inicial deste Lote</Label>
             <Input 
               type="number" 
               placeholder="Ex: 200"
               value={totalToDistribute} 
               onChange={e => setTotalToDistribute(e.target.value)} 
               className="h-14 text-2xl font-black rounded-xl text-center border-secondary/20" 
             />
             <div className="p-4 bg-muted/30 rounded-2xl flex gap-3">
                <Info className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                <p className="text-[9px] font-bold text-muted-foreground uppercase leading-tight">
                  As variações de Meia (Estudante, PCD, Idoso) compartilharão o mesmo estoque de 40% deste lote.
                </p>
             </div>
          </div>
          <DialogFooter>
            <Button onClick={handleDistribute} disabled={!totalToDistribute} className="w-full bg-secondary text-white font-black h-12 rounded-xl shadow-lg uppercase italic">Confirmar Carga</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
