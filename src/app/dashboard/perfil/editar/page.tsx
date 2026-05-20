
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc, useFirebaseApp } from "@/firebase"
import { 
  doc, 
  updateDoc, 
  serverTimestamp, 
  getDoc, 
  getDocs, 
  query, 
  collection, 
  where, 
  writeBatch 
} from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Loader2, 
  ArrowLeft, 
  Save, 
  Upload, 
  Info, 
  Link as LinkIcon, 
  Instagram, 
  Phone, 
  Mail, 
  EyeOff, 
  Building2, 
  User as UserIcon, 
  Calendar,
  Check,
  X,
  Fingerprint,
  Lock
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { encryptDeterministic, decryptData } from "@/lib/crypto-utils"

const BUSINESS_CATEGORIES = {
  "Organizadores": ["Produtora de eventos", "Agência de marketing", "Agência de eventos", "Cerimonialista", "Organizador independente", "Assessoria de eventos"],
  "Casas e locais": ["Casa noturna", "Bar", "Pub", "Restaurante", "Café", "Lounge", "Hotel", "Resort", "Centro de eventos", "Arena", "Teatro", "Auditório", "Espaço cultural", "Galeria", "Parque", "Estádio", "Rooftop", "Coworking", "Centro de convenções"],
  "Música e entretenimento": ["Banda", "Cantor(a)", "DJ", "Grupo musical", "Artista", "Performer", "Drag queen", "Humorista", "Influenciador(a)", "Apresentador(a)"],
  "Eventos corporativos": ["Empresa privada", "Startup", "Consultoria", "RH/Treinamentos"],
  "Gastronomia": ["Buffet", "Food truck", "Confeitaria", "Hamburgueria", "Pizzaria", "Choperia", "Vinícola", "Cafeteria"],
  "Casamentos e festas": ["Decoradora", "Floricultura", "Fotografia", "Filmagem", "Sonorização", "Iluminação", "Locação de móveis", "Bartender", "Segurança", "Recreação infantil"],
  "Cultura e educação": ["Escola", "Universidade", "Curso", "ONG cultural", "Biblioteca", "Museu", "Coletivo artístico"],
  "Saúde e bem-estar": ["Academia", "Estúdio de yoga", "Clínica", "Espaço terapêutico", "Personal trainer"],
  "Turismo": ["Agência de turismo", "Guia turístico", "Operadora turística", "Passeios e experiências"],
  "Esportes": ["Clube esportivo", "Assessoria esportiva", "Equipe esportiva", "Academia funcional"],
  "Comunidade e causas": ["ONG", "Coletivo", "Associação", "Fundação", "Projeto social", "Movimento social"],
  "Governo e setor público": ["Prefeitura", "Secretaria", "Câmara municipal", "Governo estadual", "Governo federal", "Universidade pública"],
  "Religioso": ["Igreja", "Centro espírita", "Templo", "Comunidade religiosa"]
}

export default function EditarPerfilPage() {
  const router = useRouter()
  const auth = useAuth()
  const { user } = useUser(auth)
  const db = useFirestore()
  const app = useFirebaseApp()

  // GARANTIA: Utiliza exclusivamente o bucket 'viby'
  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app, 'viby');
  }, [app])

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading: profileLoading } = useDoc<any>(userDocRef)

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    avatar: "",
    bio: "",
    birthDate: "",
    gender: "",
    city: "",
    state: "",
    country: "Brasil",
    website: "",
    instagram: "",
    whatsapp: "",
    email: "",
    cpf: "",
    showEmail: true,
    accountType: "Usuário",
    businessCategory: "",
    legalName: "",
    cnpj: ""
  })
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'valid' | 'invalid' | 'taken'>('idle')

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        username: profile.username || "",
        avatar: profile.avatar || "",
        bio: profile.bio || "",
        birthDate: profile.birthDate || "",
        gender: profile.gender || "",
        city: profile.city || "",
        state: profile.state || "",
        country: profile.country || "Brasil",
        website: profile.website || "",
        instagram: profile.instagram || "",
        whatsapp: profile.whatsapp || "",
        email: profile.email || "",
        cpf: profile.cpf ? decryptData(profile.cpf) : "",
        showEmail: profile.showEmail !== undefined ? profile.showEmail : true,
        accountType: profile.accountType || "Usuário",
        businessCategory: profile.businessCategory || "",
        legalName: profile.legalName || "",
        cnpj: profile.cnpj || ""
      })
    }
  }, [profile])

  useEffect(() => {
    if (!db || !profile || !formData.username) return
    
    const newUsername = formData.username.toLowerCase().trim()
    const oldUsername = (profile.username || "").toLowerCase().trim()

    if (newUsername === oldUsername) {
      setUsernameStatus('idle')
      setCheckingUsername(false)
      return
    }

    const regex = /^[a-zA-Z0-9]+$/
    if (newUsername.length < 5 || newUsername.length > 20 || !regex.test(newUsername)) {
      setUsernameStatus('invalid')
      setCheckingUsername(false)
      return
    }

    setUsernameStatus('idle')
    setCheckingUsername(true)

    const timer = setTimeout(async () => {
      try {
        const usernameRef = doc(db, "usernames", newUsername)
        const usernameSnap = await getDoc(usernameRef)
        if (usernameSnap.exists()) setUsernameStatus('taken'); else setUsernameStatus('valid');
      } catch (e) {
        console.error(e)
      } finally {
        setCheckingUsername(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [formData.username, profile, db])

  const formatCNPJ = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 14) v = v.slice(0, 14);
    if (v.length > 12) return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    if (v.length > 8) return v.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, "$1.$2.$3/$4");
    if (v.length > 5) return v.replace(/(\d{2})(\d{3})(\d{1,3})/, "$1.$2.$3");
    if (v.length > 2) return v.replace(/(\d{2})(\d{1,3})/, "$1.$2");
    return v;
  }

  const formatCPF = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    if (v.length > 3) return v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    return v;
  }

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, cpf: formatCPF(e.target.value) }));
  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, cnpj: formatCNPJ(e.target.value) }));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return

    setUploadProgress(0)
    try {
      const storageRef = ref(storage, `profiles/${user.uid}/avatar_${Date.now()}`)
      const uploadTask = uploadBytesResumable(storageRef, file)
      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        (error) => { setUploadProgress(null); toast({ variant: "destructive", title: "Erro no upload" }); },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setFormData(prev => ({ ...prev, avatar: downloadURL }))
          setUploadProgress(null)
          toast({ title: "Imagem carregada!" })
        }
      )
    } catch (err) { setUploadProgress(null) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || !profile) return

    const newUsername = formData.username.toLowerCase().trim()
    const oldUsername = (profile.username || "").toLowerCase().trim()
    const usernameChanged = newUsername !== oldUsername

    if (usernameChanged && usernameStatus !== 'valid') {
      toast({ variant: "destructive", title: "Username inválido" })
      return
    }

    setSaving(true)
    try {
      const batch = writeBatch(db)
      if (usernameChanged) {
        if (oldUsername) batch.delete(doc(db, "usernames", oldUsername));
        batch.set(doc(db, "usernames", newUsername), { uid: user.uid });
      }

      const encryptedCpf = formData.cpf ? encryptDeterministic(formData.cpf) : "";
      const userRef = doc(db, "users", user.uid)
      batch.update(userRef, { ...formData, cpf: encryptedCpf, username: newUsername, updatedAt: serverTimestamp() })
      await batch.commit()

      const eventsQuery = query(collection(db, "events"), where("organizerId", "==", user.uid))
      const eventsSnap = await getDocs(eventsQuery)
      if (!eventsSnap.empty) {
        const eventBatch = writeBatch(db)
        eventsSnap.forEach((eventDoc) => {
          eventBatch.update(eventDoc.ref, { organizer: { name: formData.name, avatar: formData.avatar || "", isVerified: !!profile.isVerified, username: newUsername } })
        })
        await eventBatch.commit()
      }

      toast({ title: "Perfil atualizado!" })
      router.push("/dashboard/perfil")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao salvar" })
    } finally { setSaving(false) }
  }

  if (profileLoading) return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  const isCpfLocked = !!profile?.cpf;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/perfil"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <h1 className="text-3xl font-bold tracking-tight">Editar Perfil</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle>Tipo de Conta</CardTitle></CardHeader>
          <CardContent>
            <RadioGroup value={formData.accountType} onValueChange={(val) => setFormData(prev => ({...prev, accountType: val}))} className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2 border rounded-xl p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="Usuário" id="user-type" />
                <Label htmlFor="user-type" className="flex items-center gap-2 cursor-pointer font-bold"><UserIcon className="w-4 h-4 text-secondary" /> Usuário</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-xl p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="Empresa" id="company-type" />
                <Label htmlFor="company-type" className="flex items-center gap-2 cursor-pointer font-bold"><Building2 className="w-4 h-4 text-secondary" /> Empresa</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {formData.accountType === 'Empresa' && (
          <Card className="border-none shadow-sm border-t-4 border-secondary animate-in fade-in slide-in-from-top-4 duration-300">
            <CardHeader><CardTitle>Informações Jurídicas</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label htmlFor="legalName">Razão Social</Label><Input id="legalName" value={formData.legalName} onChange={(e) => setFormData(prev => ({...prev, legalName: e.target.value}))} required /></div>
                <div className="space-y-2"><Label htmlFor="cnpj">CNPJ</Label><Input id="cnpj" value={formData.cnpj} onChange={handleCNPJChange} placeholder="00.000.000/0000-00" required /></div>
              </div>
              <div className="space-y-2">
                <Label>Categoria da Empresa</Label>
                <Select value={formData.businessCategory} onValueChange={(val) => setFormData(prev => ({...prev, businessCategory: val}))}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma subcategoria" /></SelectTrigger>
                  <SelectContent className="max-h-80">
                    {Object.entries(BUSINESS_CATEGORIES).map(([category, items]) => (
                      <SelectGroup key={category}>
                        <SelectLabel className="bg-muted/50 py-2">{category}</SelectLabel>
                        {items.map(item => (<SelectItem key={`${category}-${item}`} value={item}>{item}</SelectItem>))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle>Identidade & Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-6 py-4">
              <div className="relative group">
                <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                  <AvatarImage src={formData.avatar} alt={formData.name} className="object-cover" />
                  <AvatarFallback className="text-4xl font-bold bg-muted">{formData.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <label htmlFor="avatar-upload" className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Upload className="w-6 h-6" /></label>
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>
              {uploadProgress !== null && <div className="w-full max-w-xs space-y-2"><Progress value={uploadProgress} className="h-1.5" /><p className="text-[10px] text-center text-muted-foreground font-bold uppercase">Carregando: {Math.round(uploadProgress)}%</p></div>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label htmlFor="name">Nome / Fantasia</Label><Input id="name" value={formData.name} onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))} required /></div>
              <div className="space-y-2">
                <Label htmlFor="username">Nome de Usuário (@)</Label>
                <div className="relative">
                  <Input id="username" value={formData.username} maxLength={20} onChange={(e) => setFormData(prev => ({...prev, username: e.target.value.toLowerCase().replace(/\s+/g, "")}))} className={cn(usernameStatus === 'valid' ? 'border-green-500 pr-10' : usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-destructive pr-10' : 'pr-10')} />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingUsername ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /> : usernameStatus === 'valid' ? <Check className="w-3.5 h-3.5 text-green-500" /> : usernameStatus === 'taken' || usernameStatus === 'invalid' ? <X className="w-3.5 h-3.5 text-destructive" /> : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label htmlFor="birthDate">Data de Nascimento</Label><Input id="birthDate" type="date" value={formData.birthDate} onChange={(e) => setFormData(prev => ({...prev, birthDate: e.target.value}))} required /></div>
              <div className="space-y-2">
                <Label htmlFor="gender">Sexo / Gênero</Label>
                <Select value={formData.gender} onValueChange={(val) => setFormData(prev => ({...prev, gender: val}))} required>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="homem trans">Homem Trans</SelectItem>
                    <SelectItem value="mulher trans">Mulher Trans</SelectItem>
                    <SelectItem value="agênero">Agênero</SelectItem>
                    <SelectItem value="prefiro não dizer">Prefiro não dizer</SelectItem>
                    <SelectItem value="empresa">Empresa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf" className="flex items-center gap-2"><Fingerprint className="w-3.5 h-3.5 text-secondary" /> CPF {isCpfLocked && <Lock className="w-3 h-3 text-muted-foreground ml-auto" />}</Label>
              <Input id="cpf" value={formData.cpf} onChange={handleCPFChange} placeholder="000.000.000-00" disabled={isCpfLocked} className={cn(isCpfLocked && "bg-muted/50 cursor-not-allowed")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio (Máx 150 caracteres)</Label>
              <Textarea id="bio" value={formData.bio} maxLength={150} onChange={(e) => setFormData(prev => ({...prev, bio: e.target.value}))} placeholder="Conte um pouco sobre você..." className="min-h-[100px] resize-none" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle>Localização</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2"><Label htmlFor="city">Cidade</Label><Input id="city" value={formData.city} onChange={(e) => setFormData(prev => ({...prev, city: e.target.value}))} required /></div>
            <div className="space-y-2"><Label htmlFor="state">Estado</Label><Input id="state" value={formData.state} onChange={(e) => setFormData(prev => ({...prev, state: e.target.value}))} placeholder="Ex: SP" required /></div>
            <div className="space-y-2"><Label htmlFor="country">País</Label><Input id="country" value={formData.country} onChange={(e) => setFormData(prev => ({...prev, country: e.target.value}))} required /></div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle>Links & Contato</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label htmlFor="website">Site Oficial</Label><Input id="website" value={formData.website} onChange={(e) => setFormData(prev => ({...prev, website: e.target.value}))} placeholder="https://..." /></div>
              <div className="space-y-2"><Label htmlFor="instagram">Instagram</Label><Input id="instagram" value={formData.instagram} onChange={(e) => setFormData(prev => ({...prev, instagram: e.target.value}))} placeholder="@exemplo" /></div>
              <div className="space-y-2"><Label htmlFor="whatsapp">WhatsApp</Label><Input id="whatsapp" value={formData.whatsapp} onChange={(e) => setFormData(prev => ({...prev, whatsapp: e.target.value}))} placeholder="(00) 00000-0000" /></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label htmlFor="email">E-mail de Contato</Label><Switch id="showEmail" checked={formData.showEmail} onCheckedChange={(checked) => setFormData(prev => ({...prev, showEmail: checked}))} /></div>
                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))} placeholder="contato@exemplo.com" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" className="bg-secondary text-white hover:bg-secondary/90 px-8" disabled={saving || uploadProgress !== null}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Perfil
          </Button>
        </div>
      </form>
    </div>
  )
}
