
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tag, Loader2, Plus, Trash2, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

export default function AdminCategoriasPage() {
  const db = useFirestore()
  
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
    if (!confirm("Tem certeza que deseja remover esta categoria?")) return

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Categorias de Eventos</h1>
        <p className="text-muted-foreground">Gerencie as categorias temáticas para classificação e busca de eventos.</p>
      </div>

      <Card className="border-border shadow-sm rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-6">
          <div>
            <CardTitle className="text-xl">Gestão de Categorias</CardTitle>
            <CardDescription>Crie novas classificações para os eventos da plataforma.</CardDescription>
          </div>
          <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-secondary text-white font-bold rounded-full px-6">
                <Plus className="w-4 h-4" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <form onSubmit={handleCreateCategory}>
                <DialogHeader>
                  <DialogTitle>Nova Categoria</DialogTitle>
                  <DialogDescription>As categorias ajudam os usuários a filtrar eventos.</DialogDescription>
                </DialogHeader>
                <div className="py-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="catName">Nome de Exibição</Label>
                    <Input id="catName" name="name" placeholder="Ex: Música ao Vivo" required className="rounded-xl" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full bg-secondary text-white font-bold h-12 rounded-xl" disabled={isSubmittingCat}>
                    {isSubmittingCat ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Criar Categoria
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="pt-8">
          {categoriesLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
          ) : categories && categories.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat: any) => (
                <div key={cat.id} className="flex items-center justify-between p-5 rounded-2xl border border-border bg-white hover:border-secondary/30 transition-all shadow-sm group">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-xl border border-border group-hover:bg-secondary/10 transition-colors">
                      <Hash className="w-4 h-4 text-secondary" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{cat.name}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">slug: {cat.slug}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-xl" onClick={() => handleDeleteCategory(cat.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/20">
              <Tag className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
              <p className="text-muted-foreground font-medium italic">Nenhuma categoria cadastrada ainda.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
