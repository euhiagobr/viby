
"use client"

import * as React from "react"
import { useFirestore, useDoc } from "@/firebase"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Save, Layout, Globe, ImageIcon } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

export default function AdminConfiguracoesPage() {
  const db = useFirestore()
  
  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings, loading } = useDoc<any>(settingsRef)

  const [saving, setSaving] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db) return

    setSaving(true)
    const formData = new FormData(e.currentTarget)
    
    const settingsData = {
      siteName: formData.get("siteName") as string,
      logoUrl: formData.get("logoUrl") as string,
      iconUrl: formData.get("iconUrl") as string,
      updatedAt: serverTimestamp()
    }

    setDoc(doc(db, "settings", "site"), settingsData, { merge: true })
      .then(() => {
        toast({ title: "Configurações salvas!", description: "A identidade visual do site foi atualizada." })
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: "settings/site",
          operation: "write",
          requestResourceData: settingsData
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setSaving(false))
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Configurações Gerais</h1>
        <p className="text-muted-foreground">Gerencie o nome do site, logotipo e ícone da plataforma.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <Card className="border-none shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Layout className="w-5 h-5 text-secondary" />
              Identidade Visual
            </CardTitle>
            <CardDescription>Personalize como a marca do site é exibida.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="siteName">Nome do Site</Label>
              <Input 
                id="siteName" 
                name="siteName" 
                defaultValue={settings?.siteName || "Viby"} 
                placeholder="Ex: Viby Club"
                required 
                className="rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="logoUrl">URL do Logotipo</Label>
              <div className="flex gap-4">
                <Input 
                  id="logoUrl" 
                  name="logoUrl" 
                  defaultValue={settings?.logoUrl} 
                  placeholder="https://sua-imagem.com/logo.png" 
                  className="rounded-xl flex-1"
                />
                {settings?.logoUrl && (
                  <div className="h-10 w-10 relative rounded-lg border bg-muted overflow-hidden">
                    <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="iconUrl">URL do Ícone (Favicon/Mobile)</Label>
              <div className="flex gap-4">
                <Input 
                  id="iconUrl" 
                  name="iconUrl" 
                  defaultValue={settings?.iconUrl} 
                  placeholder="https://sua-imagem.com/icon.png" 
                  className="rounded-xl flex-1"
                />
                {settings?.iconUrl && (
                  <div className="h-10 w-10 relative rounded-lg border bg-muted overflow-hidden">
                    <img src={settings.iconUrl} alt="Icon" className="w-full h-full object-contain" />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full bg-secondary text-white font-bold h-12 rounded-xl shadow-lg" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Configurações
        </Button>
      </form>
    </div>
  )
}
