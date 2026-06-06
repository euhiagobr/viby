
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
  Layers2,
  Copy,
  ChevronRight,
  Zap,
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  Coins
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
import { useCurrency } from "@/contexts/CurrencyContext"

export type BilheteriaMode = 'none' | 'free' | 'paid_single' | 'batches'

interface TicketType {
  id: string
  name: string
  price: number
  quantity: number
  requiresProof: boolean
  proofDescription: string
  poolId?: string | null
  poolName?: string | null
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
  const { currency } = useCurrency();
  const [isHalfPriceModalOpen, setIsHalfPriceModalOpen] = React.useState(false)
  const [isBatchGenModalOpen, setIsBatchGenModalOpen] = React.useState(false)
  const [activeBatchIdx, setActiveBatchIdx] = React.useState<number | null>(null)
  const [halfPercent, setHalfPercent] = React.useState(40)
  
  // Estados para Escalonamento de Lotes
  const [batchGenStep, setBatchGenStep] = React.useState<'count' | 'prices'>('count')
  const [numNewBatchesInput, setNumNewBatchesInput] = React.useState("1")
  const [cloneLastConfig, setCloneLastConfig] = React.useState(true)
  const [newBatchPrices, setNewBatchPrices] = React.useState<Record<number, string>>({})

  const currencySymbol = currency === 'BRL' ? 'R$' : currency === 'USD' ? '$' : '€';

  React.useEffect(() => {
    if (batches.length === 0 && mode !== 'none') {
      const defaultBatch: Batch = {
        id: crypto.randomUUID(),
        name: "1º Lote",
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
            poolId: null,
            poolName: null,
            description: "" 
          }
        ]
      }
      onBatchesChange([defaultBatch])
    }
  }, [mode, batches.length, totalCapacity, onBatchesChange])

  const handleOpenBatchGen = () => {
    setBatchGenStep('count')
    setNumNewBatchesInput("1")
    setNewBatchPrices({})
    setIsBatchGenModalOpen(true)
  }

  const handleGoToPrices = () => {
    const n = parseInt(numNewBatchesInput) || 0
    if (n <= 0) return
    
    const lastBatch = batches[batches.length - 1]
    const basePrice = lastBatch?.ticketTypes[0]?.price || 0
    const initialPrices: Record<number, string> = {}
    
    for (let i = 0; i < n; i++) {
      initialPrices[i] = basePrice.toString()
    }
    
    setNewBatchPrices(initialPrices)
    setBatchGenStep('prices')
  }

  const handleGenerateBatches = () => {
    const n = parseInt(numNewBatchesInput) || 0
    const lastBatch = batches[batches.length - 1]
    const newBatchesList = [...batches]
    
    let lastEndDate = lastBatch?.endDate ? new Date(lastBatch.endDate) : new Date()
    let durationMs = 0
    
    if (lastBatch?.startDate && lastBatch?.endDate) {
      durationMs = new Date(lastBatch.endDate).getTime() - new Date(lastBatch.startDate).getTime()
    } else {
      durationMs = 30 * 24 * 60 * 60 * 1000
    }

    for (let i = 0; i < n; i++) {
      const batchNum = newBatchesList.length + 1
      const start = new Date(lastEndDate)
      const end = new Date(start.getTime() + durationMs)
      const batchBasePrice = parseFloat(newBatchPrices[i]) || 0
      
      const newBatch: Batch = {
        id: crypto.randomUUID(),
        name: `${batchNum}º Lote`,
        startDate: start.toISOString().slice(0, 16),
        endDate: end.toISOString().slice(0, 16),
        capacidadeInicial: cloneLastConfig ? (lastBatch?.capacidadeInicial || 100) : 100,
        ticketTypes: cloneLastConfig ? lastBatch.ticketTypes.map((t, tIdx) => {
          let p = t.price
          if (tIdx === 0) {
            p = batchBasePrice
          } else if (t.poolId || t.name.toLowerCase().includes('meia')) {
            p = batchBasePrice / 2
          }

          return {
            ...t,
            id: crypto.randomUUID(),
            price: p,
            poolId: t.poolId ? crypto.randomUUID() : null,
            poolName: t.poolName || null
          }
        }) : [
          { id: crypto.randomUUID(), name: "Inteira", price: batchBasePrice, quantity: 100, requiresProof: false, proofDescription: "", poolId: null, poolName: null, description: "" }
        ]
      }
      
      newBatchesList.push(newBatch)
      lastEndDate = end
    }

    onBatchesChange(newBatchesList)
    setIsBatchGenModalOpen(false)
    
    const newTotal = newBatchesList.reduce((acc, b) => acc + b.capacidadeInicial, 0)
    onTotalCapacityChange(newTotal)
  }

  const handleRemoveBatch = (idx: number) => {
    const newList = batches.filter((_, i) => i !== idx)
    onBatchesChange(newList)
    onTotalCapacityChange(newList.reduce((acc, b) => acc + b.capacidadeInicial, 0))
  }

  const handleUpdateBatch = (idx: number, field: string, value: any) => {
    const newBatches = [...batches]
    newBatches[idx] = { ...newBatches[idx], [field]: value }
    
    if (field === 'capacidadeInicial') {
      const cap = parseInt(value) || 0
      const batch = newBatches[idx]
      
      const poolTickets = batch.ticketTypes.filter(t => !!t.poolId)
      if (poolTickets.length > 0 && batch.halfPricePercent) {
        const hQty = Math.floor(cap * (batch.halfPricePercent / 100))
        const iQty = cap - hQty
        batch.ticketTypes[0].quantity = iQty
        poolTickets.forEach(t => t.quantity = hQty)
      } else if (batch.ticketTypes.length === 1) {
        batch.ticketTypes[0].quantity = cap
      }
      
      onTotalCapacityChange(newBatches.reduce((acc, b) => acc + b.capacidadeInicial, 0))
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
      poolId: null,
      poolName: null,
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
      ticket.poolId = null
      ticket.poolName = null
      ticket.quantity = batch.capacidadeInicial
    } else {
      const existingPool = batch.ticketTypes.find(t => !!t.poolId)
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
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2 text-primary">
                <Ticket className="w-5 h-5 text-secondary" /> Bilheteria Viby
              </CardTitle>
              <CardDescription className="font-medium">Gestão inteligente de ingressos e estoques.</CardDescription>
            </div>
            <div className="bg-white p-1 rounded-xl border flex flex-wrap gap-1 shadow-sm">
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
                 <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Capacidade Total do Evento</Label>
                 <Input 
                   type="number" 
                   value={totalCapacity} 
                   onChange={(e) => onTotalCapacityChange(parseInt(e.target.value) || 0)}
                   className="h-16 text-4xl font-black rounded-2xl text-center border-secondary/20 shadow-inner bg-muted/20" 
                 />
                 <p className="text-[8px] font-black uppercase text-muted-foreground">Soma de todos os lotes e setores configurados</p>
              </div>

              {mode !== 'free' && (
                <div className="p-4 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/10 flex items-center justify-center gap-3">
                   <Coins className="w-5 h-5 text-primary" />
                   <p className="text-xs font-black uppercase italic text-primary">Preços em: <span className="text-secondary">{currency}</span></p>
                </div>
              )}

              <div className="space-y-10">
                {batches.map((batch, bIdx) => (
                  <div key={batch.id} className="relative">
                    {bIdx > 0 && (
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
                         <div className="h-6 w-px bg-border border-dashed" />
                         <Badge variant="outline" className="text-[8px] font-black uppercase border-dashed">Migração de Sobras Automática</Badge>
                      </div>
                    )}
                    <Card className="border-2 border-border/60 rounded-[2.5rem] bg-white overflow-hidden shadow-sm relative group/batch">
                      <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between py-4 px-8">
                         <div className="flex items-center gap-3">
                            <div className="p-2 bg-secondary/10 rounded-xl text-secondary"><Layers className="w-4 h-4" /></div>
                            <Input 
                              value={batch.name} 
                              onChange={(e) => handleUpdateBatch(bIdx, 'name', e.target.value)}
                              className="h-8 p-0 border-none bg-transparent font-black italic uppercase text-lg text-primary focus-visible:ring-0 w-48" 
                            />
                         </div>
                         <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase gap-1.5 border-secondary text-secondary hover:bg-secondary/5" onClick={() => { setActiveBatchIdx(bIdx); setIsHalfPriceModalOpen(true); }}>
                               <Sparkles className="w-3 h-3" /> Gerar Meia
                            </Button>
                            {mode === 'batches' && batches.length > 1 && (
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-full hover:bg-red-50" onClick={() => handleRemoveBatch(bIdx)}>
                                 <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                         </div>
                      </CardHeader>
                      <CardContent className="p-8 space-y-8">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                               <Label className="text-[10px] font-black uppercase opacity-60">Ingressos deste Lote</Label>
                               <Input type="number" value={batch.capacidadeInicial} onChange={(e) => handleUpdateBatch(bIdx, 'capacidadeInicial', e.target.value)} className="rounded-xl h-12 font-black text-lg bg-muted/10" />
                            </div>
                            <div className="space-y-2">
                               <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-secondary" /> Vendas Iniciam</Label>
                               <Input type="datetime-local" value={batch.startDate} onChange={(e) => handleUpdateBatch(bIdx, 'startDate', e.target.value)} className="rounded-xl h-12 text-xs font-bold" />
                            </div>
                            <div className="space-y-2">
                               <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-secondary" /> Vendas Encerram</Label>
                               <Input type="datetime-local" value={batch.endDate} onChange={(e) => handleUpdateBatch(bIdx, 'endDate', e.target.value)} className="rounded-xl h-12 text-xs font-bold" />
                            </div>
                         </div>

                         <div className="space-y-4 pt-4 border-t border-dashed">
                            <div className="flex items-center justify-between px-2">
                               <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                 <Ticket className="w-3 h-3" /> Categorias de Ingressos
                               </h4>
                               <Button type="button" variant="ghost" size="sm" className="text-secondary font-black text-[9px] uppercase gap-1.5 hover:bg-secondary/5 rounded-lg h-8" onClick={() => handleAddTicketType(bIdx)}>
                                  <Plus className="w-3.5 h-3.5" /> Nova Categoria
                               </Button>
                            </div>
                            
                            <div className="space-y-4">
                               {batch.ticketTypes.map((type: any, tIdx: number) => (
                                 <div key={type.id} className={cn(
                                   "p-6 rounded-3xl border transition-all relative group/ticket",
                                   type.poolId ? "border-secondary/30 bg-secondary/[0.02] ring-1 ring-secondary/5" : "border-border/60 bg-muted/10"
                                 )}>
                                    <div className="flex flex-col lg:flex-row gap-6 lg:items-end">
                                      <div className="flex-1 space-y-2">
                                         <div className="flex items-center justify-between px-1">
                                            <Label className="text-[8px] uppercase font-black opacity-40">Identificação / Nome</Label>
                                            <div className="flex items-center gap-2">
                                               <span className={cn("text-[8px] font-black uppercase transition-colors", type.poolId ? "text-secondary" : "opacity-40")}>Estoque Compartilhado?</span>
                                               <Switch checked={!!type.poolId} onCheckedChange={() => togglePool(bIdx, tIdx)} className="scale-75 origin-right" />
                                            </div>
                                         </div>
                                         <Input value={type.name} onChange={(e) => handleUpdateTicketType(bIdx, tIdx, 'name', e.target.value)} className="h-11 rounded-xl font-bold bg-white" placeholder="Ex: Inteira, Meia, Solidário..." />
                                      </div>

                                      <div className="w-full lg:w-36 space-y-2">
                                         <Label className="text-[8px] uppercase font-black opacity-40 px-1">Valor ({currency})</Label>
                                         <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground opacity-40">{currencySymbol}</span>
                                            <Input type="number" step="0.01" value={type.price} onChange={(e) => handleUpdateTicketType(bIdx, tIdx, 'price', parseFloat(e.target.value) || 0)} className="h-11 rounded-xl font-black text-secondary bg-white pl-9" />
                                         </div>
                                      </div>

                                      <div className="w-full lg:w-32 space-y-2">
                                         <Label className="text-[8px] uppercase font-black opacity-40 px-1">Disponibilidade</Label>
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

                                      <div className="flex items-end gap-3 pb-0.5">
                                         <div className="flex flex-col items-center gap-1.5 p-1.5 bg-white/50 rounded-xl border border-dashed">
                                            <Label className="text-[7px] uppercase font-black opacity-40">Doc. Obrigatório</Label>
                                            <Switch checked={type.requiresProof} onCheckedChange={(v) => handleUpdateTicketType(bIdx, tIdx, 'requiresProof', v)} className="scale-75" />
                                         </div>
                                         <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-destructive rounded-xl hover:bg-red-50 opacity-0 group-hover/ticket:opacity-100 transition-opacity" onClick={() => {
                                           const n = [...batches]; n[bIdx].ticketTypes.splice(tIdx, 1); onBatchesChange(n);
                                         }}><Trash2 className="w-4 h-4" /></Button>
                                      </div>
                                    </div>

                                    {type.poolId && (
                                      <div className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-secondary/10 rounded-full border border-secondary/20 w-fit animate-in zoom-in-95">
                                         <ShieldCheck className="w-3 h-3 text-secondary" />
                                         <span className="text-[9px] font-black uppercase text-secondary">Vínculo: {type.poolName}</span>
                                      </div>
                                    )}

                                    {type.requiresProof && (
                                      <div className="mt-4 space-y-2 animate-in slide-in-from-top-2">
                                         <div className="flex items-center gap-2 ml-1 text-orange-600">
                                            <AlertCircle className="w-3 h-3" />
                                            <Label className="text-[8px] font-black uppercase">Instrução para o Comprador</Label>
                                         </div>
                                         <Input 
                                           value={type.proofDescription} 
                                           onChange={e => handleUpdateTicketType(bIdx, tIdx, 'proofDescription', e.target.value)}
                                           placeholder="Ex: 'Necessário 1kg de alimento' ou 'Apresentar vínculo escolar'" 
                                           className="h-10 rounded-xl text-xs bg-orange-50/50 border-orange-200" 
                                         />
                                      </div>
                                    )}
                                 </div>
                               ))}
                            </div>
                         </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}

                {mode === 'batches' && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full h-20 rounded-[2.5rem] border-2 border-dashed font-black uppercase italic gap-3 hover:bg-muted/50 hover:border-secondary/40 hover:text-secondary transition-all group" 
                    onClick={handleOpenBatchGen}
                  >
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center group-hover:bg-secondary group-hover:text-white transition-colors">
                       <Plus className="w-5 h-5" />
                    </div>
                    Configurar Próximos Lotes
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isBatchGenModalOpen} onOpenChange={setIsBatchGenModalOpen}>
         <DialogContent className="rounded-[2.5rem] max-w-sm">
            <DialogHeader>
               <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center mb-4 mx-auto text-secondary shadow-inner">
                  <Zap className="w-8 h-8 fill-secondary" />
               </div>
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center text-primary">Escalonar Lotes</DialogTitle>
               <DialogDescription className="text-center font-medium">Configure a progressão automática de vendas.</DialogDescription>
            </DialogHeader>

            {batchGenStep === 'count' ? (
              <div className="py-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase opacity-60">Quantos novos lotes criar?</Label>
                    <div className="flex gap-2 items-center">
                       <Input 
                         type="number" 
                         value={numNewBatchesInput} 
                         onChange={e => setNumNewBatchesInput(e.target.value)} 
                         className="h-12 text-xl font-black text-center rounded-xl border-secondary/20"
                       />
                       <div className="grid grid-cols-2 gap-1">
                          {[2, 3].map(n => (
                            <Button 
                              key={n} 
                              type="button" 
                              variant="outline" 
                              size="sm"
                              className="font-black h-8 rounded-lg text-[10px]"
                              onClick={() => setNumNewBatchesInput(n.toString())}
                            >
                              +{n}
                            </Button>
                          ))}
                       </div>
                    </div>
                 </div>

                 <div className="flex items-center justify-between p-5 bg-muted/30 rounded-2xl border border-dashed">
                    <div className="space-y-0.5">
                       <p className="font-bold text-xs">Clonar Estrutura?</p>
                       <p className="text-[9px] text-muted-foreground uppercase font-medium leading-tight">Mantém as categorias e pools do lote anterior.</p>
                    </div>
                    <Switch checked={cloneLastConfig} onCheckedChange={setCloneLastConfig} />
                 </div>

                 <Button 
                   onClick={handleGoToPrices} 
                   disabled={parseInt(numNewBatchesInput) <= 0}
                   className="w-full bg-primary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic gap-2"
                 >
                   Próximo Passo <ArrowRight className="w-4 h-4" />
                 </Button>
              </div>
            ) : (
              <div className="py-6 space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                 <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Defina os valores das Inteiras ({currency})</p>
                 
                 <div className="space-y-4 max-h-[300px] overflow-y-auto px-1 custom-scrollbar">
                    {Array.from({ length: parseInt(numNewBatchesInput) }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <Label className="text-[9px] font-black uppercase opacity-40 px-1">{batches.length + i + 1}º Lote (Inteira)</Label>
                        <div className="relative">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-secondary text-sm">{currencySymbol}</span>
                           <Input 
                             type="number" 
                             step="0.01" 
                             value={newBatchPrices[i] || "0"} 
                             onChange={e => setNewBatchPrices({...newBatchPrices, [i]: e.target.value})}
                             className="h-12 pl-12 text-lg font-black rounded-xl border-secondary/20"
                           />
                        </div>
                      </div>
                    ))}
                 </div>

                 <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setBatchGenStep('count')} className="rounded-xl font-bold uppercase text-[10px]"><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</Button>
                    <Button 
                      onClick={handleGenerateBatches} 
                      className="flex-1 bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic hover:scale-105 transition-transform"
                    >
                      Gerar Lotes agora
                    </Button>
                 </div>
              </div>
            )}
         </DialogContent>
      </Dialog>

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
                 <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase">O sistema criará as categorias Estudante, Idoso e PCD compartilhando o mesmo estoque em pool de 40% (padrão legal).</p>
              </div>
           </div>
           <DialogFooter>
             <Button onClick={handleApplyHalfPrice} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">Aplicar Cota de Meia</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
