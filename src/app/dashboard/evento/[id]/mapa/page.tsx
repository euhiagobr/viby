"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useDoc, useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from "@/firebase"
import { doc, collection, addDoc, serverTimestamp, updateDoc, deleteDoc, query, orderBy, writeBatch, getDocs } from "firebase/firestore"
import { 
  Map as MapIcon, 
  Plus, 
  Trash2, 
  Loader2, 
  ArrowLeft, 
  Grid3X3, 
  Armchair, 
  Layout, 
  Save,
  ChevronLeft,
  ChevronRight,
  Info,
  Users,
  Settings2,
  Accessibility,
  UserCheck,
  Zap,
  ArrowUp,
  ArrowDown,
  MoveHorizontal,
  BoxSelect,
  X,
  Maximize2,
  Minimize2,
  Move,
  GripHorizontal
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { generateMapData } from "@/lib/ticketing-service"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Rnd } from "react-rnd"

export default function EventoMapaPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  
  const eventRef = React.useMemo(() => (db && eventId) ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const setoresQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(collection(db, "events", eventId, "setores"), orderBy("zIndex", "asc"))
  }, [db, eventId])

  const { data: setores, loading: setoresLoading } = useCollection<any>(setoresQuery)

  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [selectedType, setSelectedType] = React.useState<any>("livre")
  const [isSavingLayout, setIsSavingLayout] = React.useState(false)
  
  const [palcoNome, setPalcoNome] = React.useState("PALCO PRINCIPAL")
  const [editMode, setEditMode] = React.useState<'list' | 'visual'>('visual')

  React.useEffect(() => {
    if (event?.palcoNome) {
      setPalcoNome(event.palcoNome)
    }
  }, [event?.palcoNome])

  const handleCreateSector = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !eventId) return

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    
    const sectorData = {
      nome: formData.get("nome") as string,
      tipo: selectedType,
      preco: parseFloat(formData.get("preco") as string) || 0,
      capacidade: parseInt(formData.get("capacidade") as string) || 0,
      cor: formData.get("cor") as string || "#2C52EE",
      descricao: formData.get("descricao") as string || "",
      ordem: (setores?.length || 0) + 1,
      posX: 10,
      posY: 30,
      width: 200,
      height: 120,
      zIndex: (setores?.length || 0) + 1,
      formatoVisual: 'retangulo',
      ativo: true,
      criadoEm: serverTimestamp()
    } as any

    if (selectedType === 'assentos') {
      sectorData.fileiras = parseInt(formData.get("fileiras") as string) || 0
      sectorData.assentosPorFileira = parseInt(formData.get("assentosPorFileira") as string) || 0
      sectorData.capacidade = sectorData.fileiras * sectorData.assentosPorFileira
    } else if (selectedType === 'mesas') {
      sectorData.quantidadeMesas = parseInt(formData.get("quantidadeMesas") as string) || 0
      sectorData.lugaresPorMesa = parseInt(formData.get("lugaresPorMesa") as string) || 0
      sectorData.formatoMesa = formData.get("formatoMesa") as any || "circular"
      sectorData.capacidade = sectorData.quantidadeMesas * sectorData.lugaresPorMesa
    }

    try {
      const docRef = await addDoc(collection(db, "events", eventId, "setores"), sectorData)
      if (selectedType !== 'livre') {
        await generateMapData(db, eventId, docRef.id, sectorData)
      }
      if (!event.possuiMapa) {
        await updateDoc(eventRef!, { possuiMapa: true, mapaConfigurado: true })
      }
      toast({ title: "Setor criado!", description: `${sectorData.nome} adicionado ao mapa.` })
      setIsDialogOpen(false)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao criar", description: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSector = async (id: string) => {
    if (!db || !eventId) return
    if (!confirm("Isso removerá o setor e todos os assentos vinculados. Continuar?")) return

    try {
      const assentosSnap = await getDocs(collection(db, "events", eventId, "setores", id, "assentos"))
      const batch = writeBatch(db)
      assentosSnap.forEach(d => batch.delete(d.ref))
      batch.delete(doc(db, "events", eventId, "setores", id))
      await batch.commit()
      toast({ title: "Setor removido" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao remover" })
    }
  }

  const updateVisualLayout = async (sectorId: string, d: any) => {
    if (!db || !eventId) return
    try {
      await updateDoc(doc(db, "events", eventId, "setores", sectorId), {
        posX: d.x,
        posY: d.y,
        width: d.width,
        height: d.height,
        updatedAt: serverTimestamp()
      })
    } catch (e) {}
  }

  const updatePalcoLayout = async (d: any) => {
    if (!db || !eventRef) return
    try {
      await updateDoc(eventRef, {
        palcoPosX: d.x,
        palcoPosY: d.y,
        palcoWidth: d.width,
        palcoHeight: d.height,
        updatedAt: serverTimestamp()
      })
    } catch (e) {}
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-20 px-4 h-screen flex flex-col overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href={`/dashboard/evento/${eventId}/editar`}><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-primary uppercase">Editor de Planta Visual</h1>
            <p className="text-muted-foreground font-medium">{event?.title}</p>
          </div>
        </div>
        <div className="flex gap-3">
           <div className="bg-muted p-1 rounded-xl flex">
              <Button variant={editMode === 'visual' ? 'secondary' : 'ghost'} size="sm" onClick={() => setEditMode('visual')} className="rounded-lg text-[10px] font-black uppercase">Editor Visual</Button>
              <Button variant={editMode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setEditMode('list')} className="rounded-lg text-[10px] font-black uppercase">Configurações</Button>
           </div>
           
           <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl font-bold gap-2 bg-secondary text-white shadow-lg">
                  <Plus className="w-4 h-4" /> Novo Setor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-[2.5rem]">
                <form onSubmit={handleCreateSector} className="space-y-6">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Novo Setor</DialogTitle>
                    <DialogDescription>Configure um novo bloco de assentos ou área livre.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                       <Button type="button" variant={selectedType === 'livre' ? 'secondary' : 'outline'} className="flex-col h-20 gap-1 text-[10px] uppercase font-black" onClick={() => setSelectedType('livre')}><Layout className="w-5 h-5" /> Livre</Button>
                       <Button type="button" variant={selectedType === 'assentos' ? 'secondary' : 'outline'} className="flex-col h-20 gap-1 text-[10px] uppercase font-black" onClick={() => setSelectedType('assentos')}><Armchair className="w-5 h-5" /> Assentos</Button>
                       <Button type="button" variant={selectedType === 'mesas' ? 'secondary' : 'outline'} className="flex-col h-20 gap-1 text-[10px] uppercase font-black" onClick={() => setSelectedType('mesas')}><Grid3X3 className="w-5 h-5" /> Mesas</Button>
                    </div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nome do Setor</Label><Input name="nome" placeholder="Ex: Pista Premium" required className="rounded-xl" /></div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Preço (R$)</Label><Input name="preco" type="number" step="0.01" required className="rounded-xl" /></div>
                       {selectedType === 'livre' && <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Capacidade</Label><Input name="capacidade" type="number" required className="rounded-xl" /></div>}
                    </div>
                    {selectedType === 'assentos' && (
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Fileiras</Label><Input name="fileiras" type="number" required className="rounded-xl" /></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Assentos/Fila</Label><Input name="assentosPorFileira" type="number" required className="rounded-xl" /></div>
                      </div>
                    )}
                    {selectedType === 'mesas' && (
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Qtd. Mesas</Label><Input name="quantidadeMesas" type="number" required className="rounded-xl" /></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Lugares/Mesa</Label><Input name="lugaresPorMesa" type="number" required className="rounded-xl" /></div>
                      </div>
                    )}
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cor Visual</Label><Input name="cor" type="color" defaultValue="#2C52EE" className="h-10 p-1 rounded-xl" /></div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-14 rounded-2xl uppercase italic shadow-xl">{isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Criar Setor"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
           </Dialog>
        </div>
      </div>

      {editMode === 'visual' ? (
        <div className="flex-1 relative bg-muted/20 border-2 border-dashed rounded-[2.5rem] overflow-hidden">
           {/* Canvas Area */}
           <div className="absolute inset-0 overflow-auto custom-scrollbar">
              <div 
                className="relative min-w-[2000px] min-h-[1500px] bg-white"
                style={{ 
                  backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 0)', 
                  backgroundSize: '30px 30px' 
                }}
              >
                {/* Palco */}
                <Rnd
                  bounds="parent"
                  size={{ width: event.palcoWidth || 600, height: event.palcoHeight || 120 }}
                  position={{ x: event.palcoPosX || 700, y: event.palcoPosY || 50 }}
                  onDragStop={(e, d) => updatePalcoLayout({ x: d.x, y: d.y, width: event.palcoWidth || 600, height: event.palcoHeight || 120 })}
                  onResizeStop={(e, direction, ref, delta, position) => updatePalcoLayout({ x: position.x, y: position.y, width: parseInt(ref.style.width), height: parseInt(ref.style.height) })}
                  dragHandleClassName="palco-handle"
                >
                  <div className="w-full h-full bg-primary text-white flex flex-col items-center justify-center rounded-2xl shadow-2xl border-4 border-white/20 select-none group">
                     <div className="palco-handle absolute inset-0 cursor-move" />
                     <div className="relative z-10 text-center space-y-1">
                        <Input 
                          value={palcoNome} 
                          onChange={e => { setPalcoNome(e.target.value.toUpperCase()); updateDoc(eventRef!, { palcoNome: e.target.value.toUpperCase() }); }} 
                          className="bg-transparent border-none text-center font-black italic uppercase tracking-[0.5em] text-xl focus-visible:ring-0 p-0 h-auto w-full min-w-[200px]" 
                        />
                        <p className="text-[10px] font-black uppercase opacity-40 tracking-widest">Foco Frontal</p>
                     </div>
                  </div>
                </Rnd>

                {/* Setores */}
                {setores?.map((s: any) => (
                  <Rnd
                    key={s.id}
                    bounds="parent"
                    size={{ width: s.width || 200, height: s.height || 120 }}
                    position={{ x: s.posX || 0, y: s.posY || 0 }}
                    onDragStop={(e, d) => updateVisualLayout(s.id, { x: d.x, y: d.y, width: s.width || 200, height: s.height || 120 })}
                    onResizeStop={(e, direction, ref, delta, position) => updateVisualLayout(s.id, { x: position.x, y: position.y, width: parseInt(ref.style.width), height: parseInt(ref.style.height) })}
                    dragHandleClassName="sector-handle"
                    minWidth={100}
                    minHeight={80}
                  >
                    <div 
                      className={cn(
                        "w-full h-full flex flex-col items-center justify-center shadow-lg border-2 transition-all group select-none relative",
                        s.formatoVisual === 'circulo' ? "rounded-full" : "rounded-3xl"
                      )}
                      style={{ 
                        backgroundColor: `${s.cor}20`, 
                        borderColor: s.cor,
                        color: s.cor
                      }}
                    >
                       <div className="sector-handle absolute inset-0 cursor-move" />
                       <div className="relative z-10 text-center p-4">
                          <h4 className="font-black uppercase italic text-xs mb-1">{s.nome}</h4>
                          <div className="flex flex-col items-center gap-1 opacity-60">
                             <p className="text-[10px] font-black">{s.capacidade} LUG.</p>
                             <p className="text-[9px] font-bold uppercase">{s.tipo}</p>
                          </div>
                       </div>
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="absolute top-2 right-2 h-6 w-6 rounded-full text-destructive bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                         onClick={(e) => { e.stopPropagation(); handleDeleteSector(s.id); }}
                       >
                          <Trash2 className="w-3 h-3" />
                       </Button>
                    </div>
                  </Rnd>
                ))}
              </div>
           </div>

           {/* Toolbar lateral flutuante */}
           <div className="absolute top-8 left-8 z-50 space-y-4">
              <Card className="p-2 border-none shadow-2xl rounded-2xl bg-white/90 backdrop-blur-md">
                 <div className="flex flex-col gap-2">
                    <TooltipProvider>
                       <Tooltip>
                          <TooltipTrigger asChild>
                             <Button variant="secondary" size="icon" className="rounded-xl"><Move className="w-4 h-4" /></Button>
                          </TooltipTrigger>
                          <TooltipContent side="right">Arraste para mover</TooltipContent>
                       </Tooltip>
                       <Tooltip>
                          <TooltipTrigger asChild>
                             <Button variant="ghost" size="icon" className="rounded-xl"><Maximize2 className="w-4 h-4" /></Button>
                          </TooltipTrigger>
                          <TooltipContent side="right">Redimensione pelos cantos</TooltipContent>
                       </Tooltip>
                    </TooltipProvider>
                 </div>
              </Card>
           </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             {setores?.map((s: any) => (
                <Card key={s.id} className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
                   <CardContent className="p-8 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                         <div className="p-3 rounded-2xl" style={{ backgroundColor: `${s.cor}20`, color: s.cor }}>
                            {s.tipo === 'assentos' ? <Armchair className="w-6 h-6" /> : s.tipo === 'mesas' ? <Grid3X3 className="w-6 h-6" /> : <Layout className="w-6 h-6" />}
                         </div>
                         <div>
                            <h4 className="text-lg font-black uppercase italic tracking-tighter text-primary">{s.nome}</h4>
                            <p className="text-xs font-bold text-muted-foreground uppercase">{s.tipo} • {s.capacidade} Lugares • {s.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                         </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive h-10 w-10 rounded-full hover:bg-destructive/5" onClick={() => handleDeleteSector(s.id)}>
                         <Trash2 className="w-5 h-5" />
                      </Button>
                   </CardContent>
                </Card>
             ))}
          </div>
        </div>
      )}
    </div>
  )
}