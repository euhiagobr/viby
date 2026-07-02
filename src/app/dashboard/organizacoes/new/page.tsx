
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useFirebaseApp, useDoc } from "@/firebase"
import { doc, getDoc, runTransaction, serverTimestamp, increment, query, collection, where, getDocs, limit } from "firebase/firestore"
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
  Info,
  User,
  ShieldCheck,
  AlertTriangle,
  Clock
} from "lucide-react"
import Link from "next/link"
import { cn, validateCPF, validateCNPJ } from "@/lib/utils"
import Image from "next/image"
import { EventLocation } from "@/components/events"

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
    category: "Comunidade e Instituições",
    items: ["ONG", "Associação", "Coletivo", "Fundação", "Organização Social", "Instituição Pública", "Prefeitura", "Secretaria", "Câmara Municipal", "Projeto Social", "Igreja", "Organização Religiosa", "Centro Comunitário"]
  },
  {
    category: "Categoria Genérica",
    items: ["Outro"]
  }
]

const RESERVED_USERNAMES = [
  "admin", "suporte", "support", "help", "ajuda", "dashboard", "login", "cadastro", 
  "signup", "signin", "redefinir-senha", "reset-password", "checkout", "privacidade", 
  "privacy", "termos", "terms", "api", "viby", "oficial", "official", "status", 
  "settings", "configuracoes", "root", "sys", "system", "onboarding", "para-organizadores", "empresas"
];

export default function NovaOrganizacaoPage() {
  const router = useRouter()
  const auth = useAuth()
  const { user, profile } = useUser(auth)
  const db = useFirestore()
  const app = useFirebaseApp()

  const blockedRef = React.useMemo(() => (db ? doc(db, 'settings', 'blocked_usernames') : null), [db]);
  const { data: blockedData } = useDoc<any>(blockedRef);

  const [loading, setLoading] = useState(false)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'valid' | 'invalid' | 'taken'>('idle')
  const [avatarUploadProgress, setAvatarUploadProgress] = useState<number | null>(null)
  const [bannerUploadProgress, setBannerUploadProgress] = useState<number | null>(null)
  const [skipFiscal, setSkipFiscal] = useState(false)
  
  const [formData, setFormData] = useState({
    tipoOrganizacao: "individual",
    name: "",
    username: "",
    type: "",
    bio: "",
    avatar: "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Forganizacao.jpeg?alt=media",
    banner: "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fcapa.jpeg?alt=media",
    phone: "",
    contactEmail: "",
    website: "",
    instagram: "",
    cpf: "",
    cnpj: "",
    razaoSocial: "",
    nomeFantasia: "",
    representanteLegalCpf: "",
    address: { 
      venueName: "",
      addressLine1: "", 
      addressLine2: "",
      streetNumber: "",
      neighborhood: "", 
      city: "", 
      stateRegion: "", 
      country: "Brasil", 
      countryCode: "BR",
      postalCode: "", 
      latitude: -23.55052, 
      longitude: -46.633308,
      formattedAddress: "",
      isCustomized: false
    },
    showPhone: true,
    showEmail: true,
    showWebsite: true,
    showInstagram: true,
    showAddress: true,
    showNeighborhood: true,
    showState: true
  })

  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app);
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

    if (RESERVED_USERNAMES.includes(newUsername) || blockedData?.list?.includes(newUsername)) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || !profile || usernameStatus !== 'valid') {
        toast({ variant: "destructive", title: "Verifique os dados" })
        return
    }

    if (!skipFiscal) {
      if (formData.tipoOrganizacao === 'individual') {
        if (!validateCPF(formData.cpf)) {
          toast({ variant: "destructive", title: "CPF Inválido" });
          return;
        }
      } else {
        if (!validateCNPJ(formData.cnpj)) {
          toast({ variant: "destructive", title: "CNPJ Inválido" });
          return;
        }
        if (!validateCPF(formData.representanteLegalCpf)) {
          toast({ variant: "destructive", title: "CPF do Representante Inválido" });
          return;
        }
      }
    }

    setLoading(true)
    const orgId = crypto.randomUUID()
    const normalizedUsername = formData.username.toLowerCase().trim()

    try {
      // 1. Recuperar e Validar Campanha Pendente do sessionStorage
      let autoFees: any = {};
      const pendingCode = typeof window !== 'undefined' ? sessionStorage.getItem('viby_pending_campaign') : null;
      
      if (pendingCode) {
        const q = query(
          collection(db, "simulation_campaigns"), 
          where("code", "==", pendingCode.toUpperCase()), 
          where("active", "==", true), 
          limit(1)
        );
        const campSnap = await getDocs(q);
        
        if (!campSnap.empty) {
          const camp = campSnap.docs[0].data();
          const now = new Date();
          const start = camp.startAt?.toDate ? camp.startAt.toDate() : new Date(camp.startAt);
          const end = camp.endAt?.toDate ? camp.endAt.toDate() : new Date(camp.endAt);
          
          if (now >= start && now <= end) {
            autoFees = {
              customOrganizerPercent: camp.orgFeePercent,
              customOrganizerMinFee: camp.orgMinFee,
              customBuyerMarkup: camp.buyerFeePercent,
              customFeeStartAt: camp.startAt,
              customFeeEndAt: camp.endAt
            };
          }
        }
      }

      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, "usernames", normalizedUsername)
        const orgRef = doc(db, "organizations", orgId)
        const memberRef = doc(db, "organizations", orgId, "members", user.uid)

        const usernameSnap = await transaction.get(usernameRef)
        if (usernameSnap.exists()) throw new Error("Username já ocupado.")

        transaction.set(usernameRef, { 
          uid: orgId, 
          type: 'organization',
          username: normalizedUsername
        })

        const finalData = { ...formData, ...autoFees };
        if (skipFiscal) {
          finalData.cpf = "";
          finalData.cnpj = "";
          finalData.razaoSocial = "";
          finalData.nomeFantasia = "";
          finalData.representanteLegalCpf = "";
        }

        // Aliases para busca rápida
        const searchableData = {
          ...finalData,
          city: finalData.address.city,
          state: finalData.address.stateRegion,
          latitude: finalData.address.latitude,
          longitude: finalData.address.longitude,
          neighborhood: finalData.address.neighborhood
        };

        // Regras de Afiliado CONGELADAS
        const affiliateData = {
           originalAffiliateId: profile.referredBy || null,
           affiliateExpireAt: profile.affiliateExpireAt || null,
           originalOwnerId: user.uid
        };

        transaction.set(orgRef, {
          id: orgId,
          ...searchableData,
          ...affiliateData,
          username: normalizedUsername,
          slug: normalizedUsername,
          createdBy: user.uid,
          ownerId: user.uid, 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          verified: false,
          payoutSettings: { status: 'none' },
          status: 'Ativo',
          needsFiscalSync: skipFiscal
        })

        transaction.set(memberRef, {
          userId: user.uid,
          role: 'owner',
          status: 'accepted',
          createdAt: serverTimestamp()
        })
        
        if (profile.referredBy) {
          const statsRef = doc(db, "affiliate_stats", profile.referredBy);
          transaction.update(statsRef, {
             totalOrgsLinked: increment(1),
             updatedAt: serverTimestamp()
          });
        }
      })

      // 2. Limpar a campanha da sessão após sucesso
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('viby_pending_campaign');
      }

      toast({ title: "Organização criada!", description: "Sua marca está pronta para brilhar!" })
      localStorage.setItem('viby_current_org', orgId);
      router.push(`/dashboard/organizacoes/${normalizedUsername}`)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao criar", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const isIndividual = formData.tipoOrganizacao === 'individual';

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
        <Card className="border-none shadow-sm rounded-[2rem] bg-white">
           <CardContent className="p-8">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Tipo de Cadastro</Label>
              <div className="grid grid-cols-2 gap-4 mt-3">
                 <button 
                   type="button"
                   onClick={() => setFormData({...formData, tipoOrganizacao: 'individual'})}
                   className={cn(
                     "flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all gap-2",
                     isIndividual ? "border-secondary bg-secondary/5 text-primary shadow-inner" : "border-border bg-white text-muted-foreground hover:bg-muted/30"
                   )}
                 >
                    <User className="w-6 h-6" />
                    <span className="font-black uppercase italic text-xs">Pessoa Física</span>
                 </button>
                 <button 
                   type="button"
                   onClick={() => setFormData({...formData, tipoOrganizacao: 'company'})}
                   className={cn(
                     "flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all gap-2",
                     !isIndividual ? "border-secondary bg-secondary/5 text-primary shadow-inner" : "border-border bg-white text-muted-foreground hover:bg-muted/30"
                   )}
                 >
                    <Building2 className="w-6 h-6" />
                    <span className="font-black uppercase italic text-xs">Pessoa Jurídica</span>
                 </button>
              </div>
           </CardContent>
        </Card>

        <Card className="border-none shadow-sm overflow-hidden rounded-[2rem]">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg flex items-center gap-2"><Camera className="w-5 h-5 text-secondary" /> Identidade Visual</CardTitle>
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
             <CardTitle className="text-lg flex items-center gap-2"><Info className="w-5 h-5 text-secondary" /> Informações do Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">
                    {isIndividual ? "Nome Completo" : "Nome Fantasia"}
                  </Label>
                  <Input 
                    id="name" 
                    placeholder={isIndividual ? "Seu nome como no documento" : "Ex: Viby Entretenimento"} 
                    value={formData.name}
                    onChange={handleNameChange}
                    required 
                    className="rounded-xl h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Username exclusivo (@)</Label>
                  <div className="relative">
                    <Input 
                      id="username" 
                      placeholder="Somente letras e números" 
                      value={formData.username}
                      onChange={e => setFormData(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
                      className="rounded-xl h-11 pr-10"
                      required
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checkingUsername ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : 
                       usernameStatus === 'valid' ? <Check className="w-4 h-4 text-green-500" /> : 
                       usernameStatus === 'taken' || usernameStatus === 'invalid' ? <X className="w-4 h-4 text-destructive" /> : null}
                    </div>
                  </div>
                </div>
             </div>

             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Tipo de Organização</Label>
                <Select value={formData.type} onValueChange={val => setFormData(prev => ({ ...prev, type: val }))} required>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue placeholder="Selecione o segmento" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] rounded-xl shadow-2xl">
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
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Bio / Descrição</Label>
                <Textarea 
                  placeholder="Conte um pouco sobre o que vocês fazem..." 
                  value={formData.bio}
                  onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  className="min-h-[100px] resize-none rounded-xl border-dashed border-secondary/30"
                />
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
             <CardTitle className="text-lg flex items-center gap-2"><Fingerprint className="w-5 h-5 text-secondary" /> Dados Fiscais</CardTitle>
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase opacity-40 italic">Informar depois</span>
                <Switch checked={skipFiscal} onCheckedChange={setSkipFiscal} />
             </div>
          </CardHeader>
          <CardContent className="space-y-6">
             {skipFiscal ? (
               <div className="p-6 bg-orange-50 rounded-2xl border-2 border-dashed border-orange-200 flex items-start gap-4 animate-in zoom-in-95">
                  <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                     <h4 className="font-black uppercase text-xs italic text-orange-800">Atenção: Recebimentos Bloqueados</h4>
                     <p className="text-[10px] text-orange-700 font-medium leading-relaxed uppercase">
                        Você pode criar a marca agora, mas não poderá lançar eventos pagos ou receber repasses financeiros até que o CPF/CNPJ seja vinculado e aprovado.
                     </p>
                  </div>
               </div>
             ) : (
               <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                 {isIndividual ? (
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">CPF (Titular)</Label>
                      <Input 
                        value={formData.cpf}
                        onChange={e => {
                          const numbers = e.target.value.replace(/\D/g, "");
                          setFormData(prev => ({ ...prev, cpf: numbers.substring(0, 11) }))
                        }}
                        placeholder="000.000.000-00" 
                        className="rounded-xl h-11 font-mono"
                        required
                      />
                   </div>
                 ) : (
                   <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Razão Social</Label>
                          <Input 
                            value={formData.razaoSocial}
                            onChange={e => setFormData(prev => ({ ...prev, razaoSocial: e.target.value }))}
                            placeholder="Nome oficial da empresa" 
                            className="rounded-xl h-11"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">CNPJ</Label>
                          <Input 
                            value={formData.cnpj}
                            onChange={e => {
                              const numbers = e.target.value.replace(/\D/g, "");
                              setFormData(prev => ({ ...prev, cnpj: numbers.substring(0, 14) }))
                            }}
                            placeholder="00.000.000/0000-00" 
                            className="rounded-xl h-11 font-mono"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">CPF do Representante Legal</Label>
                        <Input 
                          value={formData.representanteLegalCpf}
                          onChange={e => {
                            const numbers = e.target.value.replace(/\D/g, "");
                            setFormData(prev => ({ ...prev, representanteLegalCpf: numbers.substring(0, 11) }))
                          }}
                          placeholder="000.000.000-00" 
                          className="rounded-xl h-11 font-mono"
                          required
                        />
                      </div>
                   </div>
                 )}
               </div>
             )}
          </CardContent>
        </Card>

        <div className="space-y-10">
          <div className="flex items-center gap-3 px-2">
            <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
              <MapPin className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Sede da Marca</h2>
          </div>
          <EventLocation 
            address={formData.address} 
            onChange={v => setFormData({...formData, address: v})} 
          />
        </div>

        <Card className="border-none shadow-sm rounded-[2rem]">
          <CardHeader>
             <CardTitle className="text-lg flex items-center gap-2"><Globe className="w-5 h-5 text-secondary" /> Contato & Presença Digital</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Phone className="w-3 h-3" /> WhatsApp (Opcional)</Label>
                  <Input value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} placeholder="(00) 00000-0000" className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Mail className="w-3 h-3" /> E-mail Público (Opcional)</Label>
                  <Input type="email" value={formData.contactEmail} onChange={e => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))} placeholder="contato@empresa.com" className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Globe className="w-3 h-3" /> Site Oficial (Opcional)</Label>
                  <Input value={formData.website} onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))} placeholder="https://www.empresa.com" className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Instagram className="w-3 h-3" /> Instagram (Opcional)</Label>
                  <Input value={formData.instagram} onChange={e => setFormData(prev => ({ ...prev, instagram: e.target.value.replace('@', '') }))} placeholder="usuario_instagram" className="rounded-xl h-11" />
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
            className="bg-secondary text-white hover:bg-secondary/90 px-12 h-14 rounded-2xl font-black shadow-xl shadow-secondary/20 uppercase italic transition-all hover:scale-[1.02]" 
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
