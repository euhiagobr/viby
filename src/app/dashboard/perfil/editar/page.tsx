
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
  Lock as LockIcon, 
  ShieldCheck, 
  Fingerprint,
  Camera,
  Instagram,
  Facebook,
  Globe,
  Phone,
  User,
  MapPin,
  Languages,
  Coins,
  Mail,
  Upload,
  BadgeCheck,
  Info,
  AtSign,
  Eye,
  EyeOff,
  Search,
  CheckCircle2
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { toast } from "@/hooks/use-toast"
import { cn, validateCPF } from "@/lib/utils"
import Link from "next/link"
import { updateUserCPF } from "@/app/actions/user"
import { IMAGE_CACHE_METADATA } from "@/lib/image-utils"
import { Separator } from "@/components/ui/separator"
import { searchGlobalAddresses, mapNominatimToAddress } from "@/lib/location-utils"

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

  const [formData, setFormData] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [avatarProgress, setAvatarProgress] = useState<number | null>(null)
  const [bannerProgress, setBannerProgress] = useState<number | null>(null)
  const [hasValidCPF, setHasValidCPF] = useState(false)
  const [skipCPF, setSkipCPF] = useState(false)
  const [isDataLoaded, setIsDataLoaded] = useState(false)

  // Estados para busca de endereço
  const [addressSearch, setAddressSearch] = useState("")
  const [isSearchingAddress, setIsSearchingAddress] = useState(false)
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([])

  useEffect(() => {
    if (profile && !isDataLoaded) {
      const currentMask = profile.cpfMasked || profile.cpf || "";
      const isMissing = !profile.cpfHash || currentMask === "***.***.***-**";

      // Normalização da estrutura de localização para compatibilidade
      const initialLocation = profile.location || {
        country: profile.country || "Brasil",
        state: profile.state || "",
        city: profile.city || "",
        neighborhood: profile.neighborhood || "",
        street: profile.street || "",
        number: profile.number || "",
        complement: profile.complement || "",
        postalCode: profile.postalCode || ""
      };

      setFormData({
        name: profile.name || "",
        username: profile.username || "",
        avatar: profile.avatar || DEFAULT_PROFILE_IMAGE,
        banner: profile.banner || "",
        bio: profile.bio || "",
        birthDate: profile.birthDate || "",
        gender: profile.gender || "",
        email: profile.email || user?.email || "",
        whatsapp: profile.whatsapp || "",
        instagram: profile.instagram || "",
        facebook: profile.facebook || "",
        website: profile.website || "",
        cpf: currentMask,
        location: initialLocation,
        addressVisibility: profile.addressVisibility || "full",
        emailPublico: profile.emailPublico ?? true,
        whatsappPublico: profile.whatsappPublico ?? true,
        instagramPublico: profile.instagramPublico ?? true,
        facebookPublico: profile.facebookPublico ?? true,
        preferredCurrency: profile.preferredCurrency || "BRL",
        language: profile.language || "pt-BR",
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

  const handleAddressSearch = async () => {
    if (addressSearch.length < 3) return
    setIsSearchingAddress(true)
    try {
      const results = await searchGlobalAddresses(addressSearch)
      setAddressSuggestions(results)
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na busca de endereço" })
    } finally {
      setIsSearchingAddress(false)
    }
  }

  const selectAddress = (suggestion: any) => {
    const mapped = mapNominatimToAddress(suggestion)
    setFormData((prev: any) => ({
      ...prev,
      location: {
        ...prev.location,
        country: mapped.country || prev.location.country,
        state: mapped.stateRegion || prev.location.state,
        city: mapped.city || prev.location.city,
        neighborhood: mapped.neighborhood || prev.location.neighborhood,
        street: mapped.addressLine1 || prev.location.street,
        postalCode: mapped.postalCode || prev.location.postalCode
      }
    }))
    setAddressSuggestions([])
    setAddressSearch("")
    toast({ title: "Endereço selecionado!" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || !profile) return

    setSaving(true)
    try {
      const userRef = doc(db, "users", user.uid)
      const { cpf, username, email, ...safeData } = formData; 

      if (!hasValidCPF && !skipCPF) {
        const clean = cpf.replace(/\D/g, "");
        if (!validateCPF(clean)) throw new Error("CPF inválido.");
        const cpfRes = await updateUserCPF(user.uid, clean);
        if (!cpfRes.success) throw new Error(cpfRes.error);
      }

      // Normalização de WhatsApp (apenas números)
      if (safeData.whatsapp) {
        safeData.whatsapp = safeData.whatsapp.replace(/\D/g, "");
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

  const isVerified = profile?.isVerified === true;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/perfil"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Editar Perfil</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Accordion type="multiple" defaultValue={["identidade"]} className="space-y-6">
          
          {/* SEÇÃO: IDENTIDADE */}
          <AccordionItem value="identidade" className="border-none">
            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <AccordionTrigger className="px-8 py-6 hover:no-underline hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary">Identidade</h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Dados básicos e visuais</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-8 pt-0 space-y-8">
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
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2 ml-1">
                        <Fingerprint className="w-3.5 h-3.5 text-secondary" /> CPF (Protegido)
                      </Label>
                      {!hasValidCPF && (
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black uppercase opacity-40 italic">Vincular depois</span>
                          <Switch checked={skipCPF} onCheckedChange={setSkipCPF} />
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <Input 
                        value={formData.cpf} 
                        onChange={e => setFormData({...formData, cpf: e.target.value.replace(/\D/g, "").substring(0, 11)})}
                        readOnly={hasValidCPF || skipCPF}
                        placeholder="000.000.000-00"
                        className={cn(
                          "rounded-xl h-12 font-mono font-bold pr-10", 
                          (hasValidCPF || skipCPF) ? "bg-muted/50 cursor-not-allowed" : "border-dashed border-secondary/30"
                        )} 
                        required={!skipCPF && !hasValidCPF}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {hasValidCPF ? <LockIcon className="w-4 h-4 text-muted-foreground opacity-30" /> : <ShieldCheck className="w-4 h-4 text-secondary" />}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Username (@)</Label>
                      <div className="relative">
                        <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-40" />
                        <Input value={formData.username} readOnly className="rounded-xl h-12 pl-10 bg-muted/50 cursor-not-allowed font-bold" />
                      </div>
                  </div>
                  <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Gênero</Label>
                      <Select value={formData.gender} onValueChange={v => setFormData({...formData, gender: v})}>
                        <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="masculino">Masculino</SelectItem>
                            <SelectItem value="feminino">Feminino</SelectItem>
                            <SelectItem value="nao-binario">Não-binário</SelectItem>
                            <SelectItem value="outro">Outro / Prefiro não dizer</SelectItem>
                        </SelectContent>
                      </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Bio / Apresentação</Label>
                  <Textarea value={formData.bio} maxLength={150} onChange={(e) => setFormData((prev:any) => ({...prev, bio: e.target.value}))} placeholder="Fale um pouco sobre sua essência cultural..." className="min-h-[100px] resize-none rounded-xl border-dashed" />
                </div>
              </AccordionContent>
            </Card>
          </AccordionItem>

          {/* SEÇÃO: CONTATO E VISIBILIDADE */}
          <AccordionItem value="contato" className="border-none">
            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <AccordionTrigger className="px-8 py-6 hover:no-underline hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary">Contato</h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Privacidade e canais digitais</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-8 pt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Email */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5" /> E-mail Público
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black uppercase opacity-40">{formData.emailPublico ? 'Visível' : 'Oculto'}</span>
                        <Switch checked={formData.emailPublico} onCheckedChange={v => setFormData({...formData, emailPublico: v})} />
                        {formData.emailPublico ? <Eye className="w-3 h-3 text-secondary" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                      </div>
                    </div>
                    <Input value={formData.email} readOnly className="rounded-xl h-11 bg-muted/30" />
                  </div>

                  {/* WhatsApp */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-green-500" /> WhatsApp
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black uppercase opacity-40">{formData.whatsappPublico ? 'Visível' : 'Oculto'}</span>
                        <Switch checked={formData.whatsappPublico} onCheckedChange={v => setFormData({...formData, whatsappPublico: v})} />
                        {formData.whatsappPublico ? <Eye className="w-3 h-3 text-secondary" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                      </div>
                    </div>
                    <Input 
                      placeholder="Ex: 51999999999" 
                      value={formData.whatsapp} 
                      onChange={e => setFormData({...formData, whatsapp: e.target.value.replace(/\D/g, "")})} 
                      className="rounded-xl h-11"
                    />
                  </div>

                  {/* Instagram */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                        <Instagram className="w-3.5 h-3.5 text-pink-500" /> Instagram (@)
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black uppercase opacity-40">{formData.instagramPublico ? 'Visível' : 'Oculto'}</span>
                        <Switch checked={formData.instagramPublico} onCheckedChange={v => setFormData({...formData, instagramPublico: v})} />
                        {formData.instagramPublico ? <Eye className="w-3 h-3 text-secondary" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                      </div>
                    </div>
                    <Input 
                      placeholder="seu_username" 
                      value={formData.instagram} 
                      onChange={e => setFormData({...formData, instagram: e.target.value.replace('@', '')})} 
                      className="rounded-xl h-11"
                    />
                  </div>

                  {/* Facebook */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                        <Facebook className="w-3.5 h-3.5 text-blue-600" /> Facebook
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black uppercase opacity-40">{formData.facebookPublico ? 'Visível' : 'Oculto'}</span>
                        <Switch checked={formData.facebookPublico} onCheckedChange={v => setFormData({...formData, facebookPublico: v})} />
                        {formData.facebookPublico ? <Eye className="w-3 h-3 text-secondary" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                      </div>
                    </div>
                    <Input 
                      placeholder="seu.perfil" 
                      value={formData.facebook} 
                      onChange={e => setFormData({...formData, facebook: e.target.value})} 
                      className="rounded-xl h-11"
                    />
                  </div>
                </div>
              </AccordionContent>
            </Card>
          </AccordionItem>

          {/* SEÇÃO: ENDEREÇO E LOCALIZAÇÃO */}
          <AccordionItem value="endereco" className="border-none">
            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <AccordionTrigger className="px-8 py-6 hover:no-underline hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary">Localização</h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Suporte global e visibilidade</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-8 pt-0 space-y-8">
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                    <Search className="w-3 h-3" /> Autocompletar Endereço (Global)
                  </Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Digite sua rua, cidade ou CEP..." 
                      value={addressSearch}
                      onChange={e => setAddressSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddressSearch())}
                      className="rounded-xl h-12 border-dashed border-secondary/30 bg-white"
                    />
                    <Button type="button" onClick={handleAddressSearch} disabled={isSearchingAddress} className="h-12 px-6 rounded-xl bg-secondary text-white font-bold">
                       {isSearchingAddress ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
                    </Button>
                  </div>

                  {addressSuggestions.length > 0 && (
                    <div className="p-2 bg-white rounded-2xl border shadow-xl animate-in slide-in-from-top-2 z-20">
                       {addressSuggestions.map((s, i) => (
                         <button
                           key={i}
                           type="button"
                           onClick={() => selectAddress(s)}
                           className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 rounded-xl text-left transition-colors group border-b last:border-0"
                         >
                            <MapPin className="w-4 h-4 text-secondary opacity-40 group-hover:opacity-100" />
                            <div className="flex-1 min-w-0">
                               <p className="text-xs font-bold truncate">{s.display_name}</p>
                            </div>
                         </button>
                       ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">CEP / Postal Code</Label>
                      <Input value={formData.location.postalCode} onChange={e => setFormData({...formData, location: {...formData.location, postalCode: e.target.value}})} className="rounded-xl h-11" />
                   </div>
                   <div className="md:col-span-2 space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">País</Label>
                      <Input value={formData.location.country} onChange={e => setFormData({...formData, location: {...formData.location, country: e.target.value}})} className="rounded-xl h-11" />
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Estado / Província / Região</Label>
                      <Input value={formData.location.state} onChange={e => setFormData({...formData, location: {...formData.location, state: e.target.value}})} className="rounded-xl h-11" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Cidade</Label>
                      <Input value={formData.location.city} onChange={e => setFormData({...formData, location: {...formData.location, city: e.target.value}})} className="rounded-xl h-11" />
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Bairro</Label>
                      <Input value={formData.location.neighborhood} onChange={e => setFormData({...formData, location: {...formData.location, neighborhood: e.target.value}})} className="rounded-xl h-11" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Rua / Logradouro</Label>
                      <Input value={formData.location.street} onChange={e => setFormData({...formData, location: {...formData.location, street: e.target.value}})} className="rounded-xl h-11" />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Número</Label>
                      <Input value={formData.location.number} onChange={e => setFormData({...formData, location: {...formData.location, number: e.target.value}})} className="rounded-xl h-11" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Complemento</Label>
                      <Input value={formData.location.complement} onChange={e => setFormData({...formData, location: {...formData.location, complement: e.target.value}})} className="rounded-xl h-11" />
                   </div>
                </div>

                <Separator className="border-dashed" />

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-secondary" /> Visibilidade do Endereço
                  </Label>
                  <Select value={formData.addressVisibility} onValueChange={v => setFormData({...formData, addressVisibility: v})}>
                    <SelectTrigger className="rounded-xl h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="full">Exibir endereço completo</SelectItem>
                      <SelectItem value="city">Exibir apenas Cidade e País</SelectItem>
                      <SelectItem value="hidden">Ocultar localização do perfil</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase italic px-1">
                    {formData.addressVisibility === 'full' ? 'Todos verão seu endereço completo.' : 
                     formData.addressVisibility === 'city' ? 'Apenas sua cidade e país serão visíveis.' :
                     'Sua localização não aparecerá para outros usuários.'}
                  </p>
                </div>
              </AccordionContent>
            </Card>
          </AccordionItem>

          {/* SEÇÃO: PREFERÊNCIAS */}
          <AccordionItem value="preferencias" className="border-none">
            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <AccordionTrigger className="px-8 py-6 hover:no-underline hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                    <Languages className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary">Preferências</h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Sistema e localização</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 gap-6">
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
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>

        <div className="flex justify-end gap-3 pt-6">
          <Button type="button" variant="ghost" onClick={() => router.back()} className="rounded-xl px-8 font-bold uppercase text-xs">Cancelar</Button>
          <Button type="submit" className="bg-secondary text-white font-black px-12 h-16 rounded-[1.5rem] shadow-xl shadow-secondary/20 uppercase italic text-lg hover:scale-[1.02] transition-all" disabled={saving || avatarProgress !== null || bannerProgress !== null}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </form>
    </div>
  )
}
