"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc, useFirebaseApp } from "@/firebase"
import { 
  doc, 
  updateDoc, 
  serverTimestamp, 
  increment
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
  Trash2,
  Instagram,
  Globe,
  Phone,
  Coins
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn, validateCPF } from "@/lib/utils"
import Link from "next/link"
import { getUserCPF, updateUserCPF } from "@/app/actions/user"
import { maskCPF } from "@/lib/crypto-utils"
import { IMAGE_CACHE_METADATA } from "@/lib/image-utils"

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
    preferredCurrency: "BRL",
    showEmail: true
  })
  
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [isFetchingCPF, setIsFetchingCPF] = useState(false)
  const [hasValidCPF, setHasValidCPF] = useState(false)

  useEffect(() => {
    if (profile && user && !isInitialized.current) {
      isInitialized.current = true
      
      const currentMask = profile.cpfMasked || profile.cpf || "";
      const isMissing = !profile.cpfHash || currentMask === "***.***.***-**";

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
        cpf: currentMask,
        preferredCurrency: profile.preferredCurrency || "BRL",
        showEmail: profile.showEmail !== undefined ? profile.showEmail : true
      }));

      if (!isMissing) {
        setHasValidCPF(true);
      }
    }
  }, [profile, user])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return

    setUploadProgress(0)
    try {
      const storageRef = ref(storage, `users/${user.uid}/avatar_${Date.now()}`)
      const uploadTask = uploadBytesResumable(storageRef, file, IMAGE_CACHE_METADATA);
      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        () => setUploadProgress(null),
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setFormData((prev: any) => ({ ...prev, avatar: downloadURL }))
          setUploadProgress(null)
          toast({ title: "Imagem carregada!" })
        }
      )
    } catch (err) { setUploadProgress(null) }
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

  const cpfIsReadOnly = hasValidCPF;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/perfil"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Editar Perfil</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="bg-muted/30 pb-8">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Identidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-8">
            <div className="flex flex-col items-center gap-6 py-4">
              <div className="relative group">
                <Avatar className="h-40 w-40 border-8 border-background shadow-2xl rounded-[3rem]">
                  <AvatarImage src={formData.avatar} alt={formData.name} className="object-cover" />
                  <AvatarFallback className="text-4xl font-black bg-muted">{formData.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <label htmlFor="avatar-upload" className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="w-8 h-8" />
                </label>
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>
              {uploadProgress !== null && <div className="w-full max-w-xs space-y-2"><Progress value={uploadProgress} className="h-1" /><p className="text-[9px] text-center font-black uppercase">Subindo: {Math.round(uploadProgress)}%</p></div>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nome Completo</Label><Input value={formData.name} onChange={(e) => setFormData((prev:any) => ({...prev, name: e.target.value}))} required className="rounded-xl h-11" /></div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">CPF (Identidade Protegida)</Label>
                <div className="relative">
                  <Input 
                    value={formData.cpf} 
                    onChange={e => !cpfIsReadOnly && setFormData({...formData, cpf: formatCPFInput(e.target.value)})}
                    readOnly={cpfIsReadOnly}
                    placeholder="000.000.000-00"
                    className={cn("rounded-xl h-11 font-mono font-bold pr-10", cpfIsReadOnly ? "bg-muted/50 cursor-not-allowed" : "border-dashed border-secondary/30")} 
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {cpfIsReadOnly ? <Lock className="w-4 h-4 text-muted-foreground opacity-50" /> : <ShieldCheck className="w-4 h-4 text-secondary" />}
                  </div>
                </div>
                {!hasValidCPF && (
                   <div className="p-3 bg-orange-50 rounded-xl border border-dashed border-orange-200 flex items-start gap-2 mt-2">
                      <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      <p className="text-[9px] font-bold text-orange-800 uppercase leading-tight">O CPF informado será vinculado permanentemente à sua conta para transferências seguras.</p>
                   </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60">Sua Bio</Label>
              <Textarea value={formData.bio} maxLength={150} onChange={(e) => setFormData((prev:any) => ({...prev, bio: e.target.value}))} placeholder="Fale um pouco sobre você..." className="min-h-[100px] resize-none rounded-xl border-dashed" />
            </div>
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
