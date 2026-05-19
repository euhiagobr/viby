
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc, useFirebaseApp } from "@/firebase"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Loader2, ArrowLeft, Save, Upload, Info, Link as LinkIcon, Instagram, Phone, Mail } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"

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
    email: ""
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
        email: profile.email || ""
      })
    }
  }, [profile])

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

    // Validação de Bio
    if (formData.bio.length > 150) {
      toast({ variant: "destructive", title: "Bio muito longa", description: "Máximo de 150 caracteres." })
      return
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g
    if (urlRegex.test(formData.bio)) {
      toast({ variant: "destructive", title: "Links não permitidos", description: "Não use links na biografia." })
      return
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
                <Label htmlFor="name">Nome Completo (Obrigatório)</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
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
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
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
              <Input id="city" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Input id="state" value={formData.state} onChange={(e) => setFormData({...formData, state: e.target.value})} placeholder="Ex: SP" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">País</Label>
              <Input id="country" value={formData.country} onChange={(e) => setFormData({...formData, country: e.target.value})} required />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Links & Contato</CardTitle>
            <CardDescription>Canais oficiais de divulgação.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="website" className="flex items-center gap-2">
                <LinkIcon className="w-3.5 h-3.5" /> Site Oficial
              </Label>
              <Input id="website" value={formData.website} onChange={(e) => setFormData({...formData, website: e.target.value})} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram" className="flex items-center gap-2">
                <Instagram className="w-3.5 h-3.5" /> Instagram (usuário)
              </Label>
              <Input id="instagram" value={formData.instagram} onChange={(e) => setFormData({...formData, instagram: e.target.value})} placeholder="@exemplo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" /> WhatsApp
              </Label>
              <Input id="whatsapp" value={formData.whatsapp} onChange={(e) => setFormData({...formData, whatsapp: e.target.value})} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" /> E-mail de Contato
              </Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="contato@exemplo.com" />
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
