
"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Tag, Settings, Loader2, ShieldAlert, LayoutDashboard, Plus, Trash2, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

export default function AdminPage() {
  const auth = useAuth()
  const { user } = useUser(auth)
  const db = useFirestore()
  
  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading: profileLoading } = useDoc<any>(userDocRef)

  // Categorias
  const categoriesQuery = useMemoFirebase(() => db ? collection(db, "categories") : null, [db])
  const { data: categories, loading: categoriesLoading } = useCollection<any>(categoriesQuery)

  const [isCatDialogOpen, setIsCatDialogOpen] = React.useState(false)
  const [isSubmittingCat, setIsSubmittingCat] = React.useState(false)

  const handleCreateCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db) return

    setIsSubmittingCat(true)
    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")

    const catData = {
      name,
      slug,
      icon: "Tag",
      createdAt: serverTimestamp()
    }

    addDoc(collection(db, "categories"), catData)
      .then(() => {
        toast({ title: "Categoria criada!", description: `A categoria ${name} foi adicionada.` })
        setIsCatDialogOpen(false)
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: "categories",
          operation: "create",
          requestResourceData: catData
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsSubmittingCat(false))
  }

  const handleDeleteCategory = (id: string) => {
    if (!db) return
    deleteDoc(doc(db, "categories", id))
      .then(() => toast({ title: "Categoria removida" }))
      .catch(async () => {
        const permissionError = new FirestorePermissionError({
          path: `categories/${id}`,
          operation: "delete"
        })
        errorEmitter.emit("permission-error", permissionError)
      })
  }

  if (profileLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <ShieldAlert className="w-16 h-16 text-destructive" />
        <h2 className="text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">Você não tem permissão de administrador para acessar esta área.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-secondary/10 rounded-lg">
          <LayoutDashboard className="w-6 h-6 text-secondary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
          <p className="text-muted-foreground">Gerencie usuários, categorias e configurações globais do Viby Club.</p>
        </div>
      </div>

      <Tabs defaultValue="categories" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="categories" className="gap-2">
            <Tag className="w-4 h-4" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="w-4 h-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Categorias de Eventos</CardTitle>
                <CardDescription>Adicione ou remova categorias para classificação de eventos.</CardDescription>
              </div>
              <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-secondary text-white">
                    <Plus className="w-4 h-4" />
                    Nova Categoria
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreateCategory}>
                    <DialogHeader>
                      <DialogTitle>Adicionar Categoria</DialogTitle>
                      <DialogDescription>Digite o nome da nova categoria de eventos.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="catName">Nome da Categoria</Label>
                        <Input id="catName" name="name" placeholder="Ex: Festival de Música" required />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" className="w-full bg-secondary text-white" disabled={isSubmittingCat}>
                        {isSubmittingCat ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Criar Categoria
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {categoriesLoading ? (
                <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : categories && categories.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((cat: any) => (
                    <div key={cat.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-background rounded-lg border border-border">
                          <Hash className="w-4 h-4 text-secondary" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{cat.name}</p>
                          <p className="text-[10px] text-muted-foreground">slug: {cat.slug}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteCategory(cat.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed rounded-xl bg-muted/20">
                  <Tag className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground italic">Nenhuma categoria cadastrada ainda.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>Gerenciamento de Usuários</CardTitle>
              <CardDescription>Visualize e gerencie todos os organizadores cadastrados na plataforma.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center border-2 border-dashed rounded-xl bg-muted/20">
                <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground italic">Lista de organizadores cadastrados aparecerá aqui.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>Configurações da Plataforma</CardTitle>
              <CardDescription>Ajustes globais e parâmetros de sistema.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center border-2 border-dashed rounded-xl bg-muted/20">
                <Settings className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground italic">Ajustes globais do Viby Club.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
