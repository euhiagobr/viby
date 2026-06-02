"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc, useFirebaseApp } from "@/firebase"
import { 
  doc, 
  updateDoc, 
  serverTimestamp, 
  getDoc, 
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Loader2, 
  ArrowLeft, 
  Save, 
  Upload, 
  User as UserIcon, 
  Check,
  X,
  Fingerprint,
  Lock,
  Globe,
  ShieldCheck,
  ShieldAlert,
  EyeOff,
  RefreshCcw
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { maskCPF } from "@/lib/crypto-utils"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { getUserCPF, updateUserCPF } from "@/app/actions/user"
import { Separator } from "@/components/ui/separator"

const validateCPF = (cpf: string) => {
  const cleanCPF = cpf.replace(/\D/g, "");
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCPF)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

  return true;
};

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
  const [saving, setSaving] = setSaving(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [hasCPFInPrivate, setHasCPFInPrivate] = useState(false)
  const [loadingCPF, setLoadingCPF] = useState(false)

  useEffect(() => {
    if (profile && user && !isInitialized.current) {
      isInitialized.current = true
      
      setFormData((prev: any) => ({
        ...prev,
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
        showEmail: profile.showEmail !== undefined ? profile.showEmail : true,
        privacy: profile.privacy || {
           profilePrivate: false,
           hideFollowers: false,
           hideStats: false,
           hideGamification: false,
           hideLocation: false
        }
      }));

      setLoadingCPF(true);
      getUserCPF(user.uid, user.uid).then(res => {
        if (res.success && res.cpf) {
          setFormData((prev: any) => ({ ...prev, cpf: res.cpf! }));
          setHasCPFInPrivate(true);
        }
        setLoadingCPF(false);
      }).catch(() => setLoadingCPF(false));
    }
  }, [profile, user])

  const formatCPFInput = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    if (v.length > 3) return v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    return v;
  }

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData((prev: any) => ({ ...prev, cpf: formatCPFInput(e.target.value) }));

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
          setFormData((prev: any) => ({ ...prev, avatar: downloadURL }))
          setUploadProgress(null)
          toast({ title: "Imagem carregada!" })
        }
      )
    } catch (err) { setUploadProgress(null) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || !profile) return

    if (formData.cpf && !validateCPF(formData.cpf)) {
      toast({ variant: "destructive", title: "CPF Inválido", description: "O número de CPF informado não é válido." })
      return
    }

    setSaving(true)
    
    try {
      if (formData.cpf && !hasCPFInPrivate) {
        await updateUserCPF(user.uid, formData.cpf);
      }

      const userRef = doc(db, "users", user.uid)
      const { cpf, username, ...safeData } = formData; 
      
      const updateData = {
        ...safeData,
        updatedAt: serverTimestamp()
      }

      await updateDoc(userRef, updateData)
      toast({ title: "Perfil atualizado!" })
      router.push("/dashboard/perfil")
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar" })
    } finally {
      setSaving(false)
    }
  }

  const handleUnlockCPF = () => {
    if (confirm("Deseja alterar seu CPF? Você precisará preencher o número completo novamente.")) {
      setHasCPFInPrivate(false);
      setFormData((prev: any) => ({ ...prev, cpf: "" }));
    }
  }

  if (profileLoading) return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

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
                <label htmlFor="avatar-upload" className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-inner">
                   <Upload className="w-8 h-8" />
                </label>
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>
              {uploadProgress !== null && <div className="w-full max-w-xs space-y-2"><Progress value={uploadProgress} className="h-1.5" /><p className="text-[9px] text-center text-muted-foreground font-black uppercase tracking-widest">Carregando: {Math.round(uploadProgress)}%</p></div>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Nome Completo</Label><Input value={formData.name} onChange={(e) => setFormData((prev:any) => ({...prev, name: e.target.value}))} required className="rounded-xl h-11" /></div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Username (@)</Label>
                <div className="relative">
                  <Input value={formData.username} readOnly className="bg-muted/50 cursor-not-allowed pr-10 font-bold rounded-xl h-11" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2"><Lock className="w-4 h-4 text-muted-foreground opacity-50" /></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Nascimento</Label><Input type="date" value={formData.birthDate} onChange={(e) => setFormData((prev:any) => ({...prev, birthDate: e.target.value}))} required className="rounded-xl h-11" /></div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Sexo / Gênero</Label>
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
                <Fingerprint className="w-3.5 h-3.5 text-secondary" /> 
                CPF 
                {hasCPFInPrivate && <Lock className="w-3 h-3 text-muted-foreground ml-auto" />}
                {loadingCPF && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
              </Label>
              <div className="flex gap-2">
                 <Input 
                   value={hasCPFInPrivate ? maskCPF(formData.cpf) : formData.cpf} 
                   onChange={handleCPFChange} 
                   placeholder="000.000.000-00" 
                   disabled={hasCPFInPrivate} 
                   className={cn("rounded-xl h-11 flex-1", hasCPFInPrivate && "bg-muted/50 cursor-not-allowed")} 
                 />
                 {hasCPFInPrivate && (
                   <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={handleUnlockCPF} title="Alterar CPF">
                     <RefreshCcw className="w-4 h-4" />
                   </Button>
                 )}
              </div>
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
