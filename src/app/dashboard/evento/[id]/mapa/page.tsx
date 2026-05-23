
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useDoc, useCollection, useMemoFirebase, useAuth, useUser } from "@/firebase"
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
  BoxSelect
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
  
  const [selectedSeatForEdit, setSelectedSeatForEdit] = React.useState<any>(null)
  const [isSeatEditorOpen, setIsSeatEditorOpen] = React.useState(false)

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

  const handleUpdatePosition = async (id: string, updates: any) => {
    if (!db || !eventId) return
    try {
      await updateDoc(doc(db, "events", eventId, "setores", id), updates)
    } catch (e) {}
  }

  const handleUpdateSeatCategory = async (category: string) => {
    if (!db || !selectedSeatForEdit) return
    setIsSubmitting(true)
    try {
      await updateDoc(doc(db, "events", eventId, "setores", selectedSeatForEdit.setorId, "assentos", selectedSeatForEdit.id), {
        categoria: category,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Assento atualizado!" })
      setIsSeatEditorOpen(false)
      setSelectedSeatForEdit(null)
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar assento" })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-20 px-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href={`/dashboard/evento/${eventId}/editar`}><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-primary uppercase">Engenharia de Planta</h1>
            <p className="text-muted-foreground font-medium">{event?.title}</p>
          </div>
        </div>
        <div className="flex gap-3">
           <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl font-bold gap-2 bg-secondary text-white shadow-lg">
                  <Plus className="w-4 h-4" /> Novo Bloco/Setor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-[2.5rem]">
                <form onSubmit={handleCreateSector} className="space-y-6">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Novo Bloco</DialogTitle>
                    <DialogDescription>Configure um novo bloco de assentos ou área livre.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                       <Button type="button" variant={selectedType === 'livre' ? 'secondary' : 'outline'} className="flex-col h-20 gap-1 text-[10px] uppercase font-black" onClick={() => setSelectedType('livre')}><Layout className="w-5 h-5" /> Livre</Button>
                       <Button type="button" variant={selectedType === 'assentos' ? 'secondary' : 'outline'} className="flex-col h-20 gap-1 text-[10px] uppercase font-black" onClick={() => setSelectedType('assentos')}><Armchair className="w-5 h-5" /> Assentos</Button>
                       <Button type="button" variant={selectedType === 'mesas' ? 'secondary' : 'outline'} className="flex-col h-20 gap-1 text-[10px] uppercase font-black" onClick={() => setSelectedType('mesas')}><Grid3X3 className="w-5 h-5" /> Mesas</Button>
                    </div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nome do Bloco</Label><Input name="nome" placeholder="Ex: Plateia Esquerda" required className="rounded-xl" /></div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Preço (R$)</Label><Input name="preco" type="number" step="0.01" required className="rounded-xl" /></div>
                       {selectedType === 'livre' && <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Capacidade</Label><Input name="capacidade" type="number" required className="rounded-xl" /></div>}
                    </div>
                    {selectedType === 'assentos' && (
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Fileiras</Label><Input name="fileiras" type="number" required className="rounded-xl" /></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cadeiras/Fila</Label><Input name="assentosPorFileira" type="number" required className="rounded-xl" /></div>
                      </div>
                    )}
                    {selectedType === 'mesas' && (
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Qtd. Mesas</Label><Input name="quantidadeMesas" type="number" required className="rounded-xl" /></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Lugares/Mesa</Label><Input name="lugaresPorMesa" type="number" required className="rounded-xl" /></div>
                      </div>
                    )}
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cor de Identificação</Label><Input name="cor" type="color" defaultValue="#2C52EE" className="h-10 p-1 rounded-xl" /></div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-14 rounded-2xl uppercase italic shadow-xl">{isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Gerar Bloco"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
           </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
         <div className="xl:col-span-4 space-y-6">
            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
               <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2"><Settings2 className="w-4 h-4 text-secondary" /> Montagem da Planta</CardTitle></CardHeader>
               <CardContent className="p-6">
                  <ScrollArea className="h-[600px] pr-4">
                     <div className="space-y-4">
                        {setores?.map((s: any, idx: number) => (
                          <div key={s.id} className="p-5 bg-muted/20 rounded-2xl border border-border/50 space-y-4 group">
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                   <Badge className="h-5 w-5 rounded-md p-0 flex items-center justify-center bg-primary text-[10px] font-black">{idx + 1}</Badge>
                                   <span className="font-black text-[11px] uppercase italic text-primary">{s.nome}</span>
                                </div>
                                <div className="flex gap-1">
                                   <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-white" onClick={() => handleUpdatePosition(s.id, { ordem: Math.max(1, (s.ordem || 1) - 1) })} title="Subir (Profundidade)"><ArrowUp className="w-3.5 h-3.5" /></Button>
                                   <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-white" onClick={() => handleUpdatePosition(s.id, { ordem: (s.ordem || 1) + 1 })} title="Descer (Profundidade)"><ArrowDown className="w-3.5 h-3.5" /></Button>
                                   <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteSector(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                                </div>
                             </div>
                             
                             <div className="space-y-3 pt-2 border-t border-dashed">
                                <div className="space-y-1.5">
                                   <Label className="text-[8px] font-black uppercase opacity-40 flex items-center gap-1"><MoveHorizontal className="w-2.5 h-2.5" /> Posição Lateral (Esquerda para Direita)</Label>
                                   <div className="flex items-center gap-2">
                                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg bg-white" onClick={() => handleUpdatePosition(s.id, { posicaoGrade: Math.max(0, (s.posicaoGrade || 0) - 1) })}><ChevronLeft className="w-4 h-4" /></Button>
                                      <div className="flex-1 h-8 bg-white rounded-lg border flex items-center justify-center px-3 relative overflow-hidden">
                                         <div className="absolute inset-0 bg-primary/5" style={{ left: `${((s.posicaoGrade || 0) / 12) * 100}%`, width: `${((s.larguraGrade || 12) / 12) * 100}%` }} />
                                         <span className="text-[10px] font-black z-10">Col. {(s.posicaoGrade || 0) + 1}</span>
                                      </div>
                                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg bg-white" onClick={() => handleUpdatePosition(s.id, { posicaoGrade: Math.min(12 - (s.larguraGrade || 12), (s.posicaoGrade || 0) + 1) })}><ChevronRight className="w-4 h-4" /></Button>
                                   </div>
                                </div>

                                <div className="space-y-1.5">
                                   <Label className="text-[8px] font-black uppercase opacity-40 flex items-center gap-1"><BoxSelect className="w-2.5 h-2.5" /> Largura do Bloco (Físico)</Label>
                                   <div className="flex items-center gap-2">
                                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg bg-white" onClick={() => handleUpdatePosition(s.id, { larguraGrade: Math.max(1, (s.larguraGrade || 12) - 1) })}><ChevronLeft className="w-4 h-4" /></Button>
                                      <div className="flex-1 h-8 bg-white rounded-lg border flex items-center justify-center px-3">
                                         <span className="text-[10px] font-black uppercase">{s.larguraGrade || 12} Unidades</span>
                                      </div>
                                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg bg-white" onClick={() => handleUpdatePosition(s.id, { larguraGrade: Math.min(12 - (s.posicaoGrade || 0), (s.larguraGrade || 1) + 1) })}><ChevronRight className="w-4 h-4" /></Button>
                                   </div>
                                </div>
                             </div>
                             
                             <div className="p-3 bg-white rounded-xl border border-dashed flex justify-between items-center">
                                <div className="space-y-0.5">
                                   <p className="text-[7px] font-black uppercase opacity-40">Capacidade</p>
                                   <p className="text-xs font-black text-primary">{s.capacidade} lug.</p>
                                </div>
                                <div className="text-right space-y-0.5">
                                   <p className="text-[7px] font-black uppercase opacity-40">Valor de Venda</p>
                                   <p className="text-xs font-black text-secondary">{s.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                </div>
                             </div>
                          </div>
                        ))}
                     </div>
                  </ScrollArea>
               </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-[2rem] bg-secondary/5 border border-dashed border-secondary/20">
               <CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest text-secondary flex items-center gap-2"><Info className="w-4 h-4" /> Guia de Montagem</CardTitle></CardHeader>
               <CardContent className="space-y-4 text-[10px] font-medium text-muted-foreground leading-relaxed">
                  <p>• <strong>Posição Lateral:</strong> Move o bloco entre as 12 colunas horizontais do mapa.</p>
                  <p>• <strong>Largura do Bloco:</strong> Define quão largo o setor será visualmente.</p>
                  <p>• <strong>Profundidade (Setas):</strong> Define a ordem vertical. Itens no topo da lista aparecem mais próximos do palco.</p>
                  <Separator className="border-dashed" />
                  <p className="font-bold italic">Dica: Para colocar setores lado a lado, a soma da Posição + Largura não deve exceder 12.</p>
               </CardContent>
            </Card>
         </div>

         <div className="xl:col-span-8 space-y-6">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white min-h-[900px] flex flex-col overflow-hidden">
               <CardHeader className="bg-primary p-12 border-b relative overflow-hidden text-center">
                  <div className="relative z-10 space-y-4">
                     <div className="w-full h-16 bg-white/10 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center text-white border border-white/20 shadow-2xl">
                        <Input 
                          value={palcoNome} 
                          onChange={e => { setPalcoNome(e.target.value.toUpperCase()); updateDoc(eventRef!, { palcoNome: e.target.value.toUpperCase() }); }} 
                          className="bg-transparent border-none text-center font-black italic uppercase tracking-[0.6em] text-lg focus-visible:ring-0 h-10 w-full" 
                        />
                        <p className="text-[8px] font-black uppercase opacity-40 tracking-widest -mt-1">Orientação Frontal</p>
                     </div>
                  </div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full -mr-32 -mt-32 blur-3xl" />
               </CardHeader>
               
               <CardContent className="p-10 flex-1 overflow-x-auto bg-[#fafafa]">
                  {/* GRID VISUALIZER OVERLAY EM BACKGROUND */}
                  <div className="relative w-full min-w-[800px] min-h-[800px]">
                     <div className="absolute inset-0 grid grid-cols-12 gap-8 pointer-events-none opacity-[0.03]">
                        {Array.from({ length: 12 }).map((_, i) => (
                           <div key={i} className="bg-primary h-full border-x" />
                        ))}
                     </div>

                     <div className="grid grid-cols-12 gap-x-8 gap-y-12 items-start relative z-10">
                        {setores?.map((s: any) => (
                          <div 
                            key={s.id} 
                            style={{ 
                               gridColumn: `${(s.posicaoGrade || 0) + 1} / span ${s.larguraGrade || 12}`,
                            }}
                            className="space-y-3 animate-in fade-in duration-500"
                          >
                             <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white rounded-xl shadow-sm border border-border/60">
                                <h4 className="font-black uppercase italic text-[9px] text-primary truncate">{s.nome}</h4>
                                <div className="flex items-center gap-1">
                                   <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.cor }} />
                                   <span className="text-[7px] font-black uppercase opacity-30">{s.tipo}</span>
                                </div>
                             </div>
                             {s.tipo === 'livre' ? (
                               <div className="w-full h-32 rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all bg-white shadow-inner" style={{ borderColor: s.cor, color: s.cor }}>
                                  <Users className="w-6 h-6 opacity-20" />
                                  <div className="text-center">
                                     <p className="text-[9px] font-black uppercase">{s.capacidade} LUGARES</p>
                                     <p className="text-[8px] font-bold opacity-60">ÁREA LIVRE</p>
                                  </div>
                               </div>
                             ) : (
                               <SectorEditGrid setor={s} eventoId={eventId} onSeatClick={(seat) => { setSelectedSeatForEdit(seat); setIsSeatEditorOpen(true); }} />
                             )}
                          </div>
                        ))}
                     </div>

                     {(!setores || setores.length === 0) && (
                       <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-4 opacity-10 py-60">
                          <MapIcon className="w-24 h-24" />
                          <p className="font-black uppercase tracking-[0.5em] text-sm">Adicione blocos na lateral esquerda para começar</p>
                       </div>
                     )}
                  </div>
               </CardContent>
            </Card>
         </div>
      </div>

      {/* DIALOG EDITOR DE ASSENTO */}
      <Dialog open={isSeatEditorOpen} onOpenChange={(o) => !o && (setIsSeatEditorOpen(false), setSelectedSeatForEdit(null))}>
         <DialogContent className="max-w-sm rounded-[2.5rem]">
            <DialogHeader>
               <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-2">
                  <Armchair className="w-8 h-8 text-primary" />
               </div>
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center">Configurar Lugar {selectedSeatForEdit?.codigo}</DialogTitle>
               <DialogDescription className="text-center font-medium">Aplique regras de acessibilidade para este assento.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
               <Button variant="outline" className={cn("w-full h-14 justify-start gap-4 rounded-2xl border-border hover:bg-muted font-bold", selectedSeatForEdit?.categoria === 'comum' && "border-primary bg-primary/5 ring-1 ring-primary")} onClick={() => handleUpdateSeatCategory('comum')}>
                  <div className="w-4 h-4 rounded-full bg-slate-300 shadow-inner" /> 
                  <div className="text-left"><p className="text-xs uppercase font-black">Padrão</p><p className="text-[9px] font-medium opacity-60">Venda normal inteira/meia</p></div>
               </Button>
               <Button variant="outline" className={cn("w-full h-14 justify-start gap-4 rounded-2xl border-border hover:bg-muted font-bold", selectedSeatForEdit?.categoria === 'pcd' && "border-cyan-400 bg-cyan-50 ring-1 ring-cyan-400")} onClick={() => handleUpdateSeatCategory('pcd')}>
                  <Accessibility className="w-5 h-5 text-cyan-500" /> 
                  <div className="text-left"><p className="text-xs uppercase font-black">Cadeirante (PCD)</p><p className="text-[9px] font-medium opacity-60 text-cyan-700">Reserva de acessibilidade</p></div>
               </Button>
               <Button variant="outline" className={cn("w-full h-14 justify-start gap-4 rounded-2xl border-border hover:bg-muted font-bold", selectedSeatForEdit?.categoria === 'acompanhante' && "border-blue-600 bg-blue-50 ring-1 ring-blue-600")} onClick={() => handleUpdateSeatCategory('acompanhante')}>
                  <UserCheck className="w-5 h-5 text-blue-600" /> 
                  <div className="text-left"><p className="text-xs uppercase font-black">Acompanhante PCD</p><p className="text-[9px] font-medium opacity-60 text-blue-700">Lugar adjacente ao PCD</p></div>
               </Button>
               <Button variant="outline" className={cn("w-full h-14 justify-start gap-4 rounded-2xl border-border hover:bg-muted font-bold", selectedSeatForEdit?.categoria === 'obeso' && "border-orange-400 bg-orange-50 ring-1 ring-orange-400")} onClick={() => handleUpdateSeatCategory('obeso')}>
                  <Accessibility className="w-5 h-5 text-orange-500" /> 
                  <div className="text-left"><p className="text-xs uppercase font-black">Lugar para Obeso</p><p className="text-[9px] font-medium opacity-60 text-orange-700">Assento com largura especial</p></div>
               </Button>
            </div>
            <DialogFooter>
               <Button variant="ghost" className="w-full font-black uppercase text-[10px] tracking-widest opacity-40" onClick={() => setIsSeatEditorOpen(false)}>Cancelar Ajuste</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  )
}

function SectorEditGrid({ setor, eventoId, onSeatClick }: { setor: any, eventoId: string, onSeatClick: (seat: any) => void }) {
  const db = useFirestore()
  const assentosQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "events", eventoId, "setores", setor.id, "assentos"), orderBy("codigo", "asc"))
  }, [db, setor.id])

  const { data: assentos, loading } = useCollection<any>(assentosQuery)

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground opacity-20" /></div>

  // Ajustar colunas dinamicamente baseado na largura do bloco para o preview ficar proporcional
  const gridCols = setor.larguraGrade >= 8 ? "grid-cols-10" : setor.larguraGrade >= 4 ? "grid-cols-6" : "grid-cols-3";

  return (
    <div className={cn(
      "grid gap-1.5 p-3 bg-white rounded-2xl shadow-inner border border-border/40",
      gridCols
    )}>
       {assentos?.map((a: any) => (
         <button 
           key={a.id} 
           type="button"
           onClick={() => onSeatClick({ ...a, setorId: setor.id })}
           className={cn(
             "aspect-square rounded-[4px] flex items-center justify-center text-[7px] font-black transition-all hover:scale-125 hover:z-20",
             a.categoria === 'pcd' ? "bg-cyan-400 text-white shadow-sm" :
             a.categoria === 'acompanhante' ? "bg-blue-600 text-white shadow-sm" :
             a.categoria === 'obeso' ? "bg-orange-400 text-white shadow-sm" :
             "bg-white border-2 border-muted"
           )} 
           style={{ borderColor: (!a.categoria || a.categoria === 'comum') ? setor.cor : undefined }}
         >
           {setor.tipo === 'assentos' ? (a.codigo.slice(1)) : a.codigo}
         </button>
       ))}
    </div>
  )
}
