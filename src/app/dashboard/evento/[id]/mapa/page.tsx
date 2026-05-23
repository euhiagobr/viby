
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
  Info,
  ChevronLeft,
  ChevronRight,
  MoveHorizontal
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
      posicaoGrade: 0,
      larguraGrade: 12,
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

  const handleUpdatePosition = async (id: string, updates: any) => {
    if (!db || !eventId) return
    try {
      await updateDoc(doc(db, "events", eventId, "setores", id), updates)
    } catch (e) {}
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard/organizacoes"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-primary uppercase">Engenharia de Mapa</h1>
            <p className="text-muted-foreground font-medium">{event?.title}</p>
          </div>
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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 px-4">
         <div className="xl:col-span-4 space-y-6">
            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
               <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Palco do Evento</CardTitle></CardHeader>
               <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Nome para Orientação</Label>
                    <Input value={event?.palcoNome || ""} onChange={e => updateDoc(eventRef!, { palcoNome: e.target.value })} placeholder="Ex: Palco Principal" className="rounded-xl" />
                  </div>
               </CardContent>
            </Card>

            <div className="space-y-4">
               <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4">Gestão de Setores</h2>
               {setoresLoading ? <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></div> : setores?.length === 0 ? (
                 <div className="p-12 text-center bg-white rounded-[2rem] border-2 border-dashed opacity-30"><p className="text-[10px] font-bold uppercase">Nenhum setor criado</p></div>
               ) : (
                 <div className="space-y-4">
                    {setores?.map((s: any) => (
                      <Card key={s.id} className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                         <div className="p-5 space-y-4">
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                  <div className="w-3 h-10 rounded-full" style={{ backgroundColor: s.cor }} />
                                  <div className="flex flex-col">
                                     <span className="font-black text-sm uppercase italic text-primary">{s.nome}</span>
                                     <span className="text-[9px] font-black text-muted-foreground uppercase">{s.tipo} • {s.capacidade} lug.</span>
                                  </div>
                               </div>
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteSector(s.id)}><Trash2 className="w-4 h-4" /></Button>
                            </div>

                            <Separator className="border-dashed" />
                            
                            <div className="space-y-3">
                               <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Ajuste de Grade (12 colunas)</p>
                               <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                     <Label className="text-[8px] font-black uppercase opacity-40">Largura (Span)</Label>
                                     <div className="flex items-center gap-2">
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleUpdatePosition(s.id, { larguraGrade: Math.max(1, (s.larguraGrade || 12) - 1) })}><ChevronLeft className="w-3 h-3" /></Button>
                                        <span className="font-black text-xs min-w-4 text-center">{s.larguraGrade || 12}</span>
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleUpdatePosition(s.id, { larguraGrade: Math.min(12, (s.larguraGrade || 1) + 1) })}><ChevronRight className="w-3 h-3" /></Button>
                                     </div>
                                  </div>
                                  <div className="space-y-2">
                                     <Label className="text-[8px] font-black uppercase opacity-40">Posição X</Label>
                                     <div className="flex items-center gap-2">
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleUpdatePosition(s.id, { posicaoGrade: Math.max(0, (s.posicaoGrade || 0) - 1) })}><ChevronLeft className="w-3 h-3" /></Button>
                                        <span className="font-black text-xs min-w-4 text-center">{s.posicaoGrade || 0}</span>
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleUpdatePosition(s.id, { posicaoGrade: Math.min(11, (s.posicaoGrade || 0) + 1) })}><ChevronRight className="w-3 h-3" /></Button>
                                     </div>
                                  </div>
                               </div>
                            </div>
                         </div>
                      </Card>
                    ))}
                 </div>
               )}
            </div>
         </div>

         <div className="xl:col-span-8 space-y-6">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-[#fdfdfd] min-h-[700px] flex flex-col overflow-hidden">
               <CardHeader className="bg-primary p-10 border-b relative overflow-hidden">
                  <div className="relative z-10 text-center space-y-2">
                     <div className="w-full h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white font-black italic uppercase tracking-[0.5em] shadow-2xl border border-white/20">
                        {event?.palcoNome || "PALCO"}
                     </div>
                     <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em]">Área de Atuação / Foco</p>
                  </div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full -mr-32 -mt-32 blur-3xl" />
               </CardHeader>
               
               <CardContent className="p-10 flex-1">
                  <div className="grid grid-cols-12 gap-6 items-start">
                     {setores?.map((s: any) => (
                       <div 
                         key={s.id} 
                         style={{ 
                           gridColumn: `${(s.posicaoGrade || 0) + 1} / span ${s.larguraGrade || 12}`,
                         }}
                         className="space-y-3 animate-in fade-in duration-500"
                       >
                          <div className="flex items-center justify-between px-2">
                             <h4 className="font-black uppercase italic text-xs text-primary">{s.nome}</h4>
                             <Badge variant="ghost" className="text-[8px] p-0 font-black uppercase opacity-40">{s.tipo}</Badge>
                          </div>
                          {s.tipo === 'livre' ? (
                            <div className="w-full h-24 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all bg-white" style={{ borderColor: s.cor, color: s.cor }}>
                               <Users className="w-5 h-5 opacity-20" />
                               <p className="text-[9px] font-black uppercase opacity-60">Área Livre ({s.capacidade} lug.)</p>
                            </div>
                          ) : (
                            <SectorPreview setorId={s.id} eventoId={eventId} tipo={s.tipo} cor={s.cor} />
                          )}
                       </div>
                     ))}
                  </div>
                  {(!setores || setores.length === 0) && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-10 py-40">
                       <MapIcon className="w-20 h-20" />
                       <p className="font-black uppercase tracking-[0.4em] text-sm">Planta de Ingressos Vazia</p>
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
      "grid gap-1.5 p-4 bg-white rounded-3xl shadow-sm border",
      tipo === 'assentos' ? "grid-cols-10 md:grid-cols-12 lg:grid-cols-15" : "grid-cols-4 md:grid-cols-6"
    )}>
       {assentos?.map((a: any) => (
         <div 
           key={a.id} 
           className={cn(
             "aspect-square rounded-md flex items-center justify-center text-[6px] font-black transition-all",
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
