
"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { 
  Ticket, 
  Plus, 
  Trash2, 
  Sparkles, 
  Percent, 
  FileText, 
  Clock, 
  ShieldCheck, 
  Layers, 
  ArrowDown, 
  Info,
  Copy,
  ChevronDown,
  ChevronUp
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

export type BilheteriaMode = 'none' | 'free' | 'paid_single' | 'batches' | 'sector_batches'

interface BilheteriaAdminProps {
  mode: BilheteriaMode
  onModeChange: (mode: BilheteriaMode) => void
  batches: any[]
  onBatchesChange: (batches: any[]) => void
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

  const handleAddBatch = () => {
    const newBatch = {
      id: crypto.randomUUID(),
      name: `Lote ${batches.length + 1}`,
      startDate: "",
      endDate: "",
      capacidadeInicial: 100,
      capacidadeAtual: 100,
      vendidos: 0,
      restantes: 100,
      ticketTypes: [
        { id: crypto.randomUUID(), name: "Inteira", price: 100, quantity: 100, requiresProof: false, description: "" }
      ],
      isHalfPriceEnabled: false,
      halfPricePercent: 40
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
      newBatches[idx].capacidadeAtual = cap
      newBatches[idx].restantes = cap
      // Atualizar quantidades dos tipos proporcionalmente se meia ativa
      if (newBatches[idx].isHalfPriceEnabled) {
        const hPercent = newBatches[idx].halfPricePercent || 40
        const hQty = Math.floor(cap * (hPercent / 100))
        const iQty = cap - hQty
        newBatches[idx].ticketTypes[0].quantity = iQty
        for (let i = 1; i < newBatches[idx].ticketTypes.length; i++) {
          newBatches[idx].ticketTypes[i].quantity = hQty
        }
      } else {
        newBatches[idx].ticketTypes[0].quantity = cap
      }
    }
    onBatchesChange(newBatches)
  }

  const handleAddTicketType = (bIdx: number) => {
    const newBatches = [...batches]
    const poolId = newBatches[bIdx].isHalfPriceEnabled ? (newBatches[bIdx].ticketTypes[1]?.poolId || crypto.randomUUID()) : undefined
    newBatches[bIdx].ticketTypes.push({
      id: crypto.randomUUID(),
      name: "Nova Categoria",
      price: 50,
      quantity: newBatches[bIdx].isHalfPriceEnabled ? (newBatches[bIdx].ticketTypes[1]?.quantity || 0) : newBatches[bIdx].capacidadeInicial,
      requiresProof: true,
      poolId,
      description: ""
    })
    onBatchesChange(newBatches)
  }

  const handleUpdateTicketType = (bIdx: number, tIdx: number, field: string, value: any) => {
    const newBatches = [...batches]
    newBatches[bIdx].ticketTypes[tIdx] = { ...newBatches[bIdx].ticketTypes[tIdx], [field]: value }
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
      { id: crypto.randomUUID(), name: "Meia Estudante", price: batch.ticketTypes[0].price / 2, quantity: hQty, poolId, requiresProof: true, description: "Necessário documento estudantil válido." },
      { id: crypto.randomUUID(), name: "Meia Idoso", price: batch.ticketTypes[0].price / 2, quantity: hQty, poolId, requiresProof: true, description: "Para maiores de 60 anos." },
      { id: crypto.randomUUID(), name: "Meia PCD", price: batch.ticketTypes[0].price / 2, quantity: hQty, poolId, requiresProof: true, description: "Necessário laudo ou cartão benefício." }
    ]

    batch.ticketTypes = [batch.ticketTypes[0], ...meias]
    onBatchesChange(newBatches)
    setIsHalfPriceModalOpen(false)
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                <Ticket className="w-5 h-5 text-secondary" /> Bilheteria Viby
              </CardTitle>
              <CardDescription className="font-medium">Configuração avançada de ingressos e lotes.</CardDescription>
            </div>
            <div className="bg-white p-1 rounded-xl border flex flex-wrap gap-1">
              {[
                { id: 'none', label: 'Sem Ingressos' },
                { id: 'free', label: 'Grátis' },
                { id: 'paid_single', label: 'Único' },
                { id: 'batches', label: 'Lotes' },
                { id: 'sector_batches', label: 'Lote + Setor' }
              ].map((m) => (
                <Button 
                  key={m.id} 
                  type="button" 
                  variant={mode === m.id ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="rounded-lg text-[9px] font-black uppercase px-3 h-8"
                  onClick={() => onModeChange(m.id as BilheteriaMode)}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          {mode === 'none' && (
            <div className="py-12 text-center space-y-4">
              <Info className="w-12 h-12 mx-auto text-muted-foreground opacity-20" />
              <p className="text-sm font-bold text-muted-foreground uppercase">Evento Informativo. Sem venda de ingressos na plataforma.</p>
            </div>
          )}

          {(mode === 'free' || mode === 'paid_single' || mode === 'batches' || mode === 'sector_batches') && (
            <div className="space-y-8">
              <div className="p-8 bg-muted/20 rounded-[2.5rem] border-2 border-dashed border-border flex flex-col items-center gap-4 text-center">
                 <Label className="text-sm font-black uppercase tracking-widest text-primary">Capacidade Total de Público</Label>
                 <Input 
                   type="number" 
                   value={totalCapacity} 
                   onChange={(e) => onTotalCapacityChange(parseInt(e.target.value) || 0)}
                   className="h-16 text-4xl font-black rounded-2xl text-center border-secondary/20 max-w-[250px] bg-white shadow-inner" 
                 />
              </div>

              <div className="space-y-6">
                {batches.map((batch, bIdx) => (
                  <Card key={batch.id} className="border-2 border-border/60 rounded-[2rem] bg-white overflow-hidden relative group">
                    <CardHeader className="bg-muted/10 border-b pb-6 flex flex-row items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-secondary/10 rounded-xl text-secondary"><Layers className="w-5 h-5" /></div>
                          <div className="space-y-0.5">
                             <Input 
                               value={batch.name} 
                               onChange={(e) => handleUpdateBatch(bIdx, 'name', e.target.value)}
                               className="h-7 p-0 border-none bg-transparent font-black italic uppercase text-lg text-primary focus-visible:ring-0" 
                             />
                             <p className="text-[9px] font-bold text-muted-foreground uppercase">{batch.ticketTypes.length} Categorias configuradas</p>
                          </div>
                       </div>
                       <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase gap-1.5 border-secondary text-secondary" onClick={() => { setActiveBatchIdx(bIdx); setIsHalfPriceModalOpen(true); }}>
                             <Sparkles className="w-3 h-3" /> Gerar Meia
                          </Button>
                          {batches.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-full hover:bg-red-50" onClick={() => handleRemoveBatch(bIdx)}>
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
                             <Label className="text-[10px] font-black uppercase opacity-60">Início das Vendas</Label>
                             <Input type="datetime-local" value={batch.startDate} onChange={(e) => handleUpdateBatch(bIdx, 'startDate', e.target.value)} className="rounded-xl h-11 text-[10px]" />
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase opacity-60">Fim das Vendas</Label>
                             <Input type="datetime-local" value={batch.endDate} onChange={(e) => handleUpdateBatch(bIdx, 'endDate', e.target.value)} className="rounded-xl h-11 text-[10px]" />
                          </div>
                       </div>

                       <div className="space-y-4 pt-4 border-t border-dashed">
                          <div className="flex items-center justify-between px-1">
                             <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Ticket className="w-3.5 h-3.5" /> Ingressos neste Lote</h4>
                             <Button type="button" variant="ghost" size="sm" className="text-secondary font-black text-[9px] uppercase gap-1" onClick={() => handleAddTicketType(bIdx)}>
                                <Plus className="w-3 h-3" /> Add Categoria
                             </Button>
                          </div>
                          
                          <div className="space-y-3">
                             {batch.ticketTypes.map((type: any, tIdx: number) => (
                               <div key={type.id} className="p-4 bg-muted/20 rounded-2xl border flex flex-col sm:flex-row sm:items-end gap-4">
                                  <div className="flex-1 space-y-2">
                                     <Label className="text-[8px] uppercase font-black opacity-40">Título do Ingresso</Label>
                                     <Input value={type.name} onChange={(e) => handleUpdateTicketType(bIdx, tIdx, 'name', e.target.value)} className="h-9 rounded-xl font-bold bg-white" />
                                  </div>
                                  <div className="w-24 space-y-2">
                                     <Label className="text-[8px] uppercase font-black opacity-40">Valor (R$)</Label>
                                     <Input type="number" step="0.01" value={type.price} onChange={(e) => handleUpdateTicketType(bIdx, tIdx, 'price', parseFloat(e.target.value) || 0)} className="h-9 rounded-xl font-black text-secondary bg-white" />
                                  </div>
                                  {type.poolId && (
                                    <div className="w-24 space-y-2">
                                       <Label className="text-[8px] uppercase font-black opacity-40">Estoque Pool</Label>
                                       <div className="h-9 flex items-center justify-center font-black text-[10px] bg-secondary/10 text-secondary rounded-xl">{type.quantity}</div>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-4 px-2 pb-2">
                                     <div className="flex flex-col items-center gap-1">
                                        <Label className="text-[7px] uppercase font-black opacity-40">Doc.</Label>
                                        <Switch checked={type.requiresProof} onCheckedChange={(v) => handleUpdateTicketType(bIdx, tIdx, 'requiresProof', v)} />
                                     </div>
                                     {tIdx > 0 && (
                                       <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-full" onClick={() => {
                                         const n = [...batches]; n[bIdx].ticketTypes.splice(tIdx, 1); onBatchesChange(n);
                                       }}><Trash2 className="w-3.5 h-3.5" /></Button>
                                     )}
                                  </div>
                               </div>
                             ))}
                          </div>
                       </div>
                    </CardContent>
                  </Card>
                ))}

                {mode === 'batches' && (
                  <Button type="button" variant="outline" className="w-full h-14 rounded-2xl border-dashed font-black uppercase italic gap-2" onClick={handleAddBatch}>
                    <Plus className="w-5 h-5" /> Adicionar Novo Lote
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isHalfPriceModalOpen} onOpenChange={setIsHalfPriceModalOpen}>
        <DialogContent className="max-w-sm rounded-[2.5rem]">
           <DialogHeader>
              <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center mb-2 mx-auto text-secondary">
                 <Percent className="w-6 h-6" />
              </div>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center">Meia-Entrada Automática</DialogTitle>
              <DialogDescription className="text-center font-medium">Defina a porcentagem da cota de meia-entrada para este lote.</DialogDescription>
           </DialogHeader>
           <div className="py-6 space-y-6">
              <div className="relative">
                 <Input type="number" value={halfPercent} onChange={e => setHalfPercent(parseInt(e.target.value) || 0)} className="h-20 text-5xl font-black text-center rounded-[1.5rem] border-secondary/20" />
                 <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-black text-muted-foreground opacity-30">%</span>
              </div>
              <div className="p-4 bg-muted/50 rounded-2xl flex gap-3">
                 <ShieldCheck className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                 <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase">O sistema criará automaticamente as categorias Estudante, Idoso e PCD compartilhando este estoque.</p>
              </div>
           </div>
           <DialogFooter>
             <Button onClick={handleApplyHalfPrice} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">Configurar Cota</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
