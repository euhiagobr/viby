
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useFirestore, useAuth, useUser, useFirebaseApp, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { updateDoc, doc, collection, serverTimestamp } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import { 
  ArrowLeft, 
  Upload, 
  MapPin, 
  Calendar, 
  Plus, 
  Trash2, 
  Loader2, 
  ImageIcon,
  Save,
  ShieldAlert,
  Clock,
  Building2,
  Compass,
  RefreshCw
} from "lucide-react"
import Link from "next/link"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"

interface Batch {
  name: string
  price: string
  startDate: string
  endDate: string
  available: string
}

export default function EditarEventoPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const app = useFirebaseApp()
  const { currentOrg, userRole, loading: orgLoading } = useCurrentOrganization()

  const eventRef = React.useMemo(() => (db && eventId) ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)
  
  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app, "gs://viby");
  }, [app])

  const categoriesQuery = useMemoFirebase(() => db ? collection(db, "categories") : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const sortedCategories = React.useMemo(() => {
    if (!categories) return []
    return [...categories].sort((a, b) => a.name.localeCompare(b.name))
  }, [categories])

  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  
  const [selectedCategory, setSelectedCategory] = useState("")
  const [tags, setTags] = useState("")
  const [isFree, setIsFree] = useState(false)

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
  const [coords, setCoords] = useState({ lat: "", lng: "" })
  const [isGeocoding, setIsGeocoding] = useState(false)

  const [batches, setBatches] = useState<Batch[]>([])

  const [freeCapacity, setFreeCapacity] = useState("0")
  const [freeSalesStart, setFreeSalesStart] = useState("")
  const [freeSalesEnd, setFreeSalesEnd] = useState("")

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

  useEffect(() => {
    if (event) {
      setSelectedCategory(event.categoryId || "")
      setTags(event.tags?.join(", ") || "")
      setIsFree(event.isFree || false)
      setCep(event.cep || "")
      setAddress(event.address || {
        street: "",
        neighborhood: "",
        city: "",
        state: "",
        country: "Brasil",
        number: "",
        complement: ""
      })
      setCoords({
        lat: event.latitude?.toString() || "",
        lng: event.longitude?.toString() || ""
      })
      setImagePreview(event.image || null)
      setUploadedImageUrl(event.image || null)
      
      if (event.isFree && event.batches?.[0]) {
        setFreeCapacity(event.batches[0].available?.toString() || "0")
        setFreeSalesStart(event.batches[0].startDate || "")
        setFreeSalesEnd(event.batches[0].endDate || "")
      }

      if (event.batches && Array.isArray(event.batches) && !event.isFree) {
        setBatches(event.batches.map((b: any) => ({
          name: b.name || "",
          price: b.price?.toString() || "0.00",
          startDate: b.startDate || "",
          endDate: b.endDate || "",
          available: b.available?.toString() || "0"
        })))
      }
    }
  }, [event])

  useEffect(() => {
    if (!orgLoading && (!currentOrg || !isAtLeastEditor)) {
      toast({ 
        variant: "destructive", 
        title: "Acesso Restrito", 
        description: "Você não tem permissão para editar eventos desta marca." 
      })
      router.push("/dashboard/projetos")
    }
  }, [currentOrg, isAtLeastEditor, orgLoading, router])

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return

    setImagePreview(URL.createObjectURL(file))
    setUploadProgress(0)

    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      const storagePath = `events/${user.uid}/${fileName}`
      const storageRef = ref(storage, storagePath)
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100), 
        (error: any) => {
          setUploadProgress(null)
          toast({ variant: "destructive", title: "Erro no upload" })
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setUploadedImageUrl(downloadURL)
          setUploadProgress(null)
          toast({ title: "Imagem carregada!" })
        }
      )
    } catch (err: any) {
      setUploadProgress(null)
      toast({ variant: "destructive", title: "Erro no upload", description: err.message })
    }
  }

  const geocodeAddress = async () => {
    if (!address.street || !address.city || !address.number) return;
    
    setIsGeocoding(true);
    const query = `${address.street}, ${address.number}, ${address.neighborhood}, ${address.city}, ${address.state}, Brasil`;
    
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await response.json();
      
      if (data && data[0]) {
        setCoords({
          lat: data[0].lat,
          lng: data[0].lon
        });
        toast({ title: "Localização atualizada!", description: "Coordenadas sincronizadas pelo endereço." });
      }
    } catch (e) {
      console.error("Erro na geolocalização:", e);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleCepBlur = async () => {
    const cleanCep = cep.replace(/\D/g, "")
    if (cleanCep.length !== 8) return
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await response.json()
      if (!data.erro) {
        setAddress(prev => ({
          ...prev,
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || ""
        }))
        if (address.number) geocodeAddress();
      }
    } catch (e) {}
  }

  const addBatch = () => setBatches([...batches, { name: "", price: "", startDate: "", endDate: "", available: "" }])
  const removeBatch = (index: number) => setBatches(batches.filter((_, i) => i !== index))
  const updateBatch = (index: number, field: keyof Batch, value: string) => {
    const newBatches = [...batches]
    newBatches[index][field] = value
    setBatches(newBatches)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !eventRef || !currentOrg || !isAtLeastEditor) return

    setSaving(true)
    const formData = new FormData(e.currentTarget)
    const currentCategory = categories?.find(c => c.id === selectedCategory);
    const categoryName = currentCategory?.name || "Outros";
    
    try {
      const eventUpdateData = {
        title: formData.get("title") as string,
        shortDescription: formData.get("shortDescription") as string,
        description: formData.get("description") as string,
        date: formData.get("startDate") as string, 
        endDate: formData.get("endDate") as string,
        categoryId: selectedCategory,
        categoryName: categoryName,
        tags: tags.split(",").map(t => t.trim()).filter(t => t !== ""),
        isFree: isFree,
        cep: cep,
        address: address,
        latitude: parseFloat(coords.lat) || 0,
        longitude: parseFloat(coords.lng) || 0,
        batches: isFree ? [{ 
          name: "Gratuito", 
          price: 0, 
          available: parseInt(freeCapacity) || 0,
          startDate: freeSalesStart,
          endDate: freeSalesEnd
        }] : batches.map(b => ({
          ...b,
          price: parseFloat(b.price) || 0,
          available: parseInt(b.available) || 0
        })),
        image: uploadedImageUrl || event.image || "",
        city: address.city,
        organizer: {
          name: currentOrg.name,
          avatar: currentOrg.avatar || "",
          isVerified: !!currentOrg.verified,
          username: currentOrg.username
        },
        updatedAt: serverTimestamp()
      }

      await updateDoc(eventRef, eventUpdateData)
      toast({ title: "Evento Atualizado!" })
      router.push("/dashboard/projetos")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: error.message })
    } finally {
      setSaving(false)
    }
  }

  if (eventLoading || orgLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/projetos"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editar Evento</h1>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Organização:</span>
             <Badge variant="secondary" className="gap-1.5 font-black uppercase text-[10px] italic">
                <Building2 className="w-3 h-3" />
                {currentOrg?.name}
             </Badge>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="overflow-hidden border-none shadow-sm">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="w-5 h-5 text-secondary" /> Capa do Evento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-video rounded-xl bg-muted border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden cursor-pointer" onClick={() => document.getElementById('image-upload')?.click()}>
              {imagePreview ? <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" /> : <><Upload className="w-10 h-10 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Clique para alterar capa</p></>}
              <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>
            {uploadProgress !== null && <div className="space-y-2"><Progress value={uploadProgress} className="h-2" /><p className="text-[10px] text-center font-bold text-muted-foreground uppercase">Enviando: {Math.round(uploadProgress)}%</p></div>}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5 text-secondary" /> Informações Gerais</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label htmlFor="title">Nome do Evento</Label><Input id="title" name="title" defaultValue={event?.title} required /></div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                  <SelectContent>{sortedCategories.map((cat: any) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label htmlFor="startDate">Início</Label><Input id="startDate" name="startDate" type="datetime-local" defaultValue={event?.date} required /></div>
              <div className="space-y-2"><Label htmlFor="endDate">Fim</Label><Input id="endDate" name="endDate" type="datetime-local" defaultValue={event?.endDate} required /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="tags">Tags</Label><Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="musica, festival..." /></div>
            <div className="space-y-2"><Label htmlFor="shortDescription">Slogan</Label><Input id="shortDescription" name="shortDescription" defaultValue={event?.shortDescription} required /></div>
            <div className="space-y-2"><Label htmlFor="description">Descrição</Label><Textarea id="description" name="description" defaultValue={event?.description} className="min-h-[150px]" required /></div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-secondary" /> Localização & Geolocalização</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2"><Label htmlFor="cep">CEP</Label><Input id="cep" value={cep} onChange={(e) => setCep(e.target.value)} onBlur={handleCepBlur} required /></div>
              <div className="md:col-span-2 space-y-2"><Label htmlFor="street">Logradouro</Label><Input id="street" value={address.street} onChange={(e) => setAddress({...address, street: e.target.value})} onBlur={geocodeAddress} required /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2"><Label htmlFor="number">Nº</Label><Input id="number" value={address.number} onChange={(e) => setAddress({...address, number: e.target.value})} onBlur={geocodeAddress} required /></div>
              <div className="space-y-2"><Label htmlFor="neighborhood">Bairro</Label><Input id="neighborhood" value={address.neighborhood} onChange={(e) => setAddress({...address, neighborhood: e.target.value})} onBlur={geocodeAddress} required /></div>
              <div className="space-y-2"><Label htmlFor="city">Cidade</Label><Input id="city" value={address.city} onChange={(e) => setAddress({...address, city: e.target.value})} required /></div>
              <div className="space-y-2"><Label htmlFor="state">UF</Label><Input id="state" value={address.state} onChange={(e) => setAddress({...address, state: e.target.value})} required /></div>
            </div>

            <Separator />
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <Compass className="w-4 h-4 text-secondary" />
                   <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Coordenadas de Descoberta</h4>
                 </div>
                 {isGeocoding && <div className="flex items-center gap-2 text-[10px] font-bold text-secondary animate-pulse uppercase"><RefreshCw className="w-3 h-3 animate-spin" /> Atualizando...</div>}
               </div>
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase opacity-60">Latitude</Label>
                    <Input value={coords.lat} onChange={(e) => setCoords({...coords, lat: e.target.value})} placeholder="Detectado automaticamente" readOnly className="bg-muted/30" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase opacity-60">Longitude</Label>
                    <Input value={coords.lng} onChange={(e) => setCoords({...coords, lng: e.target.value})} placeholder="Detectado automaticamente" readOnly className="bg-muted/30" />
                  </div>
               </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-6 border-b">
            <CardTitle className="text-lg flex items-center gap-2">Configuração de Ingressos</CardTitle>
            <div className="flex items-center gap-2"><Label htmlFor="free-event">Grátis</Label><Switch id="free-event" checked={isFree} onCheckedChange={setIsFree} /></div>
          </CardHeader>
          <CardContent className="p-6">
            {isFree ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Quantidade Disponível</Label>
                  <Input value={freeCapacity} onChange={(e) => setFreeCapacity(e.target.value)} type="number" required />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-secondary" /> Início das Vendas</Label>
                  <Input value={freeSalesStart} onChange={(e) => setFreeSalesStart(e.target.value)} type="datetime-local" required />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-secondary" /> Fim das Vendas</Label>
                  <Input value={freeSalesEnd} onChange={(e) => setFreeSalesEnd(e.target.value)} type="datetime-local" required />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {batches.map((batch, index) => (
                  <div key={index} className="p-6 rounded-[1.5rem] border bg-muted/20 space-y-6 relative group/batch">
                    <div className="flex justify-between items-center">
                      <h4 className="font-black text-xs uppercase tracking-widest text-secondary">Lote #{index + 1}</h4>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeBatch(index)} className="text-destructive rounded-full">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold">Nome</Label>
                        <Input value={batch.name} onChange={(e) => updateBatch(index, "name", e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold">Preço (R$)</Label>
                        <Input value={batch.price} onChange={(e) => updateBatch(index, "price", e.target.value)} type="number" step="0.01" required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold">Quantidade</Label>
                        <Input value={batch.available} onChange={(e) => updateBatch(index, "available", e.target.value)} type="number" required />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold flex items-center gap-1.5"><Clock className="w-3 h-3" /> Início das Vendas</Label>
                        <Input value={batch.startDate} onChange={(e) => updateBatch(index, "startDate", e.target.value)} type="datetime-local" required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold flex items-center gap-1.5"><Clock className="w-3 h-3" /> Fim das Vendas</Label>
                        <Input value={batch.endDate} onChange={(e) => updateBatch(index, "endDate", e.target.value)} type="datetime-local" required />
                      </div>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" className="w-full border-dashed h-12 rounded-xl font-bold gap-2" onClick={addBatch}><Plus className="w-4 h-4" /> Adicionar Outro Lote</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full bg-secondary text-white hover:bg-secondary/90 h-14 text-lg font-bold rounded-[1.5rem] shadow-lg shadow-secondary/20 uppercase italic" disabled={saving || uploadProgress !== null}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          Salvar Alterações
        </Button>
      </form>
    </div>
  )
}
