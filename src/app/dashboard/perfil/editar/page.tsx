"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc, useFirebaseApp } from "@/firebase"
import { 
  doc, 
  updateDoc, 
  serverTimestamp, 
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Loader2, 
  ArrowLeft, 
  Save, 
  Upload, 
  Lock, 
  ShieldCheck, 
  EyeOff,
  Fingerprint,
  AlertTriangle,
  Camera,
  Trash2
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { getUserCPF, updateUserCPF } from "@/app/actions/user"
import { maskCPF } from "@/lib/crypto-utils"

const DEFAULT_PROFILE_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fprofile.jpeg?alt=media";

export default function EditarPerfilPage() {
  const router = useRouter()
  const auth = useAuth()
  const { user } = useUser(auth)
  const db = useFirestore()
  const app = useFirebaseApp()
  const isInitialized = useRef(false)

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
    privacy: {
       profilePrivate: false,
       hideFollowers: false,
       hideStats: false,
       hideGamification: false,
       hideLocation: false
    }
  })
  
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [isFetchingCPF, setIsFetchingCPF] = useState(false)
  const [hasOriginalCPF, setHasOriginalCPF] = useState(false)

  useEffect(() => {
    if (profile && user && !isInitialized.current) {
      isInitialized.current = true
      
      const dbCpf = profile.cpf || "";
      const cpfIsMissing = !dbCpf || dbCpf === "PENDENTE";

      setFormData((prev: any) => ({
        ...prev,
        name: profile.name || "",
        username: profile.username || "",
        avatar: profile.avatar || DEFAULT_PROFILE_IMAGE,
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
        cpf: dbCpf,
        showEmail: profile.showEmail !== undefined ? profile.showEmail : true,
        privacy: profile.privacy || {
           profilePrivate: false,
           hideFollowers: false,
           hideStats: false,
           hideGamification: false,
           hideLocation: false
        }
      }));

      if (cpfIsMissing) {
        setIsFetchingCPF(true);
        getUserCPF(user.uid, user.uid).then(res => {
          if (res.success && res.cpf) {
            setFormData((prev: any) => ({ ...prev, cpf: maskCPF(res.cpf!) }));
            setHasOriginalCPF(true);
          } else {
            setFormData((prev: any) => ({ ...prev, cpf: "" }));
            setHasOriginalCPF(false);
          }
        }).catch(() => {
          setFormData((prev: any) => ({ ...prev, cpf: "" }));
          setHasOriginalCPF(false);
        }).finally(() => setIsFetchingCPF(false));
      } else {
        setHasOriginalCPF(true);
      }
    }
  }, [profile, user])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return

    setUploadProgress(0)
    try {
      const storageRef = ref(storage, `users/${user.uid}/avatar_${Date.now()}`)
      const uploadTask = uploadBytesResumable(storageRef, file)
      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        (error) => { 
          setUploadProgress(null); 
          toast({ variant: "destructive", title: "Erro no upload", description: "Verifique o formato da imagem." }); 
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setFormData((prev: any) => ({ ...prev, avatar: downloadURL }))
          setUploadProgress(null)
          toast({ title: "Imagem carregada!" })
        }
      )
    } catch (err) { setUploadProgress(null) }
  }

  const handleRemovePhoto = () => {
    setFormData((prev: any) => ({ ...prev, avatar: DEFAULT_PROFILE_IMAGE }));
    toast({ title: "Foto removida", description: "A imagem padrão foi restaurada." });
  }

  const formatCPF = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    if (v.length > 3) return v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    return v;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || !profile) return

    setSaving(true)
    
    try {
      const userRef = doc(db, "users", user.uid)
      const { cpf, username, email, uid, ...safeData } = formData; 

      const updateData: any = {
        ...safeData,
        updatedAt: serverTimestamp()
      }

      if (!hasOriginalCPF && cpf && cpf.length >= 11 && !cpf.includes('*')) {
        const cleanCPF = cpf.replace(/\D/g, "");
        await updateUserCPF(user.uid, cleanCPF);
        updateData.cpf = maskCPF(cleanCPF);
      }

      await updateDoc(userRef, updateData)
      toast({ title: "Perfil atualizado!" })
      router.push("/dashboard/perfil")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Verifique os dados informados." })
    } finally {
      setSaving(false)
    }
  }

  if (profileLoading) return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  const isCPFReadOnly = isFetchingCPF || hasOriginalCPF;
  const isUsingDefault = formData.avatar === DEFAULT_PROFILE_IMAGE;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/perfil"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Editar Perfil Pessoal</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="bg-muted/30 pb-8">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Identidade Visual</CardTitle>
            <CardDescription className="font-medium">Sua imagem na comunidade Viby.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-8">
            <div className="flex flex-col items-center gap-6 py-4">
              <div className="relative group">
                <Avatar className="h-40 w-40 border-8 border-background shadow-2xl rounded-[3rem]">
                  <AvatarImage src={formData.avatar} alt={formData.name} className="object-cover" />
                  <AvatarFallback className="text-4xl font-black bg-muted">{formData.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 text-white rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity shadow-inner">
                   <label htmlFor="avatar-upload" className="p-3 bg-white/20 rounded-full hover:bg-white/40 cursor-pointer transition-colors">
                      <Camera className="w-6 h-6" />
                   </label>
                   {!isUsingDefault && (
                     <button 
                       type="button"
                       onClick={handleRemovePhoto}
                       className="p-3 bg-destructive/60 rounded-full hover:bg-destructive transition-colors"
                       title="Remover Foto"
                     >
                        <Trash2 className="w-6 h-6" />
                     </button>
                   )}
                </div>
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>
              {uploadProgress !== null && <div className="w-full max-w-xs space-y-2"><Progress value={uploadProgress} className="h-1.5" /><p className="text-[9px] text-center text-muted-foreground font-black uppercase tracking-widest">Carregando: {Math.round(uploadProgress)}%</p></div>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Nome Completo</Label><Input value={formData.name} onChange={(e) => setFormData((prev:any) => ({...prev, name: e.target.value}))} required className="rounded-xl h-11" /></div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Username (@)</Label>
                <div className="relative">
                  <Input value={formData.username} readOnly className="bg-muted/50 cursor-not-allowed pr-10 font-bold rounded-xl h-11" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2"><Lock className="w-4 h-4 text-muted-foreground opacity-50" /></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Nascimento</Label><Input type="date" value={formData.birthDate} onChange={(e) => setFormData((prev:any) => ({...prev, birthDate: e.target.value}))} required className="rounded-xl h-11" /></div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Sexo / Gênero</Label>
                <Select key={formData.gender || 'loading'} value={formData.gender} onValueChange={(val) => setFormData((prev:any) => ({...prev, gender: val}))} required>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="agênero">Agênero</SelectItem>
                    <SelectItem value="gênero fluido">Gênero fluido</SelectItem>
                    <SelectItem value="bigênero">Bigênero</SelectItem>
                    <SelectItem value="demigênero">Demigênero</SelectItem>
                    <SelectItem value="homem trans">Homem trans</SelectItem>
                    <SelectItem value="mulher trans">Mulher trans</SelectItem>
                    <SelectItem value="outro">Outro / Prefiro não dizer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                <Fingerprint className="w-3.5 h-3.5 text-secondary" /> CPF (Identificador Permanente)
              </Label>
              <div className="relative">
                 <Input 
                   value={formData.cpf} 
                   onChange={e => !isCPFReadOnly && setFormData({...formData, cpf: formatCPF(e.target.value)})}
                   readOnly={isCPFReadOnly}
                   placeholder="000.000.000-00"
                   className={cn(
                     "rounded-xl h-11 font-mono font-bold pr-10 transition-all",
                     isCPFReadOnly ? "bg-muted/50 cursor-not-allowed border-transparent" : "border-dashed border-secondary/30 focus-visible:ring-secondary/30"
                   )} 
                 />
                 <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isFetchingCPF ? (
                      <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                    ) : isCPFReadOnly ? (
                      <Lock className="w-4 h-4 text-muted-foreground opacity-50" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-secondary" />
                    )}
                 </div>
              </div>
              {!isCPFReadOnly ? (
                <div className="p-3 bg-orange-50 rounded-xl border border-dashed border-orange-200 flex items-start gap-2 mt-2 animate-in zoom-in-95">
                   <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                   <p className="text-[9px] font-bold text-orange-800 uppercase leading-tight">Você ainda não possui CPF vinculado. Informe o número real para habilitar transferências e compras. Esta ação é irreversível.</p>
                </div>
              ) : (
                <p className="text-[8px] font-bold text-muted-foreground uppercase mt-1">O CPF não pode ser alterado por segurança da sua carteira e ingressos.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Sua Bio (Curta e Direta)</Label>
              <Textarea value={formData.bio} maxLength={150} onChange={(e) => setFormData((prev:any) => ({...prev, bio: e.target.value}))} placeholder="Conte um pouco sobre você..." className="min-h-[100px] resize-none rounded-xl border-dashed" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden border-t-8 border-secondary/20">
           <CardHeader className="bg-secondary/5">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                 <ShieldCheck className="w-5 h-5 text-secondary" /> Privacidade e LGPD
              </CardTitle>
              <CardDescription className="font-medium">Você tem controle total sobre seus dados na Viby.</CardDescription>
           </CardHeader>
           <CardContent className="p-8 space-y-6">
              <PrivacyToggle 
                label="Ocultar Minhas Estatísticas" 
                desc="Gêneros musicais e bairros mais frequentados não serão exibidos publicamente."
                checked={formData.privacy.hideStats}
                onChange={v => setFormData((prev:any) => ({...prev, privacy: {...prev.privacy, hideStats: v}}))}
              />
              <PrivacyToggle 
                label="Ocultar Gamificação" 
                desc="Nível e XP não aparecerão para outros usuários."
                checked={formData.privacy.hideGamification}
                onChange={v => setFormData((prev:any) => ({...prev, privacy: {...prev.privacy, hideGamification: v}}))}
              />
              <PrivacyToggle 
                label="Ocultar Localização" 
                desc="Sua cidade e estado serão omitidos do perfil público."
                checked={formData.privacy.hideLocation}
                onChange={v => setFormData((prev:any) => ({...prev, privacy: {...prev.privacy, hideLocation: v}}))}
              />
              <PrivacyToggle 
                label="Ocultar Meus Seguidores" 
                desc="A lista de quem te acompanha ficará invisível."
                checked={formData.privacy.hideFollowers}
                onChange={v => setFormData((prev:any) => ({...prev, privacy: {...prev.privacy, hideFollowers: v}}))}
              />
           </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-6">
          <Button type="button" variant="ghost" onClick={() => router.back()} className="rounded-xl px-8 font-bold uppercase text-xs">Cancelar</Button>
          <Button type="submit" className="bg-secondary text-white font-black px-12 h-14 rounded-2xl shadow-xl uppercase italic text-lg" disabled={saving || uploadProgress !== null}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </form>
    </div>
  )
}

function PrivacyToggle({ label, desc, checked, onChange }: { label: string, desc: string, checked: boolean, onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between p-4 bg-muted/20 rounded-2xl border border-dashed border-border/50 group transition-all hover:bg-white hover:shadow-sm">
       <div className="space-y-0.5">
          <p className="font-bold text-sm text-primary flex items-center gap-2">
             {checked ? <EyeOff className="w-4 h-4 text-orange-500" /> : <ShieldCheck className="w-4 h-4 text-green-500" />}
             {label}
          </p>
          <p className="text-[10px] text-muted-foreground font-medium max-w-xs">{desc}</p>
       </div>
       <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
