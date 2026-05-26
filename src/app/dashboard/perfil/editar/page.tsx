
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
  Globe
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { maskCPF } from "@/lib/crypto-utils"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { getUserCPF, updateUserCPF } from "@/app/actions/user"

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

  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app, 'gs://viby');
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
    showEmail: true
  })
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [hasCPFInPrivate, setHasCPFInPrivate] = useState(false)

  useEffect(() => {
    if (profile && user) {
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
        cpf: "", 
        showEmail: profile.showEmail !== undefined ? profile.showEmail : true
      });

      getUserCPF(user.uid, user.uid).then(res => {
        if (res.success) {
          setFormData(prev => ({ ...prev, cpf: res.cpf! }));
          setHasCPFInPrivate(true);
        }
      });
    }
  }, [profile, user])

  const formatCPF = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    if (v.length > 3) return v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    return v;
  }

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, cpf: formatCPF(e.target.value) }));

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

    if (formData.cpf && !validateCPF(formData.cpf)) {
      toast({ variant: "destructive", title: "CPF Inválido", description: "O número de CPF informado não é válido." })
      return
    }

    setSaving(true)
    
    try {
      if (formData.cpf && (!hasCPFInPrivate || formData.cpf !== await getUserCPF(user.uid, user.uid).then(r => r.cpf))) {
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

  if (profileLoading) return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  const isCpfLocked = hasCPFInPrivate;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/perfil"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Editar Perfil Pessoal</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Identidade & Dados Pessoais</CardTitle>
            <CardDescription>Informações básicas para sua conta pessoal no Viby.</CardDescription>
          </CardHeader>
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
              <div className="space-y-2"><Label htmlFor="name">Nome Completo</Label><Input id="name" value={formData.name} onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))} required /></div>
              <div className="space-y-2">
                <Label htmlFor="username">Nome de Usuário (@)</Label>
                <div className="relative">
                  <Input 
                    id="username" 
                    value={formData.username} 
                    readOnly 
                    className="bg-muted/50 cursor-not-allowed pr-10 font-bold" 
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Lock className="w-4 h-4 text-muted-foreground opacity-50" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Alterações de username devem ser solicitadas ao suporte.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label htmlFor="birthDate">Data de Nascimento</Label><Input id="birthDate" type="date" value={formData.birthDate} onChange={(e) => setFormData(prev => ({...prev, birthDate: e.target.value}))} required /></div>
              <div className="space-y-2">
                <Label htmlFor="gender">Sexo / Gênero</Label>
                <Select 
                  key={formData.gender || 'loading'}
                  value={formData.gender} 
                  onValueChange={(val) => setFormData(prev => ({...prev, gender: val}))} 
                  required
                >
                  <SelectTrigger id="gender"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="homem trans">Homem Trans</SelectItem>
                    <SelectItem value="mulher trans">Mulher Trans</SelectItem>
                    <SelectItem value="agênero">Agênero</SelectItem>
                    <SelectItem value="outro">Outro / Prefiro não dizer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf" className="flex items-center gap-2"><Fingerprint className="w-3.5 h-3.5 text-secondary" /> CPF {isCpfLocked && <Lock className="w-3 h-3 text-muted-foreground ml-auto" />}</Label>
              <Input 
                id="cpf" 
                value={isCpfLocked ? maskCPF(formData.cpf) : formData.cpf} 
                onChange={handleCPFChange} 
                placeholder="000.000.000-00" 
                disabled={isCpfLocked} 
                className={cn(isCpfLocked && "bg-muted/50 cursor-not-allowed")} 
              />
              <p className="text-[10px] text-muted-foreground">O CPF é obrigatório para emissão de ingressos nominais e por segurança não pode ser alterado após validado.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio (Máx 150 caracteres)</Label>
              <Textarea id="bio" value={formData.bio} maxLength={150} onChange={(e) => setFormData(prev => ({...prev, bio: e.target.value}))} placeholder="Conte um pouco sobre você..." className="min-h-[100px] resize-none" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle>Localização & Contato</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2"><Label htmlFor="city">Cidade</Label><Input id="city" value={formData.city} onChange={(e) => setFormData(prev => ({...prev, city: e.target.value}))} required /></div>
              <div className="space-y-2"><Label htmlFor="state">Estado (UF)</Label><Input id="state" value={formData.state} onChange={(e) => setFormData(prev => ({...prev, state: e.target.value}))} placeholder="Ex: SP" maxLength={2} required /></div>
              <div className="space-y-2"><Label htmlFor="country">País</Label><Input id="country" value={formData.country} onChange={(e) => setFormData(prev => ({...prev, country: e.target.value}))} required /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label htmlFor="instagram">Instagram</Label><Input id="instagram" value={formData.instagram} onChange={(e) => setFormData(prev => ({...prev, instagram: e.target.value}))} placeholder="@exemplo" /></div>
              <div className="space-y-2"><Label htmlFor="whatsapp">WhatsApp</Label><Input id="whatsapp" value={formData.whatsapp} onChange={(e) => setFormData(prev => ({...prev, whatsapp: e.target.value}))} placeholder="(00) 00000-0000" /></div>
            </div>
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between"><Label htmlFor="showEmail">Exibir e-mail publicamente</Label><Switch id="showEmail" checked={formData.showEmail} onCheckedChange={(checked) => setFormData(prev => ({...prev, showEmail: checked}))} /></div>
              <Input id="email" type="email" value={formData.email} disabled className="bg-muted/50 border-none rounded-xl" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" className="bg-secondary text-white hover:bg-secondary/90 px-10 h-12 rounded-xl font-bold" disabled={saving || uploadProgress !== null}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </form>
    </div>
  )
}
