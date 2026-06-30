
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase, useFirebaseApp, useUser, useAuth } from "@/firebase"
import { collection, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tag, Loader2, Plus, Trash2, Hash, Sparkles, Ticket, ImageIcon, Upload, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { cn } from "@/lib/utils"

export default function AdminCategoriasPage() {
  const db = useFirestore()
  const auth = useAuth()
  const app = useFirebaseApp()
  const { user } = useUser(auth)
  const storage = React.useMemo(() => (app ? getStorage(app) : null), [app])
  
  const [activeTab, setActiveTab] = React.useState<string>("event")
  const [isCatDialogOpen, setIsCatDialogOpen] = React.useState(false)
  const [isSubmittingCat, setIsSubmittingCat] = React.useState(false)
  const [newCatType, setNewCatType] = React.useState<string>("event")
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [imageUrl, setImageUrl] = React.useState<string>("")

  const categoriesQuery = useMemoFirebase(() => 
    db ? query(collection(db, "categories"), orderBy("name", "asc")) : null, 
    [db]
  )
  const { data: categories, loading: categoriesLoading } = useCollection<any>(categoriesQuery)

  const filteredCategories = React.useMemo(() => {
    if (!categories) return []
    return categories.filter((cat: any) => {
      const type = cat.type || 'event'
      return type === activeTab
    })
  }, [categories, activeTab])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return

    setUploadProgress(0)
    try {
      const fileName = `categories/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      const storageRef = ref(storage, fileName)
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        () => { setUploadProgress(null); toast({ variant: "destructive", title: "Erro no upload" }) },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setImageUrl(downloadURL)
          setUploadProgress(null)
          toast({ title: "Imagem da categoria carregada!" })
        }
      )
    } catch (err) { setUploadProgress(null) }
  }

  const handleCreateCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db) return

    setIsSubmittingCat(true)
    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ç/g, "c").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")

    const catData = {
      name,
      slug,
      type: newCatType,
      imageUrl: imageUrl || "",
      icon: "Tag",
      createdAt: serverTimestamp()
    }

    addDoc(collection(db, "categories"), catData)
      .then(() => {
        toast({ title: "Categoria criada!", description: `A categoria "${name}" foi adicionada aos ${newCatType === 'event' ? 'Eventos' : 'Experiências'}.` })
        setIsCatDialogOpen(false)
        setImageUrl("")
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
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Tag className="w-8 h-8 text-secondary" />
            Classificações
          </h1>
          <p className="text-muted-foreground font-medium">Gerencie as categorias de Eventos e Experiências da Viby.</p>
        </div>
        
        <Dialog open={isCatDialogOpen} onOpenChange={(v) => { setIsCatDialogOpen(v); if(!v) setImageUrl(""); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg uppercase italic">
              <Plus className="w-5 h-5" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-[2.5rem]">
            <form onSubmit={handleCreateCategory}>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Criar Categoria</DialogTitle>
                <DialogDescription className="font-bold text-secondary uppercase text-[10px] tracking-widest">Defina o nome e o tipo de produto.</DialogDescription>
              </DialogHeader>
              <div className="py-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Tipo de Produto</Label>
                  <Select value={newCatType} onValueChange={setNewCatType}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="event">Evento</SelectItem>
                      <SelectItem value="experience">Experiência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-3">
                   <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Imagem de Capa (Opcional)</Label>
                   <div 
                      className={cn(
                        "relative h-32 rounded-2xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center overflow-hidden cursor-pointer group",
                        imageUrl && "border-secondary bg-secondary/5"
                      )}
                      onClick={() => document.getElementById('cat-image-up')?.click()}
                    >
                      {imageUrl ? (
                        <img src={imageUrl} className="w-full h-full object-cover" alt="Preview" />
                      ) : (
                        <div className="text-center opacity-40">
                           <Camera className="w-8 h-8 mx-auto mb-2" />
                           <p className="text-[8px] font-black uppercase">Carregar Imagem</p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload className="text-white w-6 h-6" />
                      </div>
                      <input id="cat-image-up" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                      {uploadProgress !== null && <Progress value={uploadProgress} className="absolute bottom-0 left-0 right-0 h-1 rounded-none" />}
                   </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nome de Exibição</Label>
                  <Input name="name" placeholder="Ex: Música ao Vivo" required className="rounded-xl h-11" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic text-lg" disabled={isSubmittingCat || uploadProgress !== null}>
                  {isSubmittingCat ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Publicar Categoria"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12">
          <TabsTrigger value="event" className="rounded-lg px-8 font-bold gap-2 data-[state=active]:bg-white">
            <Ticket className="w-4 h-4" />
            Eventos
          </TabsTrigger>
          <TabsTrigger value="experience" className="rounded-lg px-8 font-bold gap-2 data-[state=active]:bg-white">
            <Sparkles className="w-4 h-4" />
            Experiências
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="bg-muted/20 border-b p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary">
                    Categorias: {activeTab === 'event' ? 'Eventos' : 'Experiências'}
                  </CardTitle>
                  <CardDescription className="font-medium">Total de {filteredCategories.length} classificações ativas.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              {categoriesLoading ? (
                <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
              ) : filteredCategories.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCategories.map((cat: any) => (
                    <div key={cat.id} className="flex items-center justify-between p-4 rounded-[1.5rem] border border-border bg-white hover:border-secondary/30 transition-all shadow-sm group">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 bg-muted rounded-xl border border-border group-hover:bg-secondary/10 transition-colors overflow-hidden shrink-0 flex items-center justify-center">
                          {cat.imageUrl ? (
                             <img src={cat.imageUrl} className="w-full h-full object-cover" alt="" />
                          ) : (
                             <Hash className="w-5 h-5 text-secondary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-sm uppercase italic text-primary truncate">{cat.name}</p>
                          <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest truncate">slug: {cat.slug}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-xl h-8 w-8" onClick={() => handleDeleteCategory(cat.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-24 text-center border-2 border-dashed rounded-[3rem] bg-muted/10 opacity-40">
                  <Tag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-xs font-black uppercase tracking-widest italic">Nenhuma categoria de {activeTab === 'event' ? 'eventos' : 'experiências'} cadastrada.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
