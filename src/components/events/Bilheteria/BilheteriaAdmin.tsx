"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { 
  Ticket, 
  Plus, 
  Trash2, 
  Sparkles, 
  Percent, 
  Clock, 
  ShieldCheck, 
  Layers, 
  Info,
  Calendar,
  Layers2
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"

export type BilheteriaMode = 'none' | 'free' | 'paid_single' | 'batches'

interface TicketType {
  id: string
  name: string
  price: number
  quantity: number
  requiresProof: boolean
  proofDescription: string
  poolId?: string 
  poolName?: string
  description: string
}

interface Batch {
  id: string
  name: string
  startDate: string
  endDate: string
  capacidadeInicial: number
  ticketTypes: TicketType[]
  isHalfPriceEnabled?: boolean
  halfPricePercent?: number
}

interface BilheteriaAdminProps {
  mode: BilheteriaMode
  onModeChange: (mode: BilheteriaMode) => void
  batches: Batch[]
  onBatchesChange: (batches: Batch[]) => void
  totalCapacity: number
  onTotalCapacityChange: (cap: number) => void
}

export function BilheteriaAdmin({ 
  mode, 
  onModeChange, 
  batches, 
  onBatchesChange, 
  totalCapacity, 
  onTotalCapacityChange 
}: BilheteriaAdminProps) {
  const [isHalfPriceModalOpen, setIsHalfPriceModalOpen] = React.useState(false)
  const [activeBatchIdx, setActiveBatchIdx] = React.useState<number | null>(null)
  const [halfPercent, setHalfPercent] = React.useState(40)

  // Sincroniza o primeiro lote se estiver vazio para os modos simplificados
  React.useEffect(() => {
    if (batches.length === 0 && mode !== 'none') {
      const defaultBatch: Batch = {
        id: crypto.randomUUID(),
        name: "Lote Único",
        startDate: "",
        endDate: "",
        capacidadeInicial: totalCapacity,
        ticketTypes: [
          { 
            id: crypto.randomUUID(), 
            name: mode === 'free' ? "Ingresso Gratuito" : "Inteira", 
            price: 0, 
            quantity: totalCapacity, 
            requiresProof: false, 
            proofDescription: "", 
            description: "" 
          }
        ]
      }
      onBatchesChange([defaultBatch])
    }
  }, [mode, batches.length, totalCapacity, onBatchesChange])

  const handleAddBatch = () => {
    const newBatch: Batch = {
      id: crypto.randomUUID(),
      name: `Lote ${batches.length + 1}`,
      startDate: "",
      endDate: "",
      capacidadeInicial: 100,
      ticketTypes: [
        { id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, proofDescription: "", description: "" }
      ]
    }
    onBatchesChange([...batches, newBatch])
  }

  const handleRemoveBatch = (idx: number) => {
    onBatchesChange(batches.filter((_, i) => i !== idx))
  }

  const handleUpdateBatch = (idx: number, field: string, value: any) => {
    const newBatches = [...batches]
    newBatches[idx] = { ...newBatches[idx], [field]: value }
    
    if (field === 'capacidadeInicial') {
      const cap = parseInt(value) || 0
      const batch = newBatches[idx]
      
      // Recalcular estoques se houver pool
      const poolTickets = batch.ticketTypes.filter(t => t.poolId)
      if (poolTickets.length > 0 && batch.halfPricePercent) {
        const hQty = Math.floor(cap * (batch.halfPricePercent / 100))
        const iQty = cap - hQty
        batch.ticketTypes[0].quantity = iQty
        poolTickets.forEach(t => t.quantity = hQty)
      } else if (batch.ticketTypes.length === 1) {
        batch.ticketTypes[0].quantity = cap
      }
    }
    onBatchesChange(newBatches)
  }

  const handleAddTicketType = (bIdx: number) => {
    const newBatches = [...batches]
    const batch = newBatches[bIdx]
    batch.ticketTypes.push({
      id: crypto.randomUUID(),
      name: "Nova Categoria",
      price: 0,
      quantity: batch.capacidadeInicial,
      requiresProof: false,
      proofDescription: "",
      description: ""
    })
    onBatchesChange(newBatches)
  }

  const handleUpdateTicketType = (bIdx: number, tIdx: number, field: string, value: any) => {
    const newBatches = [...batches]
    newBatches[bIdx].ticketTypes[tIdx] = { ...newBatches[bIdx].ticketTypes[tIdx], [field]: value }
    onBatchesChange(newBatches)
  }

  const togglePool = (bIdx: number, tIdx: number) => {
    const newBatches = [...batches]
    const batch = newBatches[bIdx]
    const ticket = batch.ticketTypes[tIdx]

    if (ticket.poolId) {
      ticket.poolId = undefined
      ticket.poolName = undefined
      ticket.quantity = batch.capacidadeInicial
    } else {
      // Encontrar ou criar um pool para este lote
      const existingPool = batch.ticketTypes.find(t => t.poolId)
      ticket.poolId = existingPool?.poolId || crypto.randomUUID()
      ticket.poolName = existingPool?.poolName || "Estoque Compartilhado"
      ticket.quantity = existingPool?.quantity || Math.floor(batch.capacidadeInicial * 0.4)
    }
    onBatchesChange(newBatches)
  }

  const handleApplyHalfPrice = () => {
    if (activeBatchIdx === null) return
    const newBatches = [...batches]
    const batch = newBatches[activeBatchIdx]
    const poolId = crypto.randomUUID()
    const hQty = Math.floor(batch.capacidadeInicial * (halfPercent / 100))
    const iQty = batch.capacidadeInicial - hQty

    batch.isHalfPriceEnabled = true
    batch.halfPricePercent = halfPercent
    batch.ticketTypes[0].quantity = iQty

    const meias = [
      { id: crypto.randomUUID(), name: "Meia Estudante", price: (batch.ticketTypes[0].price / 2) || 0, quantity: hQty, poolId, poolName: "Cota Meia-Entrada", requiresProof: true, proofDescription: "Apresentar carteira de estudante válida.", description: "" },
      { id: crypto.randomUUID(), name: "Meia Idoso", price: (batch.ticketTypes[0].price / 2) || 0, quantity: hQty, poolId, poolName: "Cota Meia-Entrada", requiresProof: true, proofDescription: "Documento oficial provando +60 anos.", description: "" },
      { id: crypto.randomUUID(), name: "Meia PCD", price: (batch.ticketTypes[0].price / 2) || 0, quantity: hQty, poolId, poolName: "Cota Meia-Entrada", requiresProof: true, proofDescription: "Laudo médico ou cartão PCD.", description: "" }
    ]

    batch.ticketTypes = [batch.ticketTypes[0], ...meias]
    onBatchesChange(newBatches)
    setIsHalfPriceModalOpen(false)
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="bg-muted/30 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                <Ticket className="w-5 h-5 text-secondary" /> Bilheteria Viby
              </CardTitle>
              <CardDescription className="font-medium">Gestão inteligente de ingressos e estoques.</CardDescription>
            </div>
            <div className="bg-white p-1 rounded-xl border flex flex-wrap gap-1">
              {[
                { id: 'none', label: 'Sem Venda' },
                { id: 'free', label: 'Grátis' },
                { id: 'paid_single', label: 'Único' },
                { id: 'batches', label: 'Lotes' }
              ].map((m) => (
                <button 
                  key={m.id} 
                  type="button" 
                  className={cn(
                    "rounded-lg text-[9px] font-black uppercase px-4 h-8 transition-all",
                    mode === m.id ? "bg-secondary text-white shadow-md" : "text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => onModeChange(m.id as BilheteriaMode)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          {mode === 'none' ? (
            <div className="py-12 text-center space-y-4">
              <Info className="w-12 h-12 mx-auto text-muted-foreground opacity-20" />
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest italic">Nenhuma venda será processada neste evento.</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-col items-center gap-4 text-center max-w-xs mx-auto">
                 <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Capacidade de Público</Label>
                 <Input 
                   type="number" 
                   value={totalCapacity} 
                   onChange={(e) => onTotalCapacityChange(parseInt(e.target.value) || 0)}
                   className="h-16 text-4xl font-black rounded-2xl text-center border-secondary/20 shadow-inner" 
                 />
              </div>

              <div className="space-y-6">
                {batches.map((batch, bIdx) => (
                  <Card key={batch.id} className="border-2 border-border/60 rounded-[2rem] bg-white overflow-hidden relative shadow-sm">
                    <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between py-4">
                       <div className="flex items-center gap-3">
                          <div className="p-2 bg-secondary/10 rounded-xl text-secondary"><Layers className="w-4 h-4" /></div>
                          <Input 
                            value={batch.name} 
                            onChange={(e) => handleUpdateBatch(bIdx, 'name', e.target.value)}
                            className="h-8 p-0 border-none bg-transparent font-black italic uppercase text-lg text-primary focus-visible:ring-0 w-48" 
                          />
                       </div>
                       <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase gap-1.5 border-secondary text-secondary" onClick={() => { setActiveBatchIdx(bIdx); setIsHalfPriceModalOpen(true); }}>
                             <Sparkles className="w-3 h-3" /> Gerar Meia
                          </Button>
                          {mode === 'batches' && batches.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-full" onClick={() => handleRemoveBatch(bIdx)}>
                               <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                       </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase opacity-60">Qtd do Lote</Label>
                             <Input type="number" value={batch.capacidadeInicial} onChange={(e) => handleUpdateBatch(bIdx, 'capacidadeInicial', e.target.value)} className="rounded-xl h-11 font-black" />
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Vendas Iniciam</Label>
                             <Input type="datetime-local" value={batch.startDate} onChange={(e) => handleUpdateBatch(bIdx, 'startDate', e.target.value)} className="rounded-xl h-11 text-[10px]" />
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Vendas Encerram</Label>
                             <Input type="datetime-local" value={batch.endDate} onChange={(e) => handleUpdateBatch(bIdx, 'endDate', e.target.value)} className="rounded-xl h-11 text-[10px]" />
                          </div>
                       </div>

                       <div className="space-y-4 pt-4 border-t border-dashed">
                          <div className="flex items-center justify-between">
                             <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categorias de Ingressos</h4>
                             <Button type="button" variant="ghost" size="sm" className="text-secondary font-black text-[9px] uppercase gap-1" onClick={() => handleAddTicketType(bIdx)}>
                                <Plus className="w-3 h-3" /> Nova Categoria
                             </Button>
                          </div>
                          
                          <div className="space-y-4">
                             {batch.ticketTypes.map((type: any, tIdx: number) => (
                               <div key={type.id} className={cn(
                                 "p-6 bg-muted/20 rounded-2xl border transition-all",
                                 type.poolId ? "border-secondary/30 ring-1 ring-secondary/5" : "border-border/60"
                               )}>
                                  <div className="flex flex-col lg:flex-row gap-6 lg:items-end">
                                    <div className="flex-1 space-y-2">
                                       <div className="flex items-center justify-between">
                                          <Label className="text-[8px] uppercase font-black opacity-40">Identificação do Ingresso</Label>
                                          <div className="flex items-center gap-2">
                                             <span className="text-[8px] font-black uppercase opacity-40">Estoque Compartilhado?</span>
                                             <Switch checked={!!type.poolId} onCheckedChange={() => togglePool(bIdx, tIdx)} className="scale-75 origin-right" />
                                          </div>
                                       </div>
                                       <Input value={type.name} onChange={(e) => handleUpdateTicketType(bIdx, tIdx, 'name', e.target.value)} className="h-11 rounded-xl font-bold bg-white" />
                                    </div>

                                    <div className="w-full lg:w-32 space-y-2">
                                       <Label className="text-[8px] uppercase font-black opacity-40">Valor (R$)</Label>
                                       <Input type="number" step="0.01" value={type.price} onChange={(e) => handleUpdateTicketType(bIdx, tIdx, 'price', parseFloat(e.target.value) || 0)} className="h-11 rounded-xl font-black text-secondary bg-white" />
                                    </div>

                                    <div className="w-full lg:w-32 space-y-2">
                                       <Label className="text-[8px] uppercase font-black opacity-40">Quantidade</Label>
                                       <div className="relative">
                                          <Input 
                                            type="number" 
                                            value={type.quantity} 
                                            onChange={(e) => !type.poolId && handleUpdateTicketType(bIdx, tIdx, 'quantity', parseInt(e.target.value) || 0)} 
                                            disabled={!!type.poolId}
                                            className={cn("h-11 rounded-xl font-black bg-white", type.poolId && "bg-muted/50 text-secondary pr-8")} 
                                          />
                                          {type.poolId && <Layers2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/40" />}
                                       </div>
                                    </div>

                                    <div className="flex items-end gap-3 pb-1">
                                       <div className="flex flex-col items-center gap-1">
                                          <Label className="text-[7px] uppercase font-black opacity-40">Doc. Obrigatorio</Label>
                                          <Switch checked={type.requiresProof} onCheckedChange={(v) => handleUpdateTicketType(bIdx, tIdx, 'requiresProof', v)} />
                                       </div>
                                       <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-destructive rounded-xl hover:bg-red-50" onClick={() => {
                                         const n = [...batches]; n[bIdx].ticketTypes.splice(tIdx, 1); onBatchesChange(n);
                                       }}><Trash2 className="w-5 h-5" /></Button>
                                    </div>
                                  </div>

                                  {type.poolId && (
                                    <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-secondary/5 rounded-xl border border-secondary/10 w-fit animate-in zoom-in-95">
                                       <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
                                       <span className="text-[9px] font-black uppercase text-secondary">Vínculo: {type.poolName}</span>
                                    </div>
                                  )}

                                  {type.requiresProof && (
                                    <div className="mt-4 space-y-2 animate-in slide-in-from-top-2">
                                       <Label className="text-[8px] font-black uppercase text-orange-600 ml-1">Regra do Documento</Label>
                                       <Input 
                                         value={type.proofDescription} 
                                         onChange={e => handleUpdateTicketType(bIdx, tIdx, 'proofDescription', e.target.value)}
                                         placeholder="Ex: 'Necessário 1kg de alimento' ou 'Apresentar vínculo escolar'" 
                                         className="h-10 rounded-xl text-xs bg-orange-50 border-orange-200" 
                                       />
                                    </div>
                                  )}
                               </div>
                             ))}
                          </div>
                       </div>
                    </CardContent>
                  </Card>
                ))}

                {mode === 'batches' && (
                  <Button type="button" variant="outline" className="w-full h-16 rounded-[1.5rem] border-2 border-dashed font-black uppercase italic gap-2 hover:bg-muted" onClick={handleAddBatch}>
                    <Plus className="w-5 h-5" /> Adicionar Próximo Lote
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isHalfPriceModalOpen} onOpenChange={setIsHalfPriceModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-sm">
           <DialogHeader>
              <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center mb-2 mx-auto text-secondary shadow-inner">
                 <Percent className="w-8 h-8" />
              </div>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center">Cota Reservada</DialogTitle>
              <DialogDescription className="text-center font-medium">Defina a porcentagem da capacidade do lote que será compartilhada entre as meias-entradas.</DialogDescription>
           </DialogHeader>
           <div className="py-6 space-y-6">
              <div className="relative">
                 <Input 
                   type="number" 
                   value={halfPercent} 
                   onChange={e => setHalfPercent(parseInt(e.target.value) || 0)} 
                   className="h-20 text-5xl font-black text-center rounded-[2rem] border-secondary/20 shadow-lg" 
                 />
                 <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-black text-muted-foreground opacity-20">%</span>
              </div>
              <div className="p-4 bg-muted/50 rounded-2xl flex gap-3">
                 <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                 <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase">O sistema criará as categorias Estudante, Idoso e PCD compartilhando o mesmo estoque em pool.</p>
              </div>
           </div>
           <DialogFooter>
             <Button onClick={handleApplyHalfPrice} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">Gerar Estrutura de Lote</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
