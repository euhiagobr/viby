
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useDoc, useCollection, useMemoFirebase, useAuth, useUser } from "@/firebase"
import { doc, collection, addDoc, serverTimestamp, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore"
import { 
  Map as MapIcon, 
  Plus, 
  Trash2, 
  Loader2, 
  ArrowLeft, 
  CheckCircle2, 
  Grid3X3, 
  Armchair, 
  Layout, 
  Layers,
  Save,
  Palmtree,
  Square,
  Circle,
  Info
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
    return query(collection(db, "events", eventId, "setores"), orderBy("ordem", "asc"))
  }, [db, eventId])

  const { data: setores, loading: setoresLoading } = useCollection<any>(setoresQuery)

  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [selectedType, setSelectedType] = React.useState<any>("livre")

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
        await updateDoc(eventRef!, { possuiMapa: true, modoMapa: 'setores' })
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
      await deleteDoc(doc(db, "events", eventId, "setores", id))
      toast({ title: "Setor removido" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao remover" })
    }
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-primary uppercase">Mapa de Ingressos</h1>
            <p className="text-muted-foreground font-medium">{event?.title}</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl font-bold gap-2 bg-secondary text-white shadow-lg">
              <Plus className="w-4 h-4" /> Novo Setor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-[2rem]">
            <form onSubmit={handleCreateSector} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Novo Setor</DialogTitle>
                <DialogDescription>Configure o tipo de acomodação para este setor.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                   <Button type="button" variant={selectedType === 'livre' ? 'secondary' : 'outline'} className="flex-col h-20 gap-1 text-[10px] uppercase font-black" onClick={() => setSelectedType('livre')}><Layout className="w-5 h-5" /> Livre</Button>
                   <Button type="button" variant={selectedType === 'assentos' ? 'secondary' : 'outline'} className="flex-col h-20 gap-1 text-[10px] uppercase font-black" onClick={() => setSelectedType('assentos')}><Armchair className="w-5 h-5" /> Assentos</Button>
                   <Button type="button" variant={selectedType === 'mesas' ? 'secondary' : 'outline'} className="flex-col h-20 gap-1 text-[10px] uppercase font-black" onClick={() => setSelectedType('mesas')}><Grid3X3 className="w-5 h-5" /> Mesas</Button>
                </div>
                
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nome do Setor</Label><Input name="nome" placeholder="Ex: Pista, VIP, Plateia A" required className="rounded-xl" /></div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Preço (R$)</Label><Input name="preco" type="number" step="0.01" required className="rounded-xl" /></div>
                   {selectedType === 'livre' && <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Capacidade</Label><Input name="capacidade" type="number" required className="rounded-xl" /></div>}
                </div>

                {selectedType === 'assentos' && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Qtd. Fileiras</Label><Input name="fileiras" type="number" required className="rounded-xl" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Assentos/Fileira</Label><Input name="assentosPorFileira" type="number" required className="rounded-xl" /></div>
                  </div>
                )}

                {selectedType === 'mesas' && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Qtd. Mesas</Label><Input name="quantidadeMesas" type="number" required className="rounded-xl" /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cadeiras/Mesa</Label><Input name="lugaresPorMesa" type="number" required className="rounded-xl" /></div>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Formato da Mesa</Label>
                       <Select name="formatoMesa" defaultValue="circular">
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl"><SelectItem value="circular">Circular</SelectItem><SelectItem value="quadrada">Quadrada</SelectItem></SelectContent>
                       </Select>
                    </div>
                  </div>
                )}

                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cor no Mapa</Label><Input name="cor" type="color" defaultValue="#2C52EE" className="h-10 p-1 rounded-xl" /></div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-14 rounded-2xl uppercase italic shadow-xl">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Gerar Setor e Mapa"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
         <div className="md:col-span-4 space-y-6">
            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
               <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Configuração Global</CardTitle></CardHeader>
               <CardContent className="p-6 space-y-6">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nome do Palco / Foco</Label><Input value={event?.palcoNome || ""} onChange={e => updateDoc(eventRef!, { palcoNome: e.target.value })} placeholder="Ex: Palco Principal" className="rounded-xl" /></div>
                  <div className="p-4 bg-muted/20 rounded-2xl border-2 border-dashed border-border flex gap-3"><Info className="w-5 h-5 text-secondary shrink-0" /><p className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">O palco serve como orientação visual para os usuários no topo do mapa.</p></div>
               </CardContent>
            </Card>

            <div className="space-y-4">
               <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4">Setores Configurados</h2>
               {setoresLoading ? <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></div> : setores?.length === 0 ? (
                 <div className="p-12 text-center bg-white rounded-[2rem] border-2 border-dashed"><p className="text-[10px] font-bold uppercase opacity-30">Nenhum setor</p></div>
               ) : (
                 <div className="space-y-3">
                    {setores?.map((s: any) => (
                      <Card key={s.id} className="border-none shadow-sm rounded-2xl bg-white group">
                         <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                               <div className="w-3 h-10 rounded-full" style={{ backgroundColor: s.cor }} />
                               <div className="flex flex-col">
                                  <span className="font-bold text-sm uppercase">{s.nome}</span>
                                  <span className="text-[9px] font-black text-muted-foreground uppercase">{s.tipo} • {s.capacidade} lug.</span>
                               </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteSector(s.id)}><Trash2 className="w-4 h-4" /></Button>
                         </div>
                      </Card>
                    ))}
                 </div>
               )}
            </div>
         </div>

         <div className="md:col-span-8 space-y-6">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white min-h-[600px] flex flex-col overflow-hidden">
               <CardHeader className="bg-muted/30 border-b py-8">
                  <div className="w-full h-12 bg-primary rounded-xl flex items-center justify-center text-white font-black italic uppercase tracking-[0.3em] shadow-lg mb-4">{event?.palcoNome || "PALCO"}</div>
                  <p className="text-center text-[10px] font-black uppercase opacity-30 tracking-widest">Vista Superior do Mapa</p>
               </CardHeader>
               <CardContent className="p-10 flex-1 flex flex-col items-center justify-center gap-12">
                  {setores?.map((s: any) => (
                    <div key={s.id} className="w-full space-y-4">
                       <div className="flex items-center justify-between px-2"><h4 className="font-black uppercase italic tracking-tighter text-primary">{s.nome}</h4><Badge variant="outline" className="text-[8px] font-black uppercase">{s.tipo}</Badge></div>
                       {s.tipo === 'livre' ? (
                         <div className="w-full h-32 rounded-[1.5rem] border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors hover:bg-muted/10" style={{ borderColor: s.cor }}>
                            <Users className="w-6 h-6 opacity-20" />
                            <p className="text-[10px] font-black uppercase opacity-40">Área Livre: {s.capacidade} Pessoas</p>
                         </div>
                       ) : (
                         <SectorPreview setorId={s.id} eventoId={eventId} tipo={s.tipo} cor={s.cor} />
                       )}
                    </div>
                  ))}
                  {(!setores || setores.length === 0) && (
                    <div className="text-center space-y-4 opacity-20">
                       <MapIcon className="w-16 h-16 mx-auto" />
                       <p className="font-black uppercase tracking-widest text-xs">Aguardando definição de setores</p>
                    </div>
                  )}
               </CardContent>
            </Card>
         </div>
      </div>
    </div>
  )
}

function SectorPreview({ setorId, eventoId, tipo, cor }: { setorId: string, eventoId: string, tipo: string, cor: string }) {
  const db = useFirestore()
  const assentosQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "events", eventoId, "setores", setorId, "assentos"), orderBy("codigo", "asc"))
  }, [db, setorId])

  const { data: assentos, loading } = useCollection<any>(assentosQuery)

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className={cn(
      "grid gap-2 w-full",
      tipo === 'assentos' ? "grid-cols-10 md:grid-cols-20" : "grid-cols-4 md:grid-cols-8"
    )}>
       {assentos?.map((a: any) => (
         <div 
           key={a.id} 
           className={cn(
             "aspect-square rounded-md flex items-center justify-center text-[7px] font-black transition-all",
             a.status === 'disponivel' ? "bg-white border-2" : "bg-muted text-muted-foreground opacity-50"
           )} 
           style={{ borderColor: a.status === 'disponivel' ? cor : 'transparent' }}
         >
           {a.codigo}
         </div>
       ))}
    </div>
  )
}
