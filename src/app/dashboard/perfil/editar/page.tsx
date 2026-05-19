
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc, useFirebaseApp } from "@/firebase"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
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
import { Loader2, ArrowLeft, Save, Upload, Info, Link as LinkIcon, Instagram, Phone, Mail, Eye, EyeOff, Building2, User as UserIcon, Briefcase } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"

const BUSINESS_CATEGORIES = {
  "Organizadores": ["Produtora de eventos", "Agência de marketing", "Agência de eventos", "Cerimonialista", "Organizador independente", "Assessoria de eventos"],
  "Casas e locais": ["Casa noturna", "Bar", "Pub", "Restaurante", "Café", "Lounge", "Hotel", "Resort", "Centro de eventos", "Arena", "Teatro", "Auditório", "Espaço cultural", "Galeria", "Parque", "Estádio", "Rooftop", "Coworking", "Centro de convenções"],
  "Música e entretenimento": ["Banda", "Cantor(a)", "DJ", "Grupo musical", "Artista", "Performer", "Drag queen", "Humorista", "Influenciador(a)", "Apresentador(a)"],
  "Eventos corporativos": ["Empresa privada", "Startup", "Consultoria", "RH/Treinamentos", "Coworking", "Hub de inovação"],
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

  const storage = React.useMemo(() => {
    if (!app) return null;
    try {
      return getStorage(app, "gs://viby");
    } catch (e) {
      return getStorage(app);
    }
  }, [app])

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading: profileLoading } = useDoc<any>(userDocRef)

  const [formData, setFormData] = useState({
    name: "",
    avatar: "",
    bio: "",
    city: "",
    state: "",
    country: "Brasil",
    website: "",
    instagram: "",
    whatsapp: "",
    email: "",
    showEmail: true,
    accountType: "Usuário",
    businessCategory: "",
    legalName: "",
    cnpj: ""
  })
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        avatar: profile.avatar || "",
        bio: profile.bio || "",
        city: profile.city || "",
        state: profile.state || "",
        country: profile.country || "Brasil",
        website: profile.website || "",
        instagram: profile.instagram || "",
        whatsapp: profile.whatsapp || "",
        email: profile.email || "",
        showEmail: profile.showEmail !== undefined ? profile.showEmail : true,
        accountType: profile.accountType || "Usuário",
        businessCategory: profile.businessCategory || "",
        legalName: profile.legalName || "",
        cnpj: profile.cnpj || ""
      })
    }
  }, [profile])

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    let formatted = numbers;
    if (numbers.length > 2) formatted = numbers.substring(0, 2) + "." + numbers.substring(2);
    if (numbers.length > 5) formatted = formatted.substring(0, 6) + "." + numbers.substring(5);
    if (numbers.length > 8) formatted = formatted.substring(0, 10) + "/" + numbers.substring(8);
    if (numbers.length > 12) formatted = formatted.substring(0, 15) + "-" + numbers.substring(12);
    return formatted.substring(0, 18);
  }

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value);
    setFormData(prev => ({ ...prev, cnpj: formatted }));
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return

    setUploadProgress(0)

    try {
      const storageRef = ref(storage, `profiles/${user.uid}/avatar_${Date.now()}`)
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setUploadProgress(progress)
        },
        (error) => {
          console.error(error)
          setUploadProgress(null)
          toast({ variant: "destructive", title: "Erro no upload" })
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setFormData(prev => ({ ...prev, avatar: downloadURL }))
          setUploadProgress(null)
          toast({ title: "Imagem carregada!" })
        }
      )
    } catch (err) {
      setUploadProgress(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user) return

    if (formData.bio.length > 150) {
      toast({ variant: "destructive", title: "Bio muito longa", description: "Máximo de 150 caracteres." })
      return
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g
    if (urlRegex.test(formData.bio)) {
      toast({ variant: "destructive", title: "Links não permitidos", description: "Não use links na biografia." })
      return
    }

    if (!formData.name || !formData.city || !formData.state || !formData.country) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Nome e Localização são obrigatórios." })
      return
    }

    if (formData.accountType === 'Empresa') {
      if (!formData.legalName || !formData.cnpj || !formData.businessCategory) {
        toast({ variant: "destructive", title: "Campos de Empresa", description: "Razão Social, CNPJ e Categoria são obrigatórios para empresas." })
        return
      }
    }

    setSaving(true)
    try {
      await updateDoc(doc(db, "users", user.uid), {
        ...formData,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Perfil atualizado!", description: "Suas alterações foram salvas com sucesso." })
      router.push("/dashboard/perfil")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message })
    } finally {
      setSaving(false)
    }
  }

  if (profileLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/perfil"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Editar Perfil</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Tipo de Conta</CardTitle>
            <CardDescription>Escolha como deseja se identificar na plataforma.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup 
              value={formData.accountType} 
              onValueChange={(val) => setFormData(prev => ({...prev, accountType: val}))}
              className="grid grid-cols-2 gap-4"
            >
              <div className="flex items-center space-x-2 border rounded-xl p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="Usuário" id="user-type" />
                <Label htmlFor="user-type" className="flex items-center gap-2 cursor-pointer font-bold">
                  <UserIcon className="w-4 h-4 text-secondary" /> Usuário
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-xl p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="Empresa" id="company-type" />
                <Label htmlFor="company-type" className="flex items-center gap-2 cursor-pointer font-bold">
                  <Building2 className="w-4 h-4 text-secondary" /> Empresa
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {formData.accountType === 'Empresa' && (
          <Card className="border-none shadow-sm border-t-4 border-secondary animate-in fade-in slide-in-from-top-4 duration-300">
            <CardHeader>
              <CardTitle>Informações Jurídicas</CardTitle>
              <CardDescription>Dados obrigatórios para contas empresariais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="legalName">Razão Social (Obrigatório)</Label>
                  <Input 
                    id="legalName" 
                    value={formData.legalName} 
                    onChange={(e) => setFormData(prev => ({...prev, legalName: e.target.value}))} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ (Obrigatório)</Label>
                  <Input 
                    id="cnpj" 
                    value={formData.cnpj} 
                    onChange={handleCNPJChange} 
                    placeholder="00.000.000/0000-00" 
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Categoria da Empresa (Obrigatório)</Label>
                <Select 
                  value={formData.businessCategory} 
                  onValueChange={(val) => setFormData(prev => ({...prev, businessCategory: val}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma subcategoria" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {Object.entries(BUSINESS_CATEGORIES).map(([category, items]) => (
                      <SelectGroup key={category}>
                        <SelectLabel className="bg-muted/50 py-2">{category}</SelectLabel>
                        {items.map(item => (
                          <SelectItem key={item} value={item}>{item}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Identidade</CardTitle>
            <CardDescription>Gerencie sua imagem e nome de exibição.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-6 py-4">
              <div className="relative group">
                <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                  <AvatarImage src={formData.avatar} alt={formData.name} />
                  <AvatarFallback className="text-4xl font-bold bg-muted">
                    {formData.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <label 
                  htmlFor="avatar-upload" 
                  className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Upload className="w-6 h-6" />
                </label>
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>
              
              {uploadProgress !== null && (
                <div className="w-full max-w-xs space-y-2">
                  <Progress value={uploadProgress} className="h-1.5" />
                  <p className="text-[10px] text-center text-muted-foreground font-bold uppercase">Carregando: {Math.round(uploadProgress)}%</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome / Nome Fantasia (Obrigatório)</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Nome de Usuário</Label>
                <Input id="username" value={profile?.username} disabled className="bg-muted text-muted-foreground cursor-not-allowed" />
                <p className="text-[10px] text-muted-foreground">O nome de usuário não pode ser alterado.</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="bio">Bio (Máx 150 caracteres)</Label>
                <span className={cn("text-[10px] font-bold", formData.bio.length > 150 ? "text-destructive" : "text-muted-foreground")}>
                  {formData.bio.length}/150
                </span>
              </div>
              <Textarea 
                id="bio" 
                value={formData.bio} 
                onChange={(e) => setFormData(prev => ({...prev, bio: e.target.value}))}
                placeholder="Conte um pouco sobre você... (sem links)"
                className="min-h-[100px] resize-none"
              />
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                Links na bio serão removidos automaticamente ao salvar.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Localização (Obrigatórios)</CardTitle>
            <CardDescription>Sua base principal de atuação.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={formData.city} onChange={(e) => setFormData(prev => ({...prev, city: e.target.value}))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Input id="state" value={formData.state} onChange={(e) => setFormData(prev => ({...prev, state: e.target.value}))} placeholder="Ex: SP" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">País</Label>
              <Input id="country" value={formData.country} onChange={(e) => setFormData(prev => ({...prev, country: e.target.value}))} required />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Links & Contato</CardTitle>
            <CardDescription>Canais oficiais de divulgação.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="website" className="flex items-center gap-2">
                  <LinkIcon className="w-3.5 h-3.5" /> Site Oficial
                </Label>
                <Input id="website" value={formData.website} onChange={(e) => setFormData(prev => ({...prev, website: e.target.value}))} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram" className="flex items-center gap-2">
                  <Instagram className="w-3.5 h-3.5" /> Instagram (usuário)
                </Label>
                <Input id="instagram" value={formData.instagram} onChange={(e) => setFormData(prev => ({...prev, instagram: e.target.value}))} placeholder="@exemplo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp" className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" /> WhatsApp
                </Label>
                <Input id="whatsapp" value={formData.whatsapp} onChange={(e) => setFormData(prev => ({...prev, whatsapp: e.target.value}))} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> E-mail de Contato
                  </Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="showEmail" className="text-[10px] font-bold uppercase opacity-60">
                      {formData.showEmail ? "Visível" : "Oculto"}
                    </Label>
                    <Switch 
                      id="showEmail" 
                      checked={formData.showEmail} 
                      onCheckedChange={(checked) => setFormData(prev => ({...prev, showEmail: checked}))} 
                    />
                  </div>
                </div>
                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))} placeholder="contato@exemplo.com" />
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  {formData.showEmail ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  O e-mail será {formData.showEmail ? "exibido" : "ocultado"} no seu perfil público.
                </p>
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
