
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
  Ticket,
  Sparkles
} from "lucide-react"
import Link from "next/link"
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

  const [cep, setCep] = useState("")
  const [address, setAddress] = useState({ street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "" })
  
  const [isDistributeOpen, setIsDistributeOpen] = useState(false)
  const [distributeBatchIdx, setDistributeBatchIdx] = useState<number | null>(null)
  const [totalToDistribute, setTotalToDistribute] = useState("")

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

  useEffect(() => {
    if (event) {
      setSelectedCategory(event.categoryId || event.category || "")
      setTicketMode(event.ticketMode || (event.isFree ? 'free' : 'batches'))
      setBatches(event.batches || [])
      setCep(event.cep || "")
      setAddress(event.address || { street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "" })
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
    toast({ title: "Distribuído!" })
  }

  const addBatch = () => setBatches([...batches, { id: crypto.randomUUID(), name: `Lote ${batches.length + 1}`, description: "", startDate: "", endDate: "", ticketTypes: [{ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 50, requiresProof: false, isLegalHalf: false, description: "" }] }])
  const removeBatch = (i: number) => setBatches(batches.filter((_, idx) => idx !== i))
  const updateBatchField = (i: number, f: keyof Batch, v: any) => { const n = [...batches]; n[i] = { ...n[i], [f]: v }; setBatches(n); }
  const addTicketType = (bi: number) => { const n = [...batches]; n[bi].ticketTypes.push({ id: crypto.randomUUID(), name: "Novo Tipo", price: 0, quantity: 0, requiresProof: false, isLegalHalf: false, description: "" }); setBatches(n); }
  const removeTicketType = (bi: number, ti: number) => { const n = [...batches]; if(n[bi].ticketTypes.length > 1) { n[bi].ticketTypes.splice(ti, 1); setBatches(n); } }
  const updateTicketTypeField = (bi: number, ti: number, f: keyof TicketType, v: any) => { const n = [...batches]; n[bi].ticketTypes[ti] = { ...n[bi].ticketTypes[ti], [f]: v }; setBatches(n); }

  const calculateHalfPriceStats = (batch: Batch) => {
    const pools: Record<string, number> = {}
    const ind = batch.ticketTypes.reduce((acc, t) => { if(t.poolId) { pools[t.poolId] = t.quantity; return acc; } return acc + (parseInt(t.quantity as any) || 0); }, 0)
    const total = ind + Object.values(pools).reduce((acc, q) => acc + q, 0)
    const legalHalf = batch.ticketTypes.filter(t => t.isLegalHalf).reduce((acc, t) => { if(t.poolId) return acc; return acc + (parseInt(t.quantity as any) || 0); }, 0) + Object.keys(pools).filter(pid => batch.ticketTypes.find(t => t.poolId === pid && t.isLegalHalf)).reduce((acc, pid) => acc + pools[pid], 0)
    return { total, legalHalf, percentage: total > 0 ? (legalHalf / total) * 100 : 0 }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !eventRef || !isAtLeastEditor) return
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    try {
      const cat = categories?.find(c => c.id === selectedCategory)
      await updateDoc(eventRef, {
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        date: formData.get("startDate") as string, 
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory, categoryName: cat?.name || "Outros",
        ticketMode, isFree: ticketMode === 'free',
        batches: batches.map(b => ({ ...b, ticketTypes: b.ticketTypes.map(t => ({ ...t, price: parseFloat(t.price as any) || 0, quantity: parseInt(t.quantity as any) || 0 })) })),
        address, image: uploadedImageUrl || event.image || "", city: address.city, updatedAt: serverTimestamp()
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
                           {!isFreeMode && <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase border-secondary text-secondary gap-1.5" onClick={() => { setDistributeBatchIdx(bi); setIsDistributeOpen(true); }}><Sparkles className="w-3 h-3" /> Distribuir</Button>}
                           {ticketMode === 'batches' && batches.length > 1 && <Button type="button" variant="ghost" size="icon" className="text-destructive rounded-full" onClick={() => removeBatch(bi)}><Trash2 className="w-4 h-4" /></Button>}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2"><Label className="text-[10px] uppercase opacity-60">Nome</Label><Input value={batch.name} onChange={e => updateBatchField(bi, 'name', e.target.value)} className="rounded-xl h-11" disabled={isFreeMode} /></div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label className="text-[10px] uppercase opacity-40">Início</Label><Input type="datetime-local" value={batch.startDate} onChange={e => updateBatchField(bi, 'startDate', e.target.value)} className="rounded-xl h-11 text-xs" /></div>
                            <div className="space-y-2"><Label className="text-[10px] uppercase opacity-40">Fim</Label><Input type="datetime-local" value={batch.endDate} onChange={e => updateBatchField(bi, 'endDate', e.target.value)} className="rounded-xl h-11 text-xs" /></div>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <div className="flex items-center justify-between border-b pb-2"><h4 className="text-xs font-black uppercase text-muted-foreground">Tipos</h4>{!isFreeMode && <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase" onClick={() => addTicketType(bi)}>Adicionar Tipo</Button>}</div>
                         <div className="space-y-3">
                            {batch.ticketTypes.map((t, ti) => (
                              <div key={t.id} className="p-4 bg-white rounded-2xl border shadow-sm space-y-4">
                                 <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                    <div className="md:col-span-4 space-y-2">
                                       <Label className="text-[10px] font-black uppercase opacity-40">Nome</Label>
                                       <div className="flex flex-col gap-1"><Input value={t.name} onChange={e => updateTicketTypeField(bi, ti, 'name', e.target.value)} className="rounded-xl h-10 font-bold" />{t.poolName && <span className="text-[8px] font-black text-secondary uppercase">Pool: {t.poolName}</span>}</div>
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                       <Label className="text-[10px] font-black uppercase opacity-40">Qtd {t.poolId && "(Pool)"}</Label>
                                       <Input type="number" value={t.quantity} onChange={e => { const val = e.target.value; if(t.poolId) { const n = [...batches]; n[bi].ticketTypes.forEach((item, idx) => { if(item.poolId === t.poolId) n[bi].ticketTypes[idx].quantity = parseInt(val as any) || 0 }); setBatches(n); } else { updateTicketTypeField(bi, ti, 'quantity', val); } }} className="rounded-xl h-10 font-black" />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                       <Label className="text-[10px] font-black uppercase opacity-40">Valor (R$)</Label>
                                       <Input type="number" step="0.01" value={t.price} onChange={e => updateTicketTypeField(bi, ti, 'price', e.target.value)} className="rounded-xl h-10 font-black text-secondary" disabled={isFreeMode} />
                                    </div>
                                    <div className="md:col-span-3 flex items-center justify-around pb-2">
                                       <div className="flex flex-col items-center gap-1"><Switch checked={t.isLegalHalf} onCheckedChange={v => updateTicketTypeField(bi, ti, 'isLegalHalf', v)} disabled={isFreeMode} /><span className="text-[8px] font-black uppercase">Meia</span></div>
                                       <div className="flex flex-col items-center gap-1"><Switch checked={t.requiresProof} onCheckedChange={v => updateTicketTypeField(bi, ti, 'requiresProof', v)} /><span className="text-[8px] font-black uppercase">Doc.</span></div>
                                    </div>
                                    <div className="md:col-span-1 flex justify-end pb-1">{!isFreeMode && batch.ticketTypes.length > 1 && <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeTicketType(bi, ti)}><Trash2 className="w-4 h-4" /></Button>}</div>
                                 </div>
                              </div>
                            ))}
                         </div>
                      </div>

                      <div className={cn("p-5 bg-white rounded-3xl border shadow-inner space-y-4", stats.percentage < 40 ? "border-orange-200" : "border-green-200")}>
                         <div className="flex justify-between items-center">
                            <div className="space-y-1">
                               <div className="flex items-center gap-2"><Info className="w-4 h-4 text-secondary" /><h5 className="text-[10px] font-black uppercase text-primary">Conformidade</h5></div>
                               <p className="text-[9px] text-muted-foreground font-medium">Recomenda-se 40% para Meia Legal.</p>
                            </div>
                            <p className={cn("text-xl font-black italic", stats.percentage < 40 ? "text-orange-500" : "text-green-600")}>{stats.percentage.toFixed(1)}%</p>
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
            <DialogDescription>Quantidade total (60% Inteira / 40% Meia Compartilhada).</DialogDescription>
          </DialogHeader>
          <div className="py-6"><Input type="number" placeholder="Total, ex: 200" value={totalToDistribute} onChange={e => setTotalToDistribute(e.target.value)} className="h-14 text-2xl font-black rounded-xl text-center" /></div>
          <DialogFooter><Button onClick={handleDistribute} className="w-full bg-secondary text-white font-black h-12 rounded-xl">Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
