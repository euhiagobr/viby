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
  Info,
  Layers,
  X,
  Maximize2,
  Move,
  RotateCw,
  CheckCircle2,
  Ticket
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
  SelectValue,
  SelectGroup,
  SelectLabel
} from "@/components/ui/select"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Rnd } from "react-rnd"
import { generateMapData } from "@/lib/ticketing-service"

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
  const [selectedTicketLink, setSelectedTicketLink] = React.useState<string>("")
  
  const [palcoNome, setPalcoNome] = React.useState("PALCO PRINCIPAL")
  const [sectorToDelete, setSectorToDelete] = React.useState<any>(null)

  // Estado local para os campos do formulário (reatividade ao selecionar link)
  const [formNome, setFormNome] = React.useState("")
  const [formCapacidade, setFormCapacidade] = React.useState(0)

  React.useEffect(() => {
    if (event?.palcoNome) setPalcoNome(event.palcoNome)
  }, [event?.palcoNome])

  const availableLinks = React.useMemo(() => {
    if (!event) return []
    if (event.ticketMode === 'paid_single') {
      return [{ id: 'global', name: 'Bilheteria Global', capacity: event.capacidadeTotal }]
    }
    if (event.ticketMode === 'sector_batches') {
      return (event.sectors || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        capacity: s.capacity,
        batches: s.batches
      }))
    }
    if (event.ticketMode === 'batches') {
      return [{ id: 'global_batches', name: 'Lotes Globais', capacity: event.capacidadeTotal }]
    }
    return []
  }, [event])

  const handleLinkChange = (linkId: string) => {
    setSelectedTicketLink(linkId)
    const link = availableLinks.find(l => l.id === linkId)
    if (link) {
      setFormNome(link.name)
      setFormCapacidade(link.capacity)
    }
  }

  const handleCreateSector = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !eventId) return

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    
    const sectorData = {
      nome: formNome,
      tipo: selectedType,
      capacidade: Number(formCapacidade),
      ticketLinkId: selectedTicketLink,
      cor: formData.get("cor") as string || "#2C52EE",
      posX: 700,
      posY: 300,
      width: 250,
      height: 150,
      rotation: 0,
      zIndex: (setores?.length || 0) + 1,
      ativo: true,
      criadoEm: serverTimestamp()
    } as any

    if (selectedType === 'assentos') {
      sectorData.fileiras = Number(formData.get("fileiras"))
      sectorData.assentosPorFileira = Number(formData.get("assentosPorFileira"))
      sectorData.capacidade = sectorData.fileiras * sectorData.assentosPorFileira
    } else if (selectedType === 'mesas') {
      sectorData.quantidadeMesas = Number(formData.get("quantidadeMesas"))
      sectorData.lugaresPorMesa = Number(formData.get("lugaresPorMesa"))
      sectorData.capacidade = sectorData.quantidadeMesas * sectorData.lugaresPorMesa
    }

    try {
      const docRef = await addDoc(collection(db, "events", eventId, "setores"), sectorData)
      if (selectedType !== 'livre') {
        await generateMapData(db, eventId, docRef.id, sectorData)
      }
      toast({ title: "Setor criado e vinculado!" })
      setIsDialogOpen(false)
      setSelectedTicketLink("")
      setFormNome("")
      setFormCapacidade(0)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao criar", description: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSector = async () => {
    if (!db || !eventId || !sectorToDelete) return
    setIsSubmitting(true)
    try {
      const assentosSnap = await getDocs(collection(db, "events", eventId, "setores", sectorToDelete.id, "assentos"))
      const batch = writeBatch(db)
      assentosSnap.forEach(d => batch.delete(d.ref))
      batch.delete(doc(db, "events", eventId, "setores", sectorToDelete.id))
      await batch.commit()
      toast({ title: "Setor removido" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao remover" })
    } finally {
      setIsSubmitting(false)
      setSectorToDelete(null)
    }
  }

  const updateVisualLayout = async (sectorId: string, d: any) => {
    if (!db || !eventId) return
    updateDoc(doc(db, "events", eventId, "setores", sectorId), {
      posX: d.x,
      posY: d.y,
      width: d.width,
      height: d.height,
      updatedAt: serverTimestamp()
    })
  }

  const handleGlobalSave = async () => {
    if (!db || !eventRef) return
    setIsSubmitting(true)
    try {
      await updateDoc(eventRef, { palcoNome, mapaConfigurado: true, updatedAt: serverTimestamp() })
      toast({ title: "Planta salva com sucesso!" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar" })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-20 px-4 h-screen flex flex-col overflow-hidden text-foreground">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href={`/dashboard/evento/${eventId}/editar`}><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-primary uppercase">Planta Visual</h1>
            <p className="text-muted-foreground font-medium">{event?.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <Button onClick={handleGlobalSave} disabled={isSubmitting} className="bg-primary text-white font-black rounded-xl h-11 px-6 shadow-lg gap-2 uppercase italic">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Planta
           </Button>

           <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) setSelectedTicketLink(""); }}>
              <DialogTrigger asChild>
                <Button className="rounded-xl font-bold gap-2 bg-secondary text-white shadow-lg h-11 px-6 uppercase italic">
                  <Plus className="w-4 h-4" /> Novo Setor no Mapa
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-[2.5rem] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleCreateSector} className="space-y-6">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Vincular Bilheteria</DialogTitle>
                    <DialogDescription>Escolha uma definição de ingresso existente para representar no mapa.</DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Vincular a:</Label>
                       <Select value={selectedTicketLink} onValueChange={handleLinkChange} required>
                          <SelectTrigger className="rounded-xl h-12">
                             <SelectValue placeholder="Selecione o ingresso/setor" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                             <SelectGroup>
                                <SelectLabel className="text-[9px] font-black uppercase opacity-40">Definições Disponíveis</SelectLabel>
                                {availableLinks.map(link => (
                                  <SelectItem key={link.id} value={link.id} className="text-xs font-bold">
                                     {link.name} ({link.capacity} un.)
                                  </SelectItem>
                                ))}
                             </SelectGroup>
                          </SelectContent>
                       </Select>
                    </div>

                    {selectedTicketLink && (
                      <div className="animate-in slide-in-from-top-2 duration-300 space-y-6 border-t border-dashed pt-6">
                         <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase opacity-60">Tipo de Visualização</Label>
                            <div className="grid grid-cols-3 gap-2">
                               <Button type="button" variant={selectedType === 'livre' ? 'secondary' : 'outline'} className="flex-col h-20 gap-1 text-[10px] uppercase font-black" onClick={() => setSelectedType('livre')}><Layout className="w-5 h-5" /> Livre</Button>
                               <Button type="button" variant={selectedType === 'assentos' ? 'secondary' : 'outline'} className="flex-col h-20 gap-1 text-[10px] uppercase font-black" onClick={() => setSelectedType('assentos')}><Armchair className="w-5 h-5" /> Assentos</Button>
                               <Button type="button" variant={selectedType === 'mesas' ? 'secondary' : 'outline'} className="flex-col h-20 gap-1 text-[10px] uppercase font-black" onClick={() => setSelectedType('mesas')}><Grid3X3 className="w-5 h-5" /> Mesas</Button>
                            </div>
                         </div>

                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase opacity-60">Nome no Mapa</Label>
                            <Input value={formNome} onChange={e => setFormNome(e.target.value)} required className="rounded-xl h-11" />
                         </div>

                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cor do Setor</Label><Input name="cor" type="color" defaultValue="#2C52EE" className="h-10 p-1" /></div>
                            <div className="space-y-2">
                               <Label className="text-[10px] font-black uppercase opacity-60">Capacidade</Label>
                               <Input type="number" value={formCapacidade} onChange={e => setFormCapacidade(Number(e.target.value))} required className="rounded-xl h-11 font-black" />
                            </div>
                         </div>

                         {selectedType === 'assentos' && (
                           <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-2xl border border-dashed">
                             <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Fileiras</Label><Input name="fileiras" type="number" required defaultValue={Math.ceil(formCapacidade/10)} /></div>
                             <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Assentos/Fila</Label><Input name="assentosPorFileira" type="number" required defaultValue={10} /></div>
                           </div>
                         )}

                         {selectedType === 'mesas' && (
                           <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-2xl border border-dashed">
                             <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Qtd Mesas</Label><Input name="quantidadeMesas" type="number" required defaultValue={Math.ceil(formCapacidade/4)} /></div>
                             <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Lugares/Mesa</Label><Input name="lugaresPorMesa" type="number" required defaultValue={4} /></div>
                           </div>
                         )}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting || !selectedTicketLink} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                       {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Vincular e Adicionar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
           </Dialog>
        </div>
      </div>

      <div className="flex-1 relative bg-muted/20 border-2 border-dashed rounded-[2.5rem] overflow-hidden">
        <div className="absolute inset-0 overflow-auto custom-scrollbar">
          <div className="relative min-w-[2000px] min-h-[1500px] bg-white" style={{ backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 0)', backgroundSize: '30px 30px' }}>
            {/* Palco */}
            <Rnd bounds="parent" default={{ x: 700, y: 50, width: 600, height: 120 }}>
              <div className="w-full h-full bg-primary text-white flex flex-col items-center justify-center rounded-2xl shadow-2xl border-4 border-white/20 select-none">
                <span className="font-black italic uppercase tracking-[0.5em] text-xl">{palcoNome}</span>
              </div>
            </Rnd>

            {/* Setores */}
            {setores?.map((s: any) => (
              <Rnd
                key={s.id}
                bounds="parent"
                size={{ width: s.width || 250, height: s.height || 150 }}
                position={{ x: s.posX || 0, y: s.posY || 0 }}
                onDragStop={(e, d) => updateVisualLayout(s.id, { x: d.x, y: d.y, width: s.width, height: s.height })}
                onResizeStop={(e, direction, ref, delta, position) => updateVisualLayout(s.id, { x: position.x, y: position.y, width: parseInt(ref.style.width), height: parseInt(ref.style.height) })}
              >
                <div 
                  className="w-full h-full flex flex-col items-center justify-center shadow-lg border-2 transition-all group select-none relative rounded-[2.5rem]"
                  style={{ backgroundColor: `${s.cor}15`, borderColor: s.cor, color: s.cor, transform: `rotate(${s.rotation || 0}deg)` }}
                >
                   <div className="text-center p-4">
                      <h4 className="font-black uppercase italic text-sm mb-1">{s.nome}</h4>
                      <Badge variant="outline" className="text-[8px] font-black uppercase border-current mb-2" style={{ color: s.cor }}>{s.tipo}</Badge>
                      <p className="text-[10px] font-black opacity-60">{s.capacidade} LUGARES TOTAIS</p>
                   </div>
                   <Button variant="ghost" size="icon" className="absolute top-3 right-3 h-8 w-8 text-destructive bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-white" onClick={() => setSectorToDelete(s)}>
                      <Trash2 className="w-4 h-4" />
                   </Button>
                </div>
              </Rnd>
            ))}
          </div>
        </div>
      </div>

      <AlertDialog open={!!sectorToDelete} onOpenChange={() => setSectorToDelete(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter">Remover Setor?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação apagará permanentemente o setor <strong>{sectorToDelete?.nome}</strong> e todos os assentos vinculados a ele na planta visual.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSector} disabled={isSubmitting} className="bg-destructive text-white rounded-xl font-black uppercase text-[10px]">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
