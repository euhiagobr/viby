
"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useAuth, useUser, useFirebaseApp, useCollection, useMemoFirebase } from "@/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { 
  ArrowLeft, 
  Upload, 
  MapPin, 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Loader2, 
  Image as ImageIcon,
  Map as MapIcon,
  Tag,
  Hash,
  Globe
} from "lucide-react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"

interface Batch {
  name: string
  price: string
  startDate: string
  endDate: string
  available: string
}

export default function NovoEventoPage() {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const storage = app ? getStorage(app) : null

  // Categorias do banco
  const categoriesQuery = useMemoFirebase(() => db ? collection(db, "categories") : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  // Ordenar categorias alfabeticamente
  const sortedCategories = React.useMemo(() => {
    if (!categories) return []
    return [...categories].sort((a, b) => a.name.localeCompare(b.name))
  }, [categories])

  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  
  // Opções Extras
  const [selectedCategory, setSelectedCategory] = useState("")
  const [tags, setTags] = useState("")
  const [isFree, setIsFree] = useState(false)

  // Endereço
  const [cep, setCep] = useState("")
  const [address, setAddress] = useState({
    street: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "Brasil",
    number: "",
    complement: ""
  })
  const [coords, setCoords] = useState({ lat: "-23.5505", lng: "-46.6333" }) // SP default

  // Lotes
  const [batches, setBatches] = useState<Batch[]>([
    { name: "Lote Único", price: "0.00", startDate: "", endDate: "", available: "100" }
  ])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleCepBlur = async () => {
    const cleanCep = cep.replace(/\D/g, "")
    if (cleanCep.length !== 8) return

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await response.json()
      if (!data.erro) {
        setAddress(prev => ({
          ...prev,
          street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf,
          country: "Brasil"
        }))
      }
    } catch (e) {
      console.error("Erro ao buscar CEP")
    }
  }

  const addBatch = () => {
    setBatches([...batches, { name: "", price: "", startDate: "", endDate: "", available: "" }])
  }

  const removeBatch = (index: number) => {
    setBatches(batches.filter((_, i) => i !== index))
  }

  const updateBatch = (index: number, field: keyof Batch, value: string) => {
    const newBatches = [...batches]
    newBatches[index][field] = value
    setBatches(newBatches)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !storage) return

    if (!selectedCategory) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione uma categoria para o evento." })
      return
    }

    setLoading(true)
    const formData = new FormData(e.currentTarget)
    
    try {
      let imageUrl = ""
      if (imageFile) {
        const storageRef = ref(storage, `viby/events/${user.uid}/${Date.now()}_${imageFile.name}`)
        const snapshot = await uploadBytes(storageRef, imageFile)
        imageUrl = await getDownloadURL(snapshot.ref)
      }

      const eventData = {
        title: formData.get("title") as string,
        shortDescription: formData.get("shortDescription") as string,
        description: formData.get("description") as string,
        startDate: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory,
        tags: tags.split(",").map(t => t.trim()).filter(t => t !== ""),
        isFree: isFree,
        cep: cep,
        address: address,
        coords: coords,
        batches: isFree ? [{ name: "Gratuito", price: 0, available: parseInt(formData.get("freeCapacity") as string) || 0 }] : batches.map(b => ({
          ...b,
          price: parseFloat(b.price) || 0,
          available: parseInt(b.available) || 0
        })),
        image: imageUrl || `https://picsum.photos/seed/${Math.random()}/1200/800`,
        organizerId: user.uid,
        organizer: {
          name: user.displayName || "Organizador",
          avatar: user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`,
          isVerified: false
        },
        status: "Ativo",
        type: "Público",
        city: address.city,
        createdAt: serverTimestamp()
      }

      await addDoc(collection(db, "events"), eventData)
      toast({ title: "Evento Publicado!", description: "Seu evento já está disponível para o público." })
      router.push("/dashboard/projetos")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao publicar",
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/projetos"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Novo Evento</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Imagem de Capa */}
        <Card className="overflow-hidden border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-secondary" />
              Capa do Evento
            </CardTitle>
            <CardDescription>Escolha uma imagem de alta qualidade para atrair mais público.</CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className="relative aspect-video rounded-xl bg-muted border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => document.getElementById('image-upload')?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Upload className="w-10 h-10 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground font-medium">Clique para fazer upload (16:9)</p>
                </>
              )}
              <input 
                id="image-upload" 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Informações Básicas */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-secondary" />
              Informações Gerais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title">Nome do Evento</Label>
                <Input id="title" name="title" placeholder="Ex: Festival de Verão Viby 2024" required />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedCategories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data e Hora de Início (UTC-3)</Label>
                <div className="relative">
                  <Input id="startDate" name="startDate" type="datetime-local" className="pl-10" required />
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data e Hora de Fim (UTC-3)</Label>
                <div className="relative">
                  <Input id="endDate" name="endDate" type="datetime-local" className="pl-10" required />
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
              <div className="relative">
                <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="musica, festival, artes..." className="pl-10" />
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shortDescription">Breve Descrição</Label>
              <Input id="shortDescription" name="shortDescription" placeholder="Uma frase chamativa para a vitrine..." required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição Completa</Label>
              <Textarea id="description" name="description" placeholder="Conte todos os detalhes do evento..." className="min-h-[150px]" required />
            </div>
          </CardContent>
        </Card>

        {/* Localização */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-secondary" />
              Localização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input id="cep" value={cep} onChange={(e) => setCep(e.target.value)} onBlur={handleCepBlur} placeholder="00000-000" required />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="street">Logradouro</Label>
                <Input id="street" value={address.street} onChange={(e) => setAddress({...address, street: e.target.value})} placeholder="Rua, Avenida..." required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label htmlFor="number">Número</Label>
                <Input id="number" value={address.number} onChange={(e) => setAddress({...address, number: e.target.value})} placeholder="123" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input id="neighborhood" value={address.neighborhood} onChange={(e) => setAddress({...address, neighborhood: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" value={address.city} onChange={(e) => setAddress({...address, city: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado (UF)</Label>
                <Input id="state" value={address.state} onChange={(e) => setAddress({...address, state: e.target.value})} placeholder="EX: SP" required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                <Label htmlFor="country" className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-secondary" />
                  País
                </Label>
                <Input id="country" value={address.country} onChange={(e) => setAddress({...address, country: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complement">Complemento</Label>
                <Input id="complement" value={address.complement} onChange={(e) => setAddress({...address, complement: e.target.value})} placeholder="Apto, Bloco, etc." />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-secondary" />
                Coordenadas do Pin
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Latitude</span>
                  <Input value={coords.lat} onChange={(e) => setCoords({...coords, lat: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Longitude</span>
                  <Input value={coords.lng} onChange={(e) => setCoords({...coords, lng: e.target.value})} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lotes e Valores */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-border">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="w-5 h-5 text-secondary" />
                Ingressos e Lotes
              </CardTitle>
              <CardDescription>Configure como o público terá acesso ao evento.</CardDescription>
            </div>
            <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-full">
              <Label htmlFor="free-event" className="font-bold text-xs uppercase cursor-pointer">Ingresso Grátis</Label>
              <Switch id="free-event" checked={isFree} onCheckedChange={setIsFree} />
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isFree ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                <div className="p-8 border-2 border-dashed border-secondary/30 rounded-2xl bg-secondary/5 text-center">
                  <Plus className="w-10 h-10 mx-auto text-secondary mb-4" />
                  <h4 className="font-bold text-lg">Este é um Evento Gratuito</h4>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-2">
                    Não haverá cobrança de valores. Você pode definir apenas a capacidade máxima de interessados.
                  </p>
                </div>
                <div className="space-y-2 max-w-xs mx-auto">
                  <Label htmlFor="freeCapacity">Capacidade de Ingressos</Label>
                  <Input id="freeCapacity" name="freeCapacity" type="number" placeholder="Ex: 500" required />
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                {batches.map((batch, index) => (
                  <div key={index} className="p-4 rounded-xl border border-border bg-muted/20 space-y-4">
                    <div className="flex justify-between items-center">
                      h4 className="font-bold text-sm">Lote #{index + 1}</h4>
                      {batches.length > 1 && (
                        <button type="button" onClick={() => removeBatch(index)} className="text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Nome do Lote</Label>
                        <Input value={batch.name} onChange={(e) => updateBatch(index, "name", e.target.value)} placeholder="Ex: VIP" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Preço (R$)</Label>
                        <Input value={batch.price} onChange={(e) => updateBatch(index, "price", e.target.value)} type="number" step="0.01" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Disponíveis</Label>
                        <Input value={batch.available} onChange={(e) => updateBatch(index, "available", e.target.value)} type="number" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Vendas Início</Label>
                        <Input value={batch.startDate} onChange={(e) => updateBatch(index, "startDate", e.target.value)} type="datetime-local" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Vendas Fim</Label>
                        <Input value={batch.endDate} onChange={(e) => updateBatch(index, "endDate", e.target.value)} type="datetime-local" required />
                      </div>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" className="w-full border-dashed border-2 py-8 hover:bg-secondary/5 hover:border-secondary/50 group" onClick={addBatch}>
                  <Plus className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" /> 
                  Adicionar Novo Lote de Ingressos
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full bg-secondary text-white hover:bg-secondary/90 h-14 text-lg font-bold shadow-lg" disabled={loading}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
          Publicar Evento Imediatamente
        </Button>
      </form>
    </div>
  )
}
