
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useFirebaseApp, useCollection, useMemoFirebase } from "@/firebase"
import { 
  updateDoc, 
  doc, 
  collection, 
  serverTimestamp, 
  deleteField, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  deleteDoc,
  orderBy,
  getDoc
} from "firebase/firestore"
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
  InfoIcon,
  Layout,
  Armchair,
  Grid3X3,
  Map as MapIcon,
  Percent,
  Clock,
  Settings2,
  Handshake,
  Search,
  CheckCircle2,
  AtSign
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"

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
  vendidos: number
  restantes: number
  migradosDoLoteAnterior: number
  ticketTypes: TicketType[]
  isHalfPriceEnabled?: boolean
  halfPricePercent?: number
}

interface SectorWithBatches {
  id: string
  name: string
  capacity: number
  batches: Batch[]
}

export default function EditarEventoPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg } = useCurrentOrganization()

  const eventRef = React.useMemo(() => (db && eventId) ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const storage = React.useMemo(() => app ? getStorage(app, "gs://viby") : null, [app])
  
  const categoriesQuery = useMemoFirebase(() => db ? query(collection(db, "categories"), orderBy("name", "asc")) : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const partnersQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null;
    return collection(db, 'events', eventId, 'partners');
  }, [db, eventId]);
  const { data: partners } = useCollection<any>(partnersQuery);

  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  
  const [selectedCategory, setSelectedCategory] = useState("")
  const [ticketMode, setTicketMode] = useState<'none' | 'free' | 'paid_single' | 'batches' | 'sector_batches'>('none')
  const [mapMode, setMapMode] = useState<'none' | 'setores' | 'assentos' | 'mesas'>('none')
  
  const [address, setAddress] = useState({ street: "", neighborhood: "", city: "", state: "", country: "Brasil", number: "", complement: "", cep: "" })

  // --- Parcerias ---
  const [searchPartner, setSearchPartner] = useState("")
  const [isSearchingPartner, setIsSearchingPartner] = useState(false)
  const [foundPartner, setFoundPartner] = useState<any>(null)

  // --- Valor Único ---
  const [singleCapacity, setSingleCapacity] = useState<number>(100)
  const [singleSalesStart, setSingleSalesStart] = useState("")
  const [singleSalesEnd, setSingleSalesEnd] = useState("")
  const [isHalfPriceEnabled, setIsHalfPriceEnabled] = useState(false)
  const [halfPricePercent, setHalfPricePercent] = useState(40)
  const [isPercentDialogOpen, setIsPercentDialogOpen] = useState(false)
  const [singleTicketTypes, setSingleTicketTypes] = useState<TicketType[]>([
    { id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }
  ])

  // --- Lotes Globais ---
  const [totalBatchCapacity, setTotalBatchCapacity] = useState<number>(500)
  const [batches, setBatches] = useState<Batch[]>([])

  // --- Setores e Lotes ---
  const [sectorsWithBatches, setSectorsWithBatches] = useState<SectorWithBatches[]>([])

  const [isBatchPercentDialogOpen, setIsBatchPercentDialogOpen] = useState(false)
  const [activeBatchIdx, setActiveBatchIdx] = useState<{ sectorIdx?: number, batchIdx: number } | null>(null)
  const [tempBatchPercent, setTempBatchPercent] = useState(40)
  
  // --- Gratuito ---
  const [freeCapacity, setFreeCapacity] = useState<number>(100)

  useEffect(() => {
    if (event) {
      setSelectedCategory(event.categoryId || "")
      setTicketMode(event.ticketMode || 'none')
      setMapMode(event.mapMode || 'none')
      setImagePreview(event.image || null)
      if (event.address) setAddress({ ...address, ...event.address })

      if (event.ticketMode === 'batches') {
        setBatches(event.batches || [])
        setTotalBatchCapacity(event.capacidadeTotal || 500)
      } else if (event.ticketMode === 'sector_batches') {
        setSectorsWithBatches(event.sectors || [])
      } else if (event.ticketMode === 'paid_single' && event.batches?.length > 0) {
        const b = event.batches[0];
        setSingleCapacity(b.capacidadeInicial || 100);
        setSingleSalesStart(b.startDate || "");
        setSingleSalesEnd(b.endDate || "");
        setSingleTicketTypes(b.ticketTypes || []);
        if (b.ticketTypes?.length > 1) {
          setIsHalfPriceEnabled(true);
        }
      } else if (event.ticketMode === 'free' && event.batches?.length > 0) {
        const b = event.batches[0];
        setFreeCapacity(b.capacidadeInicial || 100);
      }
    }
  }, [event])

  const handleLookupPartner = async () => {
    if (!db || !searchPartner) return
    setIsSearchingPartner(true)
    setFoundPartner(null)
    try {
      const usernameRef = doc(db, "usernames", searchPartner.toLowerCase().replace('@', '').trim())
      const usernameSnap = await getDoc(usernameRef)
      if (usernameSnap.exists()) {
        const { uid, type } = usernameSnap.data()
        if (type === 'organization') {
          const orgSnap = await getDoc(doc(db, "organizations", uid))
          if (orgSnap.exists()) {
            setFoundPartner({ id: orgSnap.id, ...orgSnap.data() })
          }
        }
      } else {
        toast({ variant: "destructive", title: "Organização não encontrada" })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na busca" })
    } finally {
      setIsSearchingPartner(false)
    }
  }

  const handleInvitePartner = async () => {
    if (!db || !foundPartner || !eventId || !event) return
    try {
      const partnerRef = doc(db, "events", eventId, "partners", foundPartner.id)
      await setDoc(partnerRef, {
        orgId: foundPartner.id,
        orgName: foundPartner.name,
        username: foundPartner.username,
        avatar: foundPartner.avatar || "",
        status: "pending",
        invitedAt: serverTimestamp(),
        inviterOrgId: event.organizationId,
        inviterOrgName: event.organizer?.name || "Organizador",
        eventTitle: event.title
      })
      toast({ title: "Convite enviado!", description: `Aguardando aceite de ${foundPartner.name}.` })
      setFoundPartner(null)
      setSearchPartner("")
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao convidar" })
    }
  }

  const handleRemovePartner = async (partnerId: string) => {
    if (!db || !eventId) return
    try {
      await deleteDoc(doc(db, "events", eventId, "partners", partnerId))
      toast({ title: "Parceria removida" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao remover" })
    }
  }

  const handleEnableHalfPrice = (percent: number) => {
    setHalfPricePercent(percent);
    setIsHalfPriceEnabled(true);
    const poolId = crypto.randomUUID();
    const halfQty = Math.floor(singleCapacity * (percent / 100));

    const defaultMeias: TicketType[] = [
      { id: crypto.randomUUID(), name: "Meia Estudante", price: (singleTicketTypes[0]?.price || 0) / 2, quantity: halfQty, poolId, poolName: "Cota Meia-Entrada", requiresProof: true, isLegalHalf: true, description: "" },
      { id: crypto.randomUUID(), name: "Meia PCD", price: (singleTicketTypes[0]?.price || 0) / 2, quantity: halfQty, poolId, poolName: "Cota Meia-Entrada", requiresProof: true, isLegalHalf: true, description: "" },
      { id: crypto.randomUUID(), name: "Meia Idoso", price: (singleTicketTypes[0]?.price || 0) / 2, quantity: halfQty, poolId, poolName: "Cota Meia-Entrada", requiresProof: true, isLegalHalf: true, description: "" }
    ];

    setSingleTicketTypes([
      { ...singleTicketTypes[0], quantity: singleCapacity },
      ...defaultMeias
    ]);
    setIsPercentDialogOpen(false);
  }

  const handleEnableBatchHalfPrice = () => {
    if (activeBatchIdx === null) return;
    const percent = tempBatchPercent;
    
    if (activeBatchIdx.sectorIdx !== undefined) {
      const sIdx = activeBatchIdx.sectorIdx;
      const bIdx = activeBatchIdx.batchIdx;
      const newSectors = [...sectorsWithBatches];
      const sector = newSectors[sIdx];
      const batch = sector.batches[bIdx];
      const poolId = crypto.randomUUID();
      const halfQty = Math.floor(batch.capacidadeInicial * (percent / 100));
      const currentInteiraPrice = batch.ticketTypes[0]?.price || 100;

      newSectors[sIdx].batches[bIdx].ticketTypes = [
        { ...batch.ticketTypes[0], quantity: batch.capacidadeInicial },
        { id: crypto.randomUUID(), name: "Meia Estudante", price: currentInteiraPrice / 2, quantity: halfQty, poolId, poolName: "Cota Setor", requiresProof: true, isLegalHalf: true, description: "" },
        { id: crypto.randomUUID(), name: "Meia PCD", price: currentInteiraPrice / 2, quantity: halfQty, poolId, poolName: "Cota Setor", requiresProof: true, isLegalHalf: true, description: "" }
      ];
      newSectors[sIdx].batches[bIdx].isHalfPriceEnabled = true;
      newSectors[sIdx].batches[bIdx].halfPricePercent = percent;
      setSectorsWithBatches(newSectors);
    } else {
      const bIdx = activeBatchIdx.batchIdx;
      const n = [...batches];
      const batch = n[bIdx];
      const poolId = crypto.randomUUID();
      const halfQty = Math.floor(batch.capacidadeInicial * (percent / 100));
      const currentInteiraPrice = batch.ticketTypes[0]?.price || 100;

      n[bIdx].ticketTypes = [
        { ...batch.ticketTypes[0], quantity: batch.capacidadeInicial },
        { id: crypto.randomUUID(), name: "Meia Estudante", price: currentInteiraPrice / 2, quantity: halfQty, poolId, poolName: "Cota Lote", requiresProof: true, isLegalHalf: true, description: "" },
        { id: crypto.randomUUID(), name: "Meia PCD", price: currentInteiraPrice / 2, quantity: halfQty, poolId, poolName: "Cota Lote", requiresProof: true, isLegalHalf: true, description: "" }
      ];
      n[bIdx].isHalfPriceEnabled = true;
      n[bIdx].halfPricePercent = percent;
      setBatches(n);
    }
    
    setIsBatchPercentDialogOpen(false);
    setActiveBatchIdx(null);
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return
    setImagePreview(URL.createObjectURL(file))
    setUploadProgress(0)
    const storageRef = ref(storage, `events/${user.uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`)
    const uploadTask = uploadBytesResumable(storageRef, file)
    uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), () => setUploadProgress(null), async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref)
      setUploadedImageUrl(url); setUploadProgress(null)
    })
  }

  const handleCepBlur = async () => {
    if (!address.cep) return;
    const cleanCep = address.cep.replace(/\D/g, "")
    if (cleanCep.length !== 8) return
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await response.json()
      if (!data.erro) {
        setAddress(prev => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state
        }))
      } else {
        toast({ variant: "destructive", title: "CEP não encontrado" })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao buscar endereço" })
    }
  }

  const addSector = () => {
    setSectorsWithBatches([...sectorsWithBatches, {
      id: crypto.randomUUID(),
      name: `Novo Setor ${sectorsWithBatches.length + 1}`,
      capacity: 100,
      batches: [{ 
        id: crypto.randomUUID(),
        name: "Lote 1", 
        startDate: "", 
        endDate: "", 
        capacidadeInicial: 100,
        capacidadeAtual: 100,
        vendidos: 0,
        restantes: 100,
        migradosDoLoteAnterior: 0,
        ticketTypes: [{ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }],
        isHalfPriceEnabled: false,
        halfPricePercent: 40
      }]
    }])
  }

  const removeSector = (i: number) => {
    if(sectorsWithBatches.length > 1) setSectorsWithBatches(sectorsWithBatches.filter((_, idx) => idx !== i))
  }

  const updateSectorField = (i: number, f: keyof SectorWithBatches, v: any) => {
    const n = [...sectorsWithBatches];
    n[i] = { ...n[i], [f]: v } as any;
    setSectorsWithBatches(n);
  }

  const addBatchToSector = (si: number) => {
    const n = [...sectorsWithBatches];
    const newB: Batch = { 
      id: crypto.randomUUID(), 
      name: `Lote ${n[si].batches.length + 1}`, 
      startDate: "", 
      endDate: "", 
      capacidadeInicial: 50, 
      capacidadeAtual: 50,
      vendidos: 0,
      restantes: 50,
      migradosDoLoteAnterior: 0,
      ticketTypes: [{ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 50, requiresProof: false, isLegalHalf: false, description: "" }],
      isHalfPriceEnabled: false,
      halfPricePercent: 40
    }
    n[si].batches.push(newB);
    setSectorsWithBatches(n);
  }

  const removeBatchFromSector = (si: number, bi: number) => {
    const n = [...sectorsWithBatches];
    if(n[si].batches.length > 1) {
      n[si].batches = n[si].batches.filter((_, idx) => idx !== bi);
      setSectorsWithBatches(n);
    }
  }

  const updateBatchInSectorField = (si: number, bi: number, f: keyof Batch, v: any) => {
    const n = [...sectorsWithBatches];
    n[si].batches[bi] = { ...n[si].batches[bi], [f]: v } as any;
    if (f === 'capacidadeInicial') {
      const cap = parseInt(v) || 0;
      if (n[si].batches[bi].ticketTypes[0]) n[si].batches[bi].ticketTypes[0].quantity = cap;
      
      if (n[si].batches[bi].isHalfPriceEnabled) {
        const hPercent = n[si].batches[bi].halfPricePercent || 40;
        const hQty = Math.floor(cap * (hPercent / 100));
        for (let j = 1; j < n[si].batches[bi].ticketTypes.length; j++) { 
          n[si].batches[bi].ticketTypes[j].quantity = hQty; 
        }
      }
    }
    setSectorsWithBatches(n);
  }

  const updateTicketTypeInSectorField = (si: number, bi: number, ti: number, f: string, v: any) => {
    const n = [...sectorsWithBatches];
    n[si].batches[bi].ticketTypes[ti] = { ...n[si].batches[bi].ticketTypes[ti], [f]: v };
    setSectorsWithBatches(n);
  }

  const addTicketTypeToSector = (si: number, bi: number) => {
    const n = [...sectorsWithBatches];
    const b = n[si].batches[bi];
    const poolId = b.isHalfPriceEnabled ? (b.ticketTypes[1]?.poolId || crypto.randomUUID()) : undefined;
    const poolName = b.isHalfPriceEnabled ? "Cota Setor" : undefined;
    const qty = b.isHalfPriceEnabled ? (b.ticketTypes[1]?.quantity || 0) : b.capacidadeInicial;

    n[si].batches[bi].ticketTypes.push({ id: crypto.randomUUID(), name: "Nova Meia", price: 50, quantity: qty, poolId, poolName, requiresProof: true, isLegalHalf: true, description: "" }); 
    setSectorsWithBatches(n);
  }

  const addBatch = () => {
    const newB: Batch = {
      id: crypto.randomUUID(),
      name: `${batches.length + 1}º Lote`,
      startDate: "",
      endDate: "",
      capacidadeInicial: 100,
      capacidadeAtual: 100,
      vendidos: 0,
      restantes: 100,
      migradosDoLoteAnterior: 0,
      ticketTypes: [{ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }],
      isHalfPriceEnabled: false,
      halfPricePercent: 40
    }
    setBatches([...batches, newB])
  }

  const removeBatch = (i: number) => {
    if(batches.length > 1) setBatches(batches.filter((_, idx) => idx !== i))
  }

  const updateBatchField = (i: number, f: keyof Batch, v: any) => { 
    const n = [...batches]; 
    n[i] = { ...n[i], [f]: v } as any; 
    
    if (f === 'capacidadeInicial') {
      const cap = parseInt(v) || 0;
      if (n[i].ticketTypes[0]) n[i].ticketTypes[0].quantity = cap;

      if (n[i].isHalfPriceEnabled) {
        const hPercent = n[i].halfPricePercent || 40;
        const hQty = Math.floor(cap * (hPercent / 100));
        for (let j = 1; j < n[i].ticketTypes.length; j++) { 
          n[i].ticketTypes[j].quantity = hQty; 
        }
      }
    }
    setBatches(n); 
  }

  const updateTicketTypeField = (bi: number, ti: number, f: string, v: any) => { 
    const n = [...batches]; 
    n[bi].ticketTypes[ti] = { ...n[bi].ticketTypes[ti], [f]: v }; 
    setBatches(n); 
  }

  const addTicketType = (bi: number) => { 
    const n = [...batches]; 
    const poolId = n[bi].isHalfPriceEnabled ? (n[bi].ticketTypes[1]?.poolId || crypto.randomUUID()) : undefined;
    const poolName = n[bi].isHalfPriceEnabled ? "Cota Lote" : undefined;
    const qty = n[bi].isHalfPriceEnabled ? (n[bi].ticketTypes[1]?.quantity || 0) : n[bi].capacidadeInicial;

    n[bi].ticketTypes.push({ id: crypto.randomUUID(), name: "Nova Meia", price: 50, quantity: qty, poolId, poolName, requiresProof: true, isLegalHalf: true, description: "" }); 
    setBatches(n); 
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !eventRef || !currentOrg) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      const cat = categories?.find(c => c.id === selectedCategory)
      
      let finalBatches: any[] = []
      let finalSectors: any[] = []
      let totalCapacity = 0

      if (ticketMode === 'free') {
        totalCapacity = freeCapacity
        finalBatches = [{
          id: 'free',
          name: 'Ingresso Gratuito',
          capacidadeInicial: freeCapacity,
          capacidadeAtual: freeCapacity,
          ticketTypes: [{ id: 'free_type', name: 'Gratuito', price: 0, quantity: freeCapacity, requiresProof: false, isLegalHalf: false, description: '' }]
        }]
      } else if (ticketMode === 'paid_single') {
        totalCapacity = singleCapacity
        finalBatches = [{
          id: 'single',
          name: 'Lote Único',
          startDate: singleSalesStart,
          endDate: singleSalesEnd,
          capacidadeInicial: singleCapacity,
          capacidadeAtual: singleCapacity,
          ticketTypes: singleTicketTypes
        }]
      } else if (ticketMode === 'batches') {
        finalBatches = batches;
        totalCapacity = totalBatchCapacity;
      } else if (ticketMode === 'sector_batches') {
        finalSectors = sectorsWithBatches;
        totalCapacity = sectorsWithBatches.reduce((acc, s) => acc + s.capacity, 0);
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
        batches: ticketMode === 'sector_batches' ? [] : finalBatches,
        sectors: finalSectors,
        address,
        image: uploadedImageUrl || event.image || "",
        organizer: {
          id: currentOrg.id,
          name: currentOrg.name,
          username: currentOrg.username,
          avatar: currentOrg.avatar || "",
          isVerified: currentOrg.verified || false
        },
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

  const supportsMap = ['paid_single', 'batches', 'sector_batches'].includes(ticketMode);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 text-foreground">
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
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {categories?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Início</Label><Input name="startDate" type="datetime-local" defaultValue={event.date} required className="rounded-xl h-11 text-xs" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Fim</Label><Input name="endDate" type="datetime-local" defaultValue={event.endDate} required className="rounded-xl h-11 text-xs" /></div>
             </div>
             <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Descrição</Label><Textarea name="description" defaultValue={event.description} className="min-h-[120px] rounded-xl" required /></div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-secondary" /> Localização</CardTitle></CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                   <Label htmlFor="cep" className="text-[10px] font-black uppercase tracking-widest opacity-60">CEP</Label>
                   <Input value={address.cep} onChange={e => setAddress({...address, cep: e.target.value})} onBlur={handleCepBlur} placeholder="00000-000" className="rounded-xl h-11" />
                </div>
                <div className="md:col-span-3 space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Rua</Label><Input value={address.street} onChange={e => setAddress({...address, street: e.target.value})} className="rounded-xl h-11" /></div>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Número</Label><Input value={address.number} onChange={e => setAddress({...address, number: e.target.value})} className="rounded-xl h-11" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Complemento</Label><Input value={address.complement} onChange={e => setAddress({...address, complement: e.target.value})} className="rounded-xl h-11" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Bairro</Label><Input value={address.neighborhood} onChange={e => setAddress({...address, neighborhood: e.target.value})} className="rounded-xl h-11" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cidade</Label><Input value={address.city} readOnly className="rounded-xl h-11 bg-muted/30" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">UF</Label><Input value={address.state} readOnly className="rounded-xl h-11 bg-muted/30 w-16" /></div>
             </div>
          </CardContent>
        </Card>

        {/* --- CO-PRODUTORES (PARCERIAS) --- */}
        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2"><Handshake className="w-5 h-5 text-secondary" /> Co-realização</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl font-bold gap-1.5 uppercase text-[10px] h-9 border-dashed">
                    <Plus className="w-3.5 h-3.5" /> Convidar Parceiro
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md rounded-[2.5rem]">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Buscar Organização</DialogTitle>
                    <DialogDescription>Convide outra marca para figurar como produtora deste evento.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    <div className="flex gap-2">
                       <div className="relative flex-1">
                          <Input 
                            placeholder="username da marca" 
                            value={searchPartner} 
                            onChange={e => setSearchPartner(e.target.value.toLowerCase())}
                            className="rounded-xl pl-9 h-12"
                          />
                          <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                       </div>
                       <Button onClick={handleLookupPartner} disabled={isSearchingPartner} className="h-12 rounded-xl px-6 bg-secondary text-white font-bold">
                          {isSearchingPartner ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                       </Button>
                    </div>

                    {foundPartner && (
                      <div className="p-6 bg-muted/30 rounded-3xl border border-dashed flex items-center justify-between animate-in zoom-in-95">
                         <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                               <AvatarImage src={foundPartner.avatar} />
                               <AvatarFallback>{foundPartner.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="space-y-0.5">
                               <p className="font-black text-sm uppercase italic tracking-tight">{foundPartner.name}</p>
                               <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">@{foundPartner.username}</p>
                            </div>
                         </div>
                         <Button onClick={handleInvitePartner} className="bg-primary text-white font-black uppercase text-[10px] italic rounded-xl px-6">Convidar</Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <CardDescription>Organizações convidadas que figurarão como organizadoras.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             {partners && partners.length > 0 ? (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {partners.map((p: any) => (
                   <div key={p.id} className="p-4 bg-muted/20 rounded-2xl border border-border/50 flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                         <Avatar className="h-8 w-8">
                            <AvatarImage src={p.avatar} />
                            <AvatarFallback>{p.orgName?.charAt(0)}</AvatarFallback>
                         </Avatar>
                         <div className="flex flex-col">
                            <span className="font-bold text-xs">{p.orgName}</span>
                            <Badge variant="ghost" className="h-4 p-0 text-[8px] font-black uppercase text-secondary">
                               {p.status === 'accepted' ? 'Aceito' : 'Pendente'}
                            </Badge>
                         </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemovePartner(p.id)}>
                         <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="py-10 text-center border-2 border-dashed border-border/40 rounded-[1.5rem] opacity-30">
                  <Handshake className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Sem parceiros vinculados</p>
               </div>
             )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1"><CardTitle className="text-lg flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria</CardTitle></div>
              <div className="bg-white p-1 rounded-xl border flex flex-wrap gap-1">
                {['none', 'free', 'paid_single', 'batches', 'sector_batches'].map((mode: any) => (
                  <Button key={mode} type="button" variant={ticketMode === mode ? 'secondary' : 'ghost'} size="sm" className="rounded-lg text-[10px] font-black uppercase px-4" onClick={() => setTicketMode(mode)}>
                    {mode === 'none' ? 'Sem Ingresso' : mode === 'free' ? 'Grátis' : mode === 'paid_single' ? 'Valor Único' : mode === 'batches' ? 'Lotes' : 'Setor e Lote'}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            {ticketMode === 'none' && (
              <div className="py-12 text-center space-y-4">
                <InfoIcon className="w-12 h-12 mx-auto text-muted-foreground opacity-20" />
                <p className="text-sm font-bold text-muted-foreground uppercase">Esse evento não terá controle de entrada</p>
              </div>
            )}

            {ticketMode === 'free' && (
               <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="p-6 bg-muted/20 rounded-2xl border-2 border-dashed border-border flex flex-col items-center gap-4">
                     <Label className="text-xs font-black uppercase tracking-widest">Quantidade de Ingressos Gratuitos</Label>
                     <Input type="number" value={freeCapacity} onChange={e => setFreeCapacity(parseInt(e.target.value) || 0)} className="h-14 text-2xl font-black rounded-xl text-center border-secondary/20 max-w-[200px]" />
                  </div>
               </div>
            )}

            {/* Configuração de Mapa */}
            {supportsMap && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-6 border-b border-dashed pb-8 mb-8">
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <MapIcon className="w-4 h-4 text-secondary" /> Estrutura do Evento (Mapa)
                  </h3>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Habilite o mapa para permitir seleção de assentos ou visualização de setores.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'none', label: 'Sem Mapa', icon: X, desc: 'Lista simples' },
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

                {mapMode !== 'none' && (
                  <div className="pt-2 animate-in zoom-in-95 duration-300">
                    <Button asChild variant="outline" className="w-full h-12 rounded-xl border-secondary text-secondary font-black uppercase italic gap-3 shadow-lg hover:bg-secondary hover:text-white transition-all">
                      <Link href={`/dashboard/evento/${eventId}/mapa`}>
                        <Settings2 className="w-4 h-4" />
                        Editar Planta e Locais no Mapa
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {ticketMode === 'paid_single' && (
               <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="p-8 bg-muted/20 rounded-[2rem] border-2 border-dashed border-border space-y-6">
                     <div className="flex flex-col items-center gap-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-secondary">Capacidade do Evento</Label>
                        <Input 
                          type="number" 
                          value={singleCapacity} 
                          onChange={e => setSingleCapacity(parseInt(e.target.value) || 0)} 
                          className="h-14 text-3xl font-black rounded-xl text-center border-secondary/20 max-w-[200px] bg-white" 
                     />
                     </div>
                     
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Início das Vendas</Label>
                           <Input type="datetime-local" value={singleSalesStart} onChange={e => setSingleSalesStart(e.target.value)} className="rounded-xl h-11 text-xs bg-white" />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Fim das Vendas</Label>
                           <Input type="datetime-local" value={singleSalesEnd} onChange={e => setSingleSalesEnd(e.target.value)} className="rounded-xl h-11 text-xs bg-white" />
                        </div>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Ingresso Principal</h3>
                     <div className="p-6 bg-white rounded-3xl border shadow-sm grid grid-cols-12 gap-6 items-end">
                        <div className="col-span-5 space-y-2">
                           <Label className="text-[9px] uppercase font-black opacity-40 ml-1">Nome do Ingresso</Label>
                           <Input value={singleTicketTypes[0]?.name || ""} onChange={e => { const n = [...singleTicketTypes]; n[0].name = e.target.value; setSingleTicketTypes(n); }} className="rounded-xl h-12 font-bold" />
                        </div>
                        <div className="col-span-3 space-y-2">
                           <Label className="text-[9px] uppercase font-black opacity-40 ml-1">Quantidade</Label>
                           <Input value={singleTicketTypes[0]?.quantity || 0} readOnly className="rounded-xl h-12 font-black bg-muted/30" />
                        </div>
                        <div className="col-span-4 space-y-2">
                           <Label className="text-[9px] uppercase font-black opacity-40 ml-1">Valor (R$)</Label>
                           <Input type="number" step="0.01" value={singleTicketTypes[0]?.price || 0} onChange={e => { const n = [...singleTicketTypes]; n[0].price = parseFloat(e.target.value) || 0; setSingleTicketTypes(n); }} className="rounded-xl h-12 font-black text-secondary" />
                        </div>
                     </div>
                  </div>

                  <div className="flex justify-center">
                     <Button 
                       type="button" 
                       variant={isHalfPriceEnabled ? "secondary" : "outline"} 
                       className="rounded-full px-8 h-12 font-black uppercase italic text-xs gap-2 transition-all"
                       onClick={() => setIsPercentDialogOpen(true)}
                     >
                        <Sparkles className="w-4 h-4" />
                        {isHalfPriceEnabled ? "Ajustar Meia-Entrada" : "Habilitar Meia-Entrada"}
                     </Button>
                  </div>

                  {isHalfPriceEnabled && (
                    <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                       <div className="flex items-center justify-between px-2">
                          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Categorias de Meia-Entrada ({halfPricePercent}%)</h3>
                          <Badge variant="outline" className="rounded-lg text-[10px] font-black uppercase border-secondary text-secondary">Cota: {Math.floor(singleCapacity * (halfPricePercent / 100))} Ingressos</Badge>
                       </div>
                       
                       <div className="space-y-3">
                          {singleTicketTypes.slice(1).map((t, idx) => {
                            const ti = idx + 1;
                            return (
                              <div key={t.id} className="p-5 bg-white rounded-[1.5rem] border shadow-sm grid grid-cols-12 gap-6 items-center hover:border-secondary/20 transition-all">
                                 <div className="col-span-4 space-y-1">
                                    <Label className="text-[9px] uppercase font-black opacity-40">Categoria</Label>
                                    <Input value={t.name} onChange={e => { const n = [...singleTicketTypes]; n[ti].name = e.target.value; setSingleTicketTypes(n); }} className="rounded-xl h-10 font-bold border-none bg-muted/20" />
                                 </div>
                                 <div className="col-span-2 space-y-1">
                                    <Label className="text-[9px] uppercase font-black opacity-40">Quantidade</Label>
                                    <div className="h-10 flex items-center font-black text-xs px-3 bg-muted/20 rounded-xl">Pool: {t.quantity}</div>
                                 </div>
                                 <div className="col-span-3 space-y-1">
                                    <Label className="text-[9px] uppercase font-black opacity-40">Valor (R$)</Label>
                                    <Input type="number" step="0.01" value={t.price} onChange={e => { const n = [...singleTicketTypes]; n[ti].price = parseFloat(e.target.value) || 0; setSingleTicketTypes(n); }} className="rounded-xl h-10 font-black text-secondary" />
                                 </div>
                                 <div className="col-span-2 flex flex-col items-center gap-1">
                                    <Label className="text-[8px] uppercase font-black opacity-40">Obrigatório</Label>
                                    <Switch checked={t.requiresProof} onCheckedChange={v => { const n = [...singleTicketTypes]; n[ti].requiresProof = v; setSingleTicketTypes(n); }} />
                                 </div>
                                 <div className="col-span-1 flex justify-end">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-full hover:bg-destructive/10" onClick={() => setSingleTicketTypes(singleTicketTypes.filter((_, i) => i !== ti))}>
                                       <Trash2 className="w-4 h-4" />
                                    </Button>
                                 </div>
                              </div>
                            )
                          })}
                          <Button 
                             type="button" 
                             variant="ghost" 
                             size="sm" 
                             className="text-secondary font-black uppercase text-[10px] gap-2 ml-2"
                             onClick={() => setSingleTicketTypes([...singleTicketTypes, { id: crypto.randomUUID(), name: "Nova Meia", price: (singleTicketTypes[0]?.price || 0) / 2, quantity: Math.floor(singleCapacity * (halfPricePercent / 100)), poolId: singleTicketTypes[1]?.poolId || crypto.randomUUID(), poolName: "Cota Meia-Entrada", requiresProof: true, isLegalHalf: true, description: "" }])}
                          >
                             <Plus className="w-4 h-4" /> Adicionar Categoria
                          </Button>
                       </div>
                    </div>
                  )}
               </div>
            )}

            {ticketMode === 'batches' && (
              <div className="space-y-10 animate-in fade-in duration-500">
                <div className="p-8 bg-muted/20 rounded-[2rem] border-2 border-dashed border-border space-y-4 text-center">
                   <Label className="text-sm font-black uppercase tracking-widest text-primary">Capacidade Total do Local</Label>
                   <Input 
                      type="number" 
                      value={totalBatchCapacity} 
                      onChange={e => setTotalBatchCapacity(parseInt(e.target.value) || 0)} 
                      className="h-16 text-4xl font-black rounded-2xl text-center border-secondary/20 max-w-[250px] mx-auto bg-white" 
                   />
                </div>

                {batches.map((batch, bi) => (
                  <div key={batch.id} className="p-6 rounded-[2rem] border-2 bg-muted/10 space-y-6 relative overflow-hidden">
                     <div className="flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-3">
                           <h3 className="font-black italic uppercase text-secondary text-xl">{batch.name}</h3>
                           <Badge variant="outline" className="text-[10px] font-bold uppercase">{batch.capacidadeInicial} Ingressos Iniciais</Badge>
                        </div>
                        <div className="flex gap-2">
                           <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase border-secondary text-secondary gap-1.5" onClick={() => { setActiveBatchIdx({ batchIdx: bi }); setTempBatchPercent(batch.halfPricePercent || 40); setIsBatchPercentDialogOpen(true); }}>
                              <Sparkles className="w-3 h-3" /> Gerar Meia
                           </Button>
                           <Button type="button" variant="ghost" size="icon" className="text-destructive rounded-full" onClick={() => removeBatch(bi)} disabled={batches.length === 1}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase opacity-60">Carga da Etapa</Label>
                           <Input type="number" value={batch.capacidadeInicial} onChange={e => updateBatchField(bi, 'capacidadeInicial', parseInt(e.target.value) || 0)} className="rounded-xl h-11 font-black text-primary" />
                         </div>
                        <div className="md:col-span-3 space-y-2">
                            <Label className="text-[10px] font-black uppercase opacity-60">Nome da Janela de Venda</Label>
                            <Input value={batch.name} onChange={e => updateBatchField(bi, 'name', e.target.value)} className="rounded-xl h-11" />
                         </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <Label className="text-[9px] font-black uppercase opacity-60 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Início das Vendas</Label>
                           <Input type="datetime-local" value={batch.startDate} onChange={e => updateBatchField(bi, 'startDate', e.target.value)} className="h-10 text-xs rounded-xl" />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[9px] font-black uppercase opacity-60 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Fim das Vendas</Label>
                           <Input type="datetime-local" value={batch.endDate} onChange={e => updateBatchField(bi, 'endDate', e.target.value)} className="h-10 text-xs rounded-xl" />
                        </div>
                     </div>

                     <div className="space-y-6 pt-4 border-t border-dashed border-border/40">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
                           <Ticket className="w-3.5 h-3.5" /> Ingressos do Lote</h4>
                        
                        <div className="p-6 bg-white rounded-3xl border shadow-sm grid grid-cols-12 gap-6 items-end">
                           <div className="col-span-5 space-y-2">
                              <Label className="text-[9px] uppercase font-black opacity-40 ml-1">Ingresso Principal</Label>
                              <Input value={batch.ticketTypes[0]?.name || ""} onChange={e => updateTicketTypeField(bi, 0, 'name', e.target.value)} className="rounded-xl h-11 font-bold" />
                           </div>
                           <div className="col-span-3 space-y-2">
                              <Label className="text-[9px] uppercase font-black opacity-40 ml-1">Quantidade</Label>
                              <Input value={batch.ticketTypes[0]?.quantity || 0} readOnly className="rounded-xl h-11 font-black bg-muted/30" />
                           </div>
                           <div className="col-span-4 space-y-2">
                              <Label className="text-[9px] uppercase font-black opacity-40 ml-1">Valor (R$)</Label>
                              <Input type="number" step="0.01" value={batch.ticketTypes[0]?.price || 0} onChange={e => updateTicketTypeField(bi, 0, 'price', parseFloat(e.target.value) || 0)} className="rounded-xl h-11 font-black text-secondary" />
                           </div>
                        </div>

                        {batch.isHalfPriceEnabled && (
                           <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                              <div className="flex items-center justify-between px-2">
                                 <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Categorias de Meia ({batch.halfPricePercent}%)</h3>
                                 <Badge variant="outline" className="rounded-lg text-[8px] font-black uppercase border-secondary text-secondary">Cota Lote: {Math.floor(batch.capacidadeInicial * ((batch.halfPricePercent || 40) / 100))} un.</Badge>
                              </div>
                              
                              <div className="space-y-3">
                                 {batch.ticketTypes.slice(1).map((t, ti_idx) => {
                                    const ti = ti_idx + 1;
                                    return (
                                       <div key={t.id} className="p-5 bg-white rounded-[1.5rem] border shadow-sm grid grid-cols-12 gap-4 items-center hover:border-secondary/20 transition-all">
                                          <div className="col-span-4 space-y-1">
                                             <Label className="text-[8px] uppercase font-black opacity-40">Categoria</Label>
                                             <Input value={t.name} onChange={e => updateTicketTypeField(bi, ti, 'name', e.target.value)} className="rounded-xl h-9 font-bold border-none bg-muted/20" />
                                          </div>
                                          <div className="col-span-2 space-y-1">
                                             <Label className="text-[8px] uppercase font-black opacity-40">Qtd</Label>
                                             <div className="h-9 flex items-center font-black text-[10px] px-2 bg-muted/20 rounded-xl">Pool: {t.quantity}</div>
                                          </div>
                                          <div className="col-span-3 space-y-1">
                                             <Label className="text-[8px] uppercase font-black opacity-40">Valor (R$)</Label>
                                             <Input type="number" step="0.01" value={t.price} onChange={e => updateTicketTypeField(bi, ti, 'price', parseFloat(e.target.value) || 0)} className="rounded-xl h-9 font-black text-secondary" />
                                          </div>
                                          <div className="col-span-2 flex flex-col items-center gap-1">
                                             <Label className="text-[7px] uppercase font-black opacity-40">Doc.</Label>
                                             <Switch checked={t.requiresProof} onCheckedChange={v => updateTicketTypeField(bi, ti, 'requiresProof', v)} />
                                          </div>
                                          <div className="col-span-1 flex justify-end">
                                             <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive rounded-full" onClick={() => { const n = [...batches]; n[bi].ticketTypes.splice(ti,1); setBatches(n); }}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                             </Button>
                                          </div>
                                       </div>
                                    )
                                 })}
                                 <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-secondary font-black uppercase text-[9px] gap-2 ml-1"
                                    onClick={() => addTicketType(bi)}
                                 >
                                    <Plus className="w-3.5 h-3.5" /> Adicionar Meia
                                 </Button>
                              </div>
                           </div>
                        )}
                     </div>
                  </div>
                ))}
                <Button type="button" variant="outline" className="w-full h-14 rounded-2xl border-dashed font-black uppercase italic" onClick={addBatch}><Plus className="w-5 h-5 mr-2" /> Adicionar Lote</Button>
              </div>
            )}

            {ticketMode === 'sector_batches' && (
              <div className="space-y-10 animate-in fade-in duration-500">
                {sectorsWithBatches.map((sector, si) => (
                  <div key={sector.id} className="p-8 rounded-[2.5rem] border-2 border-primary/20 bg-white space-y-8 relative">
                    <div className="flex justify-between items-center">
                       <div className="flex-1 max-w-md space-y-2">
                          <Label className="text-[10px] font-black uppercase opacity-60">Nome do Setor</Label>
                          <Input value={sector.name} onChange={e => updateSectorField(si, 'name', e.target.value)} className="rounded-xl h-11 font-black text-primary" placeholder="Ex: Plateia Baixa" />
                       </div>
                       <div className="w-40 space-y-2 ml-4">
                          <Label className="text-[10px] font-black uppercase opacity-60">Capacidade</Label>
                          <Input type="number" value={sector.capacity} onChange={e => updateSectorField(si, 'capacity', parseInt(e.target.value) || 0)} className="rounded-xl h-11 font-black text-secondary" />
                       </div>
                       <Button type="button" variant="ghost" size="icon" className="text-destructive ml-4" onClick={() => removeSector(si)} disabled={sectorsWithBatches.length === 1}><Trash2 className="w-5 h-5" /></Button>
                    </div>

                    <div className="space-y-6">
                       {sector.batches.map((batch, bi) => (
                         <div key={batch.id} className="p-6 rounded-[2rem] border-2 bg-muted/5 space-y-6 relative">
                            <div className="flex justify-between items-center">
                               <div className="flex items-center gap-3">
                                  <h5 className="font-black italic uppercase text-secondary text-lg">{batch.name}</h5>
                                  <Badge variant="outline" className="text-[9px] font-bold uppercase">{batch.capacidadeInicial} Ingressos</Badge>
                               </div>
                               <div className="flex gap-2">
                                  <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase border-secondary text-secondary gap-1.5" onClick={() => { setActiveBatchIdx({ sectorIdx: si, batchIdx: bi }); setTempBatchPercent(batch.halfPricePercent || 40); setIsBatchPercentDialogOpen(true); }}>
                                     <Sparkles className="w-3 h-3" /> Gerar Meia
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" className="text-destructive rounded-full" onClick={() => removeBatchFromSector(si, bi)} disabled={sector.batches.length === 1}><Trash2 className="w-4 h-4" /></Button>
                               </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-60">Nome da Janela</Label><Input value={batch.name} onChange={e => updateBatchInSectorField(si, bi, 'name', e.target.value)} className="rounded-xl h-10" /></div>
                               <div className="space-y-2"><Label className="text-[9px] font-black uppercase opacity-60">Carga do Lote</Label><Input type="number" value={batch.capacidadeInicial} onChange={e => updateBatchInSectorField(si, bi, 'capacidadeInicial', parseInt(e.target.value) || 0)} className="rounded-xl h-10 font-bold" /></div>
                            </div>
                            <div className="space-y-4 pt-4 border-t border-dashed">
                               {batch.ticketTypes.map((t, ti) => (
                                 <div key={t.id} className="p-4 bg-white rounded-2xl border shadow-sm grid grid-cols-12 gap-4 items-center">
                                    <div className="col-span-5 space-y-1">
                                       <Label className="text-[8px] font-black uppercase opacity-40">Ingresso</Label>
                                       <Input value={t.name} onChange={e => updateTicketTypeInSectorField(si, bi, ti, 'name', e.target.value)} className="rounded-lg h-9 font-bold" />
                                    </div>
                                    <div className="col-span-3 space-y-1">
                                       <Label className="text-[8px] font-black uppercase opacity-40">Valor (R$)</Label>
                                       <Input type="number" step="0.01" value={t.price} onChange={e => updateTicketTypeInSectorField(si, bi, ti, 'price', parseFloat(e.target.value) || 0)} className="rounded-lg h-9 font-black text-secondary" />
                                    </div>
                                    <div className="col-span-2 flex justify-end pt-3">
                                       {ti > 0 && <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { const n = [...sectorsWithBatches]; n[si].batches[bi].ticketTypes.splice(ti,1); setSectorsWithBatches(n); }}><Trash2 className="w-3 h-3" /></Button>}
                                    </div>
                                 </div>
                               ))}
                               <Button type="button" variant="ghost" size="sm" className="text-secondary font-black uppercase text-[9px] gap-2" onClick={() => addTicketTypeToSector(si, bi)}><Plus className="w-3.5 h-3.5" /> Adicionar Categoria ao Lote</Button>
                            </div>
                         </div>
                       ))}
                       <Button type="button" variant="outline" className="w-full h-12 rounded-xl border-dashed font-bold uppercase text-[10px]" onClick={() => addBatchToSector(si)}><Plus className="w-4 h-4 mr-2" /> Adicionar Lote ao Setor</Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" className="w-full h-16 rounded-[2rem] border-dashed font-black uppercase italic" onClick={addSector}><Plus className="w-6 h-6 mr-2" /> Criar Novo Setor</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading} className="w-full h-16 bg-secondary text-white font-black h-16 rounded-[2rem] shadow-xl uppercase italic">
          {loading ? <Loader2 className="animate-spin mr-2" /> : "Salvar Alterações"}
        </Button>
      </form>

      {/* DIALOGS DE CONFIGURAÇÃO */}
      <Dialog open={isPercentDialogOpen} onOpenChange={setIsPercentDialogOpen}>
         <DialogContent className="max-w-sm rounded-[2.5rem]">
            <DialogHeader>
               <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center mb-2 mx-auto text-secondary">
                  <Percent className="w-6 h-6" />
               </div>
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center">Meia-Entrada Automática</DialogTitle>
               <DialogDescription className="text-center font-medium">Qual a porcentagem da capacidade total você deseja reservar para meia-entrada?</DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-6">
               <div className="relative">
                  <Input type="number" value={halfPricePercent} onChange={e => setHalfPricePercent(parseInt(e.target.value) || 0)} className="h-20 text-5xl font-black text-center rounded-[1.5rem] border-secondary/20" />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-black text-muted-foreground opacity-30">%</span>
               </div>
            </div>
            <DialogFooter><Button onClick={() => handleEnableHalfPrice(halfPricePercent)} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">Configurar Cota</Button></DialogFooter>
         </DialogContent>
      </Dialog>

      <Dialog open={isBatchPercentDialogOpen} onOpenChange={setIsBatchPercentDialogOpen}>
         <DialogContent className="max-w-sm rounded-[2.5rem]">
            <DialogHeader>
               <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center mb-2 mx-auto text-secondary">
                  <Percent className="w-6 h-6" />
               </div>
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center">Meia por Lote</DialogTitle>
               <DialogDescription className="text-center font-medium">Defina a porcentagem de cota de meia-entrada para este lote específico.</DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
               <div className="relative">
                  <Input type="number" value={tempBatchPercent} onChange={e => setTempBatchPercent(parseInt(e.target.value) || 0)} className="h-20 text-5xl font-black text-center rounded-[1.5rem] border-secondary/20" />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-black text-muted-foreground opacity-30">%</span>
               </div>
            </div>
            <DialogFooter><Button onClick={handleEnableBatchHalfPrice} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">Confirmar Cota</Button></DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  )
}
