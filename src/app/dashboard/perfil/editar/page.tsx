
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc, updateDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, ArrowLeft, Save, Upload } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"

export default function EditarPerfilPage() {
  const router = useRouter()
  const auth = useAuth()
  const { user } = useUser(auth)
  const db = useFirestore()

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading: profileLoading } = useDoc<any>(userDocRef)

  const [formData, setFormData] = useState({
    name: "",
    avatar: "",
    bio: "",
    location: ""
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        avatar: profile.avatar || "",
        bio: profile.bio || "",
        location: profile.location || ""
      })
    }
  }, [profile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user) return

    setSaving(true)
    try {
      await updateDoc(doc(db, "users", user.uid), {
        ...formData,
        updatedAt: new Date().toISOString()
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
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/perfil"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Editar Perfil</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
            <CardDescription>Atualize como você aparece para outros usuários na plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-4 py-4">
              <Avatar className="h-24 w-24 border-2 border-secondary/20">
                <AvatarImage src={formData.avatar} alt={formData.name} />
                <AvatarFallback className="text-2xl">{formData.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="w-full max-w-xs space-y-2">
                <Label htmlFor="avatar">URL do Avatar</Label>
                <Input 
                  id="avatar" 
                  value={formData.avatar} 
                  onChange={(e) => setFormData({...formData, avatar: e.target.value})}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Localização</Label>
              <Input 
                id="location" 
                value={formData.location} 
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                placeholder="Ex: São Paulo, SP"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea 
                id="bio" 
                value={formData.bio} 
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                placeholder="Conte um pouco sobre você ou sua empresa..."
                className="min-h-[100px]"
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2 border-t pt-6">
            <Button type="button" variant="ghost" onClick={() => router.back()}>Cancelar</Button>
            <Button type="submit" className="bg-secondary text-white hover:bg-secondary/90" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Alterações
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
