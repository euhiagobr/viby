
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useFirebaseApp, useDoc } from "@/firebase"
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
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
  Info
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import Image from "next/image"

const ORG_TYPES = [
  {
    category: "Arte, Cultura e Entretenimento",
    items: ["Produtora de Eventos", "Casa Noturna", "Bar", "Pub", "Festival", "Coletivo Cultural", "Companhia Artística", "Banda", "DJ", "Artista", "Músico(a)", "Escola de Dança", "Teatro", "Cinema", "Centro Cultural", "Galeria de Arte", "Estúdio Criativo"]
  },
  {
    category: "Beleza, Moda e Lifestyle",
    items: ["Salão de Beleza", "Barbearia", "Clínica de Estética", "Estilista", "Marca de Moda", "Loja de Roupas", "Loja Vintage", "Estúdio de Tatuagem", "Spa", "Makeup Studio", "Agência de Modelos", "Fashion Brand"]
  },
  {
    category: "Gastronomia",
    items: ["Restaurante", "Cafeteria", "Hamburgueria", "Food Truck", "Buffet", "Confeitaria", "Pizzaria", "Vinícola", "Cervejaria", "Adega", "Bar de Drinks", "Chef", "Cozinha Autorais"]
  },
  {
    category: "Empresas e Negócios",
    items: ["Empresa", "Startup", "Agência de Marketing", "Agência Digital", "Coworking", "Consultoria", "Escritório", "Loja", "E-commerce", "Marca", "Franquia", "Empresa de Tecnologia"]
  },
  {
    category: "Saúde e Bem-estar",
    items: ["Academia", "Crossfit", "Estúdio de Yoga", "Clínica", "Psicologia", "Nutrição", "Personal Trainer", "Espaço Terapêutico"]
  },
  {
    category: "Educação e Desenvolvimento",
    items: ["Escola", "Universidade", "Curso", "Escola de Idiomas", "Escola Técnica", "Projeto Educacional", "Mentor(a)", "Palestrante", "Centro de Treinamento"]
  },
  {
    category: "Turismo e Hospitalidade",
    items: ["Hotel", "Hostel", "Pousada", "Agência de Turismo", "Parque", "Resort", "Espaço de Eventos"]
  },
  {
    category: "Comunidade e Instituições",
    items: ["ONG", "Associação", "Coletivo", "Fundação", "Organização Social", "Instituição Pública", "Prefeitura", "Secretaria", "Câmara Municipal", "Projeto Social", "Igreja", "Organização Religiosa", "Centro Comunitário"]
  },
  {
    category: "Esporte e Comunidades",
    items: ["Clube", "Time", "Organização Esportiva", "Liga", "Atlética", "Grupo de Corrida", "Comunidade Gamer", "Equipe de E-sports"]
  },
  {
    category: "Tecnologia e Games",
    items: ["Estúdio de Jogos", "Comunidade Tech", "Empresa de Software", "Desenvolvedora", "Plataforma Digital", "Criador de Conteúdo", "Streamer", "Podcast"]
  },
  {
    category: "Comércio e Experiências",
    items: ["Shopping", "Feira", "Mercado", "Loja Geek", "Livraria", "Pet Shop", "Sex Shop", "Tabacaria", "Floricultura"]
  },
  {
    category: "Categoria Genérica",
    items: ["Outro"]
  }
]

export default function NovaOrganizacaoPage() {
  const router = useRouter()
  const auth = useAuth()
  const { user } = useUser(auth)
  const db = useFirestore()
  const app = useFirebaseApp()

  const blockedRef = React.useMemo(() => (db ? doc(db, 'settings', 'blocked_usernames') : null), [db]);
  const { data: blockedData } = useDoc<any>(blockedRef);

  const [loading, setLoading] = useState(false)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'valid' | 'invalid' | 'taken'>('idle')
  const [avatarUploadProgress, setAvatarUploadProgress] = useState<number | null>(null)
  const [bannerUploadProgress, setBannerUploadProgress] = useState<number | null>(null)
  
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    type: "",
    bio: "",
    avatar: "",
    banner: "",
    phone: "",
    contactEmail: "",
    website: "",
    instagram: "",
    cnpj: "",
    legalName: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    showPhone: true,
    showEmail: true,
    showWebsite: true,
    showInstagram: true
  })

  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app, 'gs://viby');
  }, [app])

  useEffect(() => {
    if (!db || !formData.username) {
      setUsernameStatus('idle')
      return
    }

    const newUsername = formData.username.toLowerCase().trim()
    const regex = /^[a-zA-Z0-9]+$/
    
    if (newUsername.length < 5 || !regex.test(newUsername)) {
      setUsernameStatus('invalid')
      return
    }

    if (blockedData?.list?.includes(newUsername)) {
      setUsernameStatus('taken')
      return
    }

    setCheckingUsername(true)
    const timer = setTimeout(async () => {
      try {
        const usernameRef = doc(db, "usernames", newUsername)
        const usernameSnap = await getDoc(usernameRef)
        setUsernameStatus(usernameSnap.exists() ? 'taken' : 'valid')
      } catch (e) {
        console.error(e)
      } finally {
        setCheckingUsername(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [formData.username, db, blockedData])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    const suggestedUsername = newName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 20);

    setFormData(prev => ({
      ...prev,
      name: newName,
      username: (prev.username === "" || prev.username === prev.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 20)) 
        ? suggestedUsername 
        : prev.username
    }));
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return

    const setProgress = type === 'avatar' ? setAvatarUploadProgress : setBannerUploadProgress
    setProgress(0)

    try {
      const fileName = `organizations/${type}s/${Date.now()}_${file.name}`
      const storageRef = ref(storage, fileName)
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on('state_changed', 
        (snapshot) => setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        () => { setProgress(null); toast({ variant: "destructive", title: "Erro no upload" }) },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setFormData(prev => ({ ...prev, [type]: downloadURL }))
          setProgress(null)
          toast({ title: `${type === 'avatar' ? 'Logo' : 'Capa'} carregada!` })
        }
      )
    } catch (err) { setProgress(null) }
  }

  const handleCepBlur = async () => {
    const cleanCep = formData.cep.replace(/\D/g, "")
    if (cleanCep.length !== 8) return
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await response.json()
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || ""
        }))
      }
    } catch (e) {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || usernameStatus !== 'valid') {
        toast({ variant: "destructive", title: "Username inválido", description: "Verifique a disponibilidade do nome de usuário." })
        return
    }

    setLoading(true)
    const orgId = crypto.randomUUID()
    const normalizedUsername = formData.username.toLowerCase().trim()

    try {
      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, "usernames", normalizedUsername)
        const orgRef = doc(db, "organizations", orgId)
        const memberRef = doc(db, "organizations", orgId, "members", user.uid)

        const usernameSnap = await transaction.get(usernameRef)
        if (usernameSnap.exists()) throw new Error("Username já ocupado.")

        transaction.set(usernameRef, { uid: orgId, type: 'organization' })

        transaction.set(orgRef, {
          id: orgId,
          ...formData,
          username: normalizedUsername,
          slug: normalizedUsername,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          verified: false,
          payoutSettings: { status: 'none' },
          status: 'Ativo'
        })

        transaction.set(memberRef, {
          userId: user.uid,
          role: 'owner',
          status: 'accepted',
          createdAt: serverTimestamp()
        })
      })

      toast({ title: "Organization created!", description: "Your brand is ready to shine!" })
      router.push(`/dashboard/organizations`)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error creating organization", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/organizations">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary uppercase italic">New Organization</h1>
          <p className="text-muted-foreground font-medium">Set up the commercial identity of your producer or brand.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="border-none shadow-sm overflow-hidden rounded-[2rem]">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg flex items-center gap-2">
               <Camera className="w-5 h-5 text-secondary" /> Visual Identity
            </CardTitle>
            <CardDescription>Upload images that will represent your brand on the platform.</CardDescription>
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
                    <p className="text-xs font-black uppercase tracking-widest">Upload Cover Photo</p>
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
             <CardTitle className="text-lg flex items-center gap-2"><Info className="w-5 h-5 text-secondary" /> Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest opacity-60">Name</Label>
                  <Input 
                    id="name" 
                    placeholder="Ex: Viby Entertainment" 
                    value={formData.name}
                    onChange={handleNameChange}
                    required 
                    className="rounded-xl h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-[10px] font-black uppercase tracking-widest opacity-60">Exclusive Username (@)</Label>
                  <div className="relative">
                    <Input 
                      id="username" 
                      placeholder="Letters and numbers only" 
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
                  <p className="text-[9px] text-muted-foreground font-bold uppercase">Min 5 characters. viby.club/{formData.username || '...'}</p>
                </div>
             </div>

             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Organization Type</Label>
                <Select value={formData.type} onValueChange={val => setFormData(prev => ({ ...prev, type: val }))} required>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue placeholder="Select segment" />
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
                <Label htmlFor="bio" className="text-[10px] font-black uppercase tracking-widest opacity-60">Bio / Description</Label>
                <Textarea 
                  id="bio" 
                  placeholder="Tell us a little about what you do..." 
                  value={formData.bio}
                  onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  className="min-h-[100px] resize-none rounded-xl border-dashed border-secondary/30"
                />
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader>
             <CardTitle className="text-lg flex items-center gap-2"><Fingerprint className="w-5 h-5 text-secondary" /> Legal Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="legalName" className="text-[10px] font-black uppercase tracking-widest opacity-60">Legal Name</Label>
                  <Input 
                    id="legalName" 
                    value={formData.legalName}
                    onChange={e => setFormData(prev => ({ ...prev, legalName: e.target.value }))}
                    placeholder="Official company name" 
                    className="rounded-xl h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj" className="text-[10px] font-black uppercase tracking-widest opacity-60">CNPJ</Label>
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
             <CardTitle className="text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-secondary" /> Headquarters Address</CardTitle>
             <CardDescription>Address is mandatory for compliance and payout purposes.</CardDescription>
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
                  <Label htmlFor="street" className="text-[10px] font-black uppercase tracking-widest opacity-60">Street</Label>
                  <Input id="street" value={formData.street} onChange={e => setFormData(prev => ({ ...prev, street: e.target.value }))} required className="rounded-xl h-11" />
                </div>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="number" className="text-[10px] font-black uppercase tracking-widest opacity-60">Number</Label>
                  <Input id="number" value={formData.number} onChange={e => setFormData(prev => ({ ...prev, number: e.target.value }))} required className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complement" className="text-[10px] font-black uppercase tracking-widest opacity-60">Complement</Label>
                  <Input id="complement" value={formData.complement} onChange={e => setFormData(prev => ({ ...prev, complement: e.target.value }))} className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="neighborhood" className="text-[10px] font-black uppercase tracking-widest opacity-60">Neighborhood</Label>
                  <Input id="neighborhood" value={formData.neighborhood} onChange={e => setFormData(prev => ({ ...prev, neighborhood: e.target.value }))} required className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-[10px] font-black uppercase tracking-widest opacity-60">City / State</Label>
                  <div className="flex gap-2">
                    <Input id="city" value={formData.city} readOnly required className="rounded-xl h-11 bg-muted/30" />
                    <Input id="state" value={formData.state} readOnly required className="rounded-xl h-11 bg-muted/30 w-16" />
                  </div>
                </div>
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader>
             <CardTitle className="text-lg flex items-center gap-2"><Globe className="w-5 h-5 text-secondary" /> Contact & Digital Presence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Phone className="w-3 h-3" /> WhatsApp</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold uppercase opacity-40">{formData.showPhone ? 'Public' : 'Hidden'}</span>
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
                    <Label htmlFor="contactEmail" className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Mail className="w-3 h-3" /> Contact Email</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold uppercase opacity-40">{formData.showEmail ? 'Public' : 'Hidden'}</span>
                      <Switch checked={formData.showEmail} onCheckedChange={checked => setFormData(prev => ({ ...prev, showEmail: checked }))} />
                    </div>
                  </div>
                  <Input 
                    id="contactEmail" 
                    type="email"
                    value={formData.contactEmail}
                    onChange={e => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                    placeholder="contact@brand.com" 
                    className="rounded-xl h-11"
                  />
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="website" className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Globe className="w-3 h-3" /> Website</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold uppercase opacity-40">{formData.showWebsite ? 'Public' : 'Hidden'}</span>
                      <Switch checked={formData.showWebsite} onCheckedChange={checked => setFormData(prev => ({ ...prev, showWebsite: checked }))} />
                    </div>
                  </div>
                  <Input 
                    id="website" 
                    value={formData.website}
                    onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://www.brand.com" 
                    className="rounded-xl h-11"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="instagram" className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Instagram className="w-3 h-3" /> Instagram (@)</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold uppercase opacity-40">{formData.showInstagram ? 'Public' : 'Hidden'}</span>
                      <Switch checked={formData.showInstagram} onCheckedChange={checked => setFormData(prev => ({ ...prev, showInstagram: checked }))} />
                    </div>
                  </div>
                  <Input 
                    id="instagram" 
                    value={formData.instagram}
                    onChange={e => setFormData(prev => ({ ...prev, instagram: e.target.value.replace("@", "") }))}
                    placeholder="brand_user" 
                    className="rounded-xl h-11"
                  />
                </div>
             </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" asChild className="rounded-xl px-8 font-bold text-muted-foreground">
            <Link href="/dashboard/organizations">Cancel</Link>
          </Button>
          <Button 
            type="submit" 
            className="bg-secondary text-white hover:bg-secondary/90 px-12 h-14 rounded-2xl font-black shadow-xl shadow-secondary/20 uppercase italic transition-all hover:scale-[1.02]" 
            disabled={loading || usernameStatus !== 'valid'}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
            Create Organization
          </Button>
        </div>
      </form>
    </div>
  )
}
