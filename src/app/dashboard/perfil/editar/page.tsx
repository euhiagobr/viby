
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc, useFirebaseApp } from "@/firebase"
import { 
  doc, 
  updateDoc, 
  serverTimestamp
} from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Loader2, 
  ArrowLeft, 
  Save, 
  Lock, 
  ShieldCheck, 
  Fingerprint,
  AlertTriangle,
  Camera,
  Instagram,
  Globe,
  Phone,
  User,
  MapPin,
  Languages,
  Coins,
  Mail,
  Upload,
  BadgeCheck
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn, validateCPF } from "@/lib/utils"
import Link from "next/link"
import { updateUserCPF } from "@/app/actions/user"
import { IMAGE_CACHE_METADATA } from "@/lib/image-utils"
import { Separator } from "@/components/ui/separator"

const DEFAULT_PROFILE_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fprofile.jpeg?alt=media";

export default function EditarPerfilPage() {
  const router = useRouter()
  const auth = useAuth()
  const { user } = useUser(auth)
  const db = useFirestore()
  const app = useFirebaseApp()

  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app);
  }, [app])

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading: profileLoading } = useDoc<any>(userDocRef)

  const [formData, setFormData] = useState<any>({
    name: "",
    username: "",
    avatar: "",
    banner: "",
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
    preferredCurrency: "BRL",
    language: "pt-BR",
    showEmail: true
  })
  
  const [saving, setSaving] = useState(false)
  const [avatarProgress, setAvatarProgress] = useState<number | null>(null)
  const [bannerProgress, setBannerProgress] = useState<number | null>(null)
  const [hasValidCPF, setHasValidCPF] = useState(false)
  const [isDataLoaded, setIsDataLoaded] = useState(false)

  useEffect(() => {
    if (profile && !isDataLoaded) {
      const currentMask = profile.cpfMasked || profile.cpf || "";
      const isMissing = !profile.cpfHash || currentMask === "***.***.***-**";

      setFormData({
        name: profile.name || "",
        username: profile.username || "",
        avatar: profile.avatar || DEFAULT_PROFILE_IMAGE,
        banner: profile.banner || "",
        bio: profile.bio || "",
        birthDate: profile.birthDate || "",
        gender: profile.gender || "",
        city: profile.city || "",
        state: profile.state || "",
        country: profile.country || "Brasil",
        website: profile.website || "",
        instagram: profile.instagram || "",
        whatsapp: profile.whatsapp || profile.phone || "",
        email: profile.email || user?.email || "",
        cpf: currentMask,
        preferredCurrency: profile.preferredCurrency || "BRL",
        language: profile.language || "pt-BR",
        showEmail: profile.showEmail !== undefined ? profile.showEmail : true
      });

      if (!isMissing) {
        setHasValidCPF(true);
      }
      setIsDataLoaded(true);
    }
  }, [profile, isDataLoaded, user?.email])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return

    const setProgress = type === 'avatar' ? setAvatarProgress : setBannerProgress;
    setProgress(0);

    try {
      const storageRef = ref(storage, `users/${user.uid}/${type}_${Date.now()}`)
      const uploadTask = uploadBytesResumable(storageRef, file, IMAGE_CACHE_METADATA);
      uploadTask.on('state_changed', 
        (snapshot) => setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        () => { setProgress(null); toast({ variant: "destructive", title: "Erro no upload" }); },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setFormData((prev: any) => ({ ...prev, [type]: downloadURL }))
          setProgress(null)
          toast({ title: `${type === 'avatar' ? 'Foto de perfil' : 'Capa'} carregada!` })
        }
      )
    } catch (err) { setProgress(null) }
  }

  const formatCPFInput = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    return v;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || !profile) return

    setSaving(true)
    try {
      const userRef = doc(db, "users", user.uid)
      const { cpf, username, email, uid, ...safeData } = formData; 

      if (!hasValidCPF) {
        const clean = cpf.replace(/\D/g, "");
        if (!validateCPF(clean)) throw new Error("CPF inválido.");
        const cpfRes = await updateUserCPF(user.uid, clean);
        if (!cpfRes.success) throw new Error(cpfRes.error);
      }

      await updateDoc(userRef, {
        ...safeData,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Perfil atualizado!" })
      router.push("/dashboard/perfil")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message })
    } finally {
      setSaving(false)
    }
  }

  if (profileLoading || !isDataLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Carregando seus dados...</p>
      </div>
    )
  }

  const cpfIsReadOnly = hasValidCPF;
  const isVerified = profile?.isVerified === true;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard/perfil"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Editar Perfil</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SEÇÃO DE CAPA (BANNER) - EXCLUSIVA PARA VERIFICADOS */}
        {isVerified && (
          <Card className="border-none shadow-sm overflow-hidden rounded-[2.5rem] bg-white">
            <CardHeader className="bg-muted/30">
              <CardTitle className="text-lg flex items-center gap-2 text-primary">
                <Camera className="w-5 h-5 text-secondary" /> Capa do Perfil
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div 
                 className="relative h-48 bg-muted border-b border-border group cursor-pointer overflow-hidden"
                 onClick={() => document.getElementById('user-banner-up')?.click()}
               >
                 {formData.banner ? (
                   <img src={formData.banner} className="w-full h-full object-cover" alt="Capa" />
                 ) : (
                   <div className="flex flex-col items-center justify-center h-full opacity-30 text-muted-foreground">
                      <Upload className="w-8 h-8 mb-2" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Carregar Capa</p>
                   </div>
                 )}
                 <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <Camera className="text-white w-8 h-8" />
                 </div>
                 {bannerProgress !== null && <Progress value={bannerProgress} className="absolute bottom-0 h-1 rounded-none" />}
                 <input id="user-banner-up" type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, 'banner')} />
               </div>
               <div className="p-4 bg-secondary/5 flex items-center gap-3">
                  <BadgeCheck className="w-4 h-4 text-secondary" />
                  <p className="text-[9px] font-bold text-secondary uppercase leading-relaxed">
                    Funcionalidade Premium: Como membro verificado, você pode personalizar sua vitrine cultural.
                  </p>
               </div>
            </CardContent>
          </Card>
        )}

        {/* IDENTIDADE E FOTO */}
        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-muted/30 pb-8">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2 text-primary">
              <User className="w-5 h-5 text-secondary" /> Identidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 pt-8">
            <div className="flex flex-col items-center gap-6 py-4">
              <div className="relative group">
                <Avatar className="h-40 w-40 border-8 border-background shadow-2xl rounded-[3rem] overflow-hidden">
                  <AvatarImage src={formData.avatar} alt={formData.name} className="object-cover" />
                  <AvatarFallback className="text-4xl font-black bg-muted">{formData.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <label htmlFor="avatar-upload" className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="w-8 h-8" />
                </label>
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'avatar')} />
              </div>
              {avatarProgress !== null && (
                <div className="w-full max-w-xs space-y-2">
                  <Progress value={avatarProgress} className="h-1" />
                  <p className="text-[9px] text-center font-black uppercase">Enviando: {Math.round(avatarProgress)}%</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nome Completo</Label>
                <Input value={formData.name} onChange={(e) => setFormData((prev:any) => ({...prev, name: e.target.value}))} required className="rounded-xl h-12" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2 ml-1">
                  <Fingerprint className="w-3.5 h-3.5 text-secondary" /> CPF (Protegido)
                </Label>
                <div className="relative">
                  <Input 
                    value={formData.cpf} 
                    onChange={e => !cpfIsReadOnly && setFormData({...formData, cpf: formatCPFInput(e.target.value)})}
                    readOnly={cpfIsReadOnly}
                    placeholder="000.000.000-00"
                    className={cn("rounded-xl h-12 font-mono font-bold pr-10", cpfIsReadOnly ? "bg-muted/50 cursor-not-allowed" : "border-dashed border-secondary/30")} 
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {cpfIsReadOnly ? <Lock className="w-4 h-4 text-muted-foreground opacity-30" /> : <ShieldCheck className="w-4 h-4 text-secondary" />}
                  </div>
                </div>
                {!hasValidCPF && (
                   <div className="p-3 bg-orange-50 rounded-xl border border-dashed border-orange-200 flex items-start gap-2 mt-2">
                      <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      <p className="text-[9px] font-bold text-orange-800 uppercase leading-tight">O CPF informado será vinculado permanentemente para transferências seguras.</p>
                   </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Gênero</Label>
                  <Select value={formData.gender} onValueChange={v => setFormData({...formData, gender: v})}>
                     <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Selecione" /></SelectTrigger>
                     <SelectContent className="rounded-xl">
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="nao-binario">Não-binário</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                        <SelectItem value="prefiro-nao-dizer">Prefiro não dizer</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Data de Nascimento</Label>
                  <Input type="date" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} className="rounded-xl h-12" />
               </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Bio / Apresentação</Label>
              <Textarea value={formData.bio} maxLength={150} onChange={(e) => setFormData((prev:any) => ({...prev, bio: e.target.value}))} placeholder="Fale um pouco sobre você..." className="min-h-[100px] resize-none rounded-xl border-dashed" />
            </div>
          </CardContent>
        </Card>

        {/* LOCALIZAÇÃO */}
        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
           <CardHeader className="bg-muted/30">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2 text-primary">
                 <MapPin className="w-5 h-5 text-secondary" /> Localização
              </CardTitle>
           </CardHeader>
           <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Cidade</Label>
                 <Input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="rounded-xl h-12" />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Estado (UF)</Label>
                 <Input value={formData.state} onChange={e => setFormData({...formData, state: e.target.value.toUpperCase()})} maxLength={2} className="rounded-xl h-12" />
              </div>
           </CardContent>
        </Card>

        {/* PRESENÇA DIGITAL */}
        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
           <CardHeader className="bg-muted/30">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2 text-primary">
                 <Globe className="w-5 h-5 text-secondary" /> Redes e Contato
              </CardTitle>
           </CardHeader>
           <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60 ml-1 flex items-center gap-2">
                       <Instagram className="w-3 h-3" /> Instagram (@)
                    </Label>
                    <Input value={formData.instagram} onChange={e => setFormData({...formData, instagram: e.target.value.replace('@', '')})} className="rounded-xl h-12" placeholder="seu_perfil" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60 ml-1 flex items-center gap-2">
                       <Phone className="w-3 h-3" /> WhatsApp
                    </Label>
                    <Input value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} className="rounded-xl h-12" placeholder="(00) 00000-0000" />
                 </div>
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase opacity-60 ml-1 flex items-center gap-2">
                    <Globe className="w-3 h-3" /> Site / Link Externo
                 </Label>
                 <Input value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} className="rounded-xl h-12" placeholder="https://..." />
              </div>

              <Separator className="border-dashed" />

              <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-dashed">
                 <div className="space-y-0.5">
                    <p className="font-bold text-sm flex items-center gap-2 text-primary">
                       <Mail className="w-4 h-4" /> E-mail Público
                    </p>
                    <p className="text-[9px] font-black uppercase opacity-40">Exibir e-mail no perfil público</p>
                 </div>
                 <Switch 
                   checked={formData.showEmail} 
                   onCheckedChange={v => setFormData({...formData, showEmail: v})} 
                 />
              </div>
           </CardContent>
        </Card>

        {/* PREFERÊNCIAS */}
        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
           <CardHeader className="bg-muted/30">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2 text-primary">
                 <Languages className="w-5 h-5 text-secondary" /> Preferências do Sistema
              </CardTitle>
           </CardHeader>
           <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase opacity-60 ml-1 flex items-center gap-2">
                    <Coins className="w-3 h-3" /> Moeda Padrão
                 </Label>
                 <Select value={formData.preferredCurrency} onValueChange={v => setFormData({...formData, preferredCurrency: v})}>
                    <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                       <SelectItem value="BRL">Real Brasileiro (R$)</SelectItem>
                       <SelectItem value="USD">Dólar Americano ($)</SelectItem>
                       <SelectItem value="EUR">Euro (€)</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase opacity-60 ml-1 flex items-center gap-2">
                    <Languages className="w-3 h-3" /> Idioma
                 </Label>
                 <Select value={formData.language} onValueChange={v => setFormData({...formData, language: v})}>
                    <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                       <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                       <SelectItem value="en-US">English (US)</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
           </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-6">
          <Button type="button" variant="ghost" onClick={() => router.back()} className="rounded-xl px-8 font-bold uppercase text-xs">Cancelar</Button>
          <Button type="submit" className="bg-secondary text-white font-black px-12 h-16 rounded-[1.5rem] shadow-xl shadow-secondary/20 uppercase italic text-lg hover:scale-[1.02] transition-transform" disabled={saving || avatarProgress !== null || bannerProgress !== null}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Salvar Perfil
          </Button>
        </div>
      </form>
    </div>
  )
}
