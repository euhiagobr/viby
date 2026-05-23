
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useFirebaseApp, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, query, where, getDocs, limit, deleteField, updateDoc } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "@/hooks/use-toast"
import { 
  Loader2, 
  ArrowLeft, 
  Plus, 
  Check, 
  X, 
  Upload, 
  Building2,
  Globe,
  Camera,
  MapPin,
  Phone,
  Mail,
  Instagram,
  Fingerprint,
  Info,
  Ticket,
  Sparkles,
  Layers,
  Users,
  AtSign
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

export default function NovoEventoPage() {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg, userRole, loading: orgLoading, refreshOrg } = useCurrentOrganization()

  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app, "gs://viby");
  }, [app])

  const categoriesQuery = useMemoFirebase(() => db ? collection(db, "categories") : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  
  const [selectedCategory, setSelectedCategory] = useState("")
  const [ticketMode, setTicketMode] = useState<'free' | 'paid_single' | 'batches'>('free')
  const [batches, setBatches] = useState<Batch[]>([
    { 
      id: crypto.randomUUID(),
      name: "Grátis", 
      description: "", 
      startDate: "", 
      endDate: "", 
      ticketTypes: [
        { id: crypto.randomUUID(), name: "Entrada Franca", price: 0, quantity: 100, requiresProof: false, isLegalHalf: false, description: "" }
      ] 
    }
  ])

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

  useEffect(() => {
    if (!orgLoading && (!currentOrg || !isAtLeastEditor)) {
      toast({ variant: "destructive", title: "Acesso Restrito" })
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
      const storageRef = ref(storage, `events/${user.uid}/${fileName}`)
      const uploadTask = uploadBytesResumable(storageRef, file)
      uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), () => setUploadProgress(null), async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
        setUploadedImageUrl(downloadURL)
        setUploadProgress(null)
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
        setCoOrganizers(prev => [...prev, { id: orgSnap.id, ...orgData }])
        setSearchUsername("")
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Busca falhou", description: error.message })
    } finally {
      setIsSearching(false)
    }
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

    const newBatches = [...batches]
    newBatches[distributeBatchIdx].ticketTypes = newTypes
    setBatches(newBatches)
    setIsDistributeOpen(false)
    setTotalToDistribute("")
    toast({ title: "Ingressos distribuídos!", description: "Meia-entrada configurada como estoque compartilhado (40%)." })
  }

  const addBatch = () => setBatches([...batches, { id: crypto.randomUUID(), name: `Lote ${batches.length + 1}`, description: "", startDate: "", endDate: "", ticketTypes: [{ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 50, requiresProof: false, isLegalHalf: false, description: "" }] }])
  const removeBatch = (i: number) => setBatches(batches.filter((_, idx) => idx !== i))
  const updateBatchField = (i: number, f: keyof Batch, v: any) => { const n = [...batches]; n[i] = { ...n[i], [f]: v }; setBatches(n); }
  const addTicketType = (bi: number) => { const n = [...batches]; n[bi].ticketTypes.push({ id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 50, requiresProof: false, isLegalHalf: false, description: "" }); setBatches(n); }
  const removeTicketType = (bi: number, ti: number) => { const n = [...batches]; if(n[bi].ticketTypes.length > 1) { n[bi].ticketTypes.splice(ti, 1); setBatches(n); } }
  
  const updateTicketTypeField = (bi: number, ti: number, f: keyof TicketType, v: any) => { 
    const n = [...batches]; n[bi].ticketTypes[ti] = { ...n[bi].ticketTypes[ti], [f]: v }; setBatches(n); 
  }

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
    if (!db || !user || !currentOrg || !isAtLeastEditor) return

    setLoading(true)
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
        ticketMode,
        isFree: ticketMode === 'free',
        batches: batches.map(b => ({
          ...b,
          ticketTypes: b.ticketTypes.map(t => ({ ...t, price: parseFloat(t.price as any) || 0, quantity: parseInt(t.quantity as any) || 0 }))
        })),
        address, 
        image: uploadedImageUrl || "",
        organizationId: currentOrg.id, 
        organizerId: user.uid,
        organizer: {
          name: currentOrg.name,
          username: currentOrg.username,
          avatar: currentOrg.avatar || "",
          isVerified: currentOrg.verified || false
        },
        status: "Ativo", 
        city: address.city, 
        createdAt: serverTimestamp()
      }

      const docRef = await addDoc(collection(db, "events"), eventData)

      for (const org of coOrganizers) {
        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 24)

        const partnerRef = doc(db, 'events', docRef.id, 'partners', org.id)
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
          inviterOrgName: currentOrg.name
        })

        if (org.contactEmail) {
          await sendPartnerInvitationEmail({
            to: org.contactEmail,
            inviterOrgName: currentOrg.name,
            eventTitle: eventData.title
          })
        }
      }

      if (currentOrg.status !== 'Ativo') {
        await updateDoc(doc(db, 'organizations', currentOrg.id), {
          status: 'Ativo',
          deletionScheduledAt: deleteField(),
          updatedAt: serverTimestamp()
        });
        await refreshOrg();
      }

      toast({ title: "Evento Publicado!" })
      router.push("/dashboard/organizacoes")
    } catch (error: any) { 
      toast({ variant: "destructive", title: "Erro ao publicar", description: error.message }) 
    } finally { 
      setLoading(false) 
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary uppercase italic">Nova Organização</h1>
          <p className="text-muted-foreground font-medium">Configure a identidade comercial da sua produtora ou marca.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="border-none shadow-sm overflow-hidden rounded-[2rem]">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg flex items-center gap-2">
               <Camera className="w-5 h-5 text-secondary" /> Identidade Visual
            </CardTitle>
            <CardDescription>Carregue as imagens que representarão sua marca na plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative">
              <div 
                className="relative h-48 bg-muted border-b border-border group cursor-pointer overflow-hidden"
                onClick={() => document.getElementById('org-banner')?.click()}
              >
                {formData.banner ? (
                  <Image src={formData.banner} alt="Banner" fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-40">
                    <Upload className="w-10 h-10 mb-2" />
                    <p className="text-xs font-black uppercase tracking-widest">Carregar Foto de Capa</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="text-white w-8 h-8" />
                </div>
                {bannerUploadProgress !== null && <Progress value={bannerUploadProgress} className="absolute bottom-0 left-0 right-0 h-1 rounded-none" />}
                <input id="org-banner" type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'banner')} />
              </div>

              <div className="absolute -bottom-10 left-8">
                <div className="relative group">
                  <Avatar className="h-28 w-28 border-4 border-background shadow-xl">
                    <AvatarImage src={formData.avatar} className="object-cover" />
                    <AvatarFallback className="bg-muted">
                      <Building2 className="w-10 h-10 text-muted-foreground opacity-20" />
                    </AvatarFallback>
                  </Avatar>
                  <label htmlFor="org-avatar" className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="w-6 h-6" />
                  </label>
                  <input id="org-avatar" type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'avatar')} />
                  {avatarUploadProgress !== null && <Progress value={avatarUploadProgress} className="absolute -bottom-2 left-0 right-0 h-1" />}
                </div>
              </div>
            </div>
            <div className="h-12" />
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader>
             <CardTitle className="text-lg flex items-center gap-2"><Info className="w-5 h-5 text-secondary" /> Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest opacity-60">Nome Comercial</Label>
                  <Input 
                    id="name" 
                    placeholder="Ex: Viby Entretenimento" 
                    value={formData.name}
                    onChange={handleNameChange}
                    required 
                    className="rounded-xl h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-[10px] font-black uppercase tracking-widest opacity-60">Username exclusivo (@)</Label>
                  <div className="relative">
                    <Input 
                      id="username" 
                      placeholder="Somente letras e números" 
                      value={formData.username}
                      onChange={e => setFormData(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "") }))}
                      className={cn(
                        "rounded-xl h-11",
                        usernameStatus === 'valid' ? 'border-green-500 pr-10' : 
                        usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-destructive pr-10' : 'pr-10'
                      )}
                      required
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checkingUsername ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : 
                       usernameStatus === 'valid' ? <Check className="w-4 h-4 text-green-500" /> : 
                       usernameStatus === 'taken' || usernameStatus === 'invalid' ? <X className="w-4 h-4 text-destructive" /> : null}
                    </div>
                  </div>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase">Mínimo 5 caracteres. viby.club/{formData.username || '...'}</p>
                </div>
             </div>

             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Tipo de Organização</Label>
                <Select value={formData.type} onValueChange={val => setFormData(prev => ({ ...prev, type: val }))} required>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue placeholder="Selecione o segmento" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] rounded-xl shadow-2xl border-none">
                    {ORG_TYPES.map((group) => (
                      <SelectGroup key={group.category}>
                        <SelectLabel className="bg-muted/50 py-2 px-3 text-[10px] font-black uppercase text-muted-foreground">{group.category}</SelectLabel>
                        {group.items.map((item) => (
                          <SelectItem key={item} value={item} className="text-xs font-bold">{item}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
             </div>

             <div className="space-y-2">
                <Label htmlFor="bio" className="text-[10px] font-black uppercase tracking-widest opacity-60">Bio / Descrição</Label>
                <Textarea 
                  id="bio" 
                  placeholder="Conte um pouco sobre o que vocês fazem... (Use ** para negrito e emojis!)" 
                  value={formData.bio}
                  onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  className="min-h-[100px] resize-none rounded-xl border-dashed border-secondary/30"
                />
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader>
             <CardTitle className="text-lg flex items-center gap-2"><Fingerprint className="w-5 h-5 text-secondary" /> Dados Jurídicos</CardTitle>
             <CardDescription>O preenchimento do CNPJ e Razão Social é obrigatório para conformidade.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="legalName" className="text-[10px] font-black uppercase tracking-widest opacity-60">Razão Social (Obrigatório)</Label>
                  <Input 
                    id="legalName" 
                    value={formData.legalName}
                    onChange={e => setFormData(prev => ({ ...prev, legalName: e.target.value }))}
                    placeholder="Nome oficial da empresa" 
                    className="rounded-xl h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj" className="text-[10px] font-black uppercase tracking-widest opacity-60">CNPJ (Obrigatório)</Label>
                  <Input 
                    id="cnpj" 
                    value={formData.cnpj}
                    onChange={e => {
                      const numbers = e.target.value.replace(/\D/g, "");
                      let formatted = numbers;
                      if (numbers.length > 2) formatted = numbers.substring(0, 2) + "." + numbers.substring(2);
                      if (numbers.length > 5) formatted = formatted.substring(0, 6) + "." + numbers.substring(5);
                      if (numbers.length > 8) formatted = formatted.substring(0, 10) + "/" + numbers.substring(8);
                      if (numbers.length > 12) formatted = formatted.substring(0, 15) + "-" + numbers.substring(12);
                      setFormData(prev => ({ ...prev, cnpj: formatted.substring(0, 18) }))
                    }}
                    placeholder="00.000.000/0000-00" 
                    className="rounded-xl h-11"
                    required
                  />
                </div>
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader>
             <CardTitle className="text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-secondary" /> Endereço Sede</CardTitle>
             <CardDescription>O endereço é obrigatório. Use os controles para ocultar dados sensíveis no perfil público.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="cep" className="text-[10px] font-black uppercase tracking-widest opacity-60">CEP</Label>
                  <Input 
                    id="cep" 
                    value={formData.cep}
                    onChange={e => setFormData(prev => ({ ...prev, cep: e.target.value.replace(/\D/g, "").substring(0, 8) }))}
                    onBlur={handleCepBlur}
                    placeholder="00000-000" 
                    required
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="md:col-span-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="street" className="text-[10px] font-black uppercase tracking-widest opacity-60">Logradouro</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold uppercase opacity-40">{formData.showAddress ? 'Público' : 'Oculto'}</span>
                      <Switch checked={formData.showAddress} onCheckedChange={v => setFormData({...formData, showAddress: v})} />
                    </div>
                  </div>
                  <Input id="street" value={formData.street} onChange={e => setFormData(prev => ({ ...prev, street: e.target.value }))} required className="rounded-xl h-11" />
                </div>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="number" className="text-[10px] font-black uppercase tracking-widest opacity-60">Número</Label>
                  <Input id="number" value={formData.number} onChange={e => setFormData(prev => ({ ...prev, number: e.target.value }))} required className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complement" className="text-[10px] font-black uppercase tracking-widest opacity-60">Complemento</Label>
                  <Input id="complement" value={formData.complement} onChange={e => setFormData(prev => ({ ...prev, complement: e.target.value }))} className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="neighborhood" className="text-[10px] font-black uppercase tracking-widest opacity-60">Bairro</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold uppercase opacity-40">{formData.showNeighborhood ? 'Público' : 'Oculto'}</span>
                      <Switch checked={formData.showNeighborhood} onCheckedChange={v => setFormData({...formData, showNeighborhood: v})} />
                    </div>
                  </div>
                  <Input id="neighborhood" value={formData.neighborhood} onChange={e => setFormData(prev => ({ ...prev, neighborhood: e.target.value }))} required className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="city" className="text-[10px] font-black uppercase tracking-widest opacity-60">Cidade / UF</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold uppercase opacity-40">{formData.showState ? 'Público' : 'Oculto'}</span>
                      <Switch checked={formData.showState} onCheckedChange={v => setFormData({...formData, showState: v})} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input id="city" value={formData.city} readOnly required className="rounded-xl h-11 bg-muted/30" />
                    <Input id="state" value={formData.state} readOnly required className="rounded-xl h-11 bg-muted/30 w-16" />
                  </div>
                </div>
             </div>
             <p className="text-[10px] text-muted-foreground font-medium italic">Se ocultar o endereço, apenas a Cidade, Estado e País aparecerão no seu perfil público.</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader>
             <CardTitle className="text-lg flex items-center gap-2"><Globe className="w-5 h-5 text-secondary" /> Contato & Presença Digital</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Phone className="w-3 h-3" /> WhatsApp Comercial</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold uppercase opacity-40">{formData.showPhone ? 'Público' : 'Oculto'}</span>
                      <Switch checked={formData.showPhone} onCheckedChange={checked => setFormData(prev => ({ ...prev, showPhone: checked }))} />
                    </div>
                  </div>
                  <Input 
                    id="phone" 
                    value={formData.phone}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(00) 00000-0000" 
                    className="rounded-xl h-11"
                  />
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="contactEmail" className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Mail className="w-3 h-3" /> E-mail para Contato</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold uppercase opacity-40">{formData.showEmail ? 'Público' : 'Oculto'}</span>
                      <Switch checked={formData.showEmail} onCheckedChange={checked => setFormData(prev => ({ ...prev, showEmail: checked }))} />
                    </div>
                  </div>
                  <Input 
                    id="contactEmail" 
                    type="email"
                    value={formData.contactEmail}
                    onChange={e => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                    placeholder="contato@empresa.com" 
                    className="rounded-xl h-11"
                  />
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="website" className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Globe className="w-3 h-3" /> Site Oficial</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold uppercase opacity-40">{formData.showWebsite ? 'Público' : 'Oculto'}</span>
                      <Switch checked={formData.showWebsite} onCheckedChange={checked => setFormData(prev => ({ ...prev, showWebsite: checked }))} />
                    </div>
                  </div>
                  <Input 
                    id="website" 
                    value={formData.website}
                    onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://www.empresa.com" 
                    className="rounded-xl h-11"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="instagram" className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Instagram className="w-3 h-3" /> Instagram (@)</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold uppercase opacity-40">{formData.showInstagram ? 'Público' : 'Oculto'}</span>
                      <Switch checked={formData.showInstagram} onCheckedChange={checked => setFormData(prev => ({ ...prev, showInstagram: checked }))} />
                    </div>
                  </div>
                  <Input 
                    id="instagram" 
                    value={formData.instagram}
                    onChange={e => setFormData(prev => ({ ...prev, instagram: e.target.value.replace("@", "") }))}
                    placeholder="usuario_da_marca" 
                    className="rounded-xl h-11"
                  />
                </div>
             </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" asChild className="rounded-xl px-8 font-bold text-muted-foreground">
            <Link href="/dashboard/organizacoes">Cancelar</Link>
          </Button>
          <Button 
            type="submit" 
            className="bg-primary text-white hover:bg-primary/90 px-12 h-14 rounded-2xl font-black shadow-xl shadow-primary/20 uppercase italic transition-all hover:scale-[1.02]" 
            disabled={loading || usernameStatus !== 'valid'}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
            Criar Organização
          </Button>
        </div>
      </form>
    </div>
  )
}
