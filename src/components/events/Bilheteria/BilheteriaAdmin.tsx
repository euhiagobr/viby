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
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"

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
  eventCurrency?: CurrencyCode
  onCurrencyChange?: (cur: CurrencyCode) => void
}

export function BilheteriaAdmin({ 
  mode, 
  onModeChange, 
  batches, 
  onBatchesChange, 
  totalCapacity, 
  onTotalCapacityChange,
  eventCurrency = 'BRL',
  onCurrencyChange
}: BilheteriaAdminProps) {
  const [isHalfPriceModalOpen, setIsHalfPriceModalOpen] = React.useState(false)
  const [isBatchGenModalOpen, setIsBatchGenModalOpen] = React.useState(false)
  const [activeBatchIdx, setActiveBatchIdx] = React.useState<number | null>(null)
  const [halfPercent, setHalfPercent] = React.useState(40)
  
  const [batchGenStep, setBatchGenStep] = React.useState<'count' | 'prices'>('count')
  const [numNewBatchesInput, setNumNewBatchesInput] = React.useState("1")
  const [cloneLastConfig, setCloneLastConfig] = React.useState(true)
  const [newBatchPrices, setNewBatchPrices] = React.useState<Record<number, string>>({})

  const currencySymbol = eventCurrency === 'BRL' ? 'R$' : eventCurrency === 'USD' ? '$' : '€';

  React.useEffect(() => {
    if (batches.length === 0 && mode !== 'none') {
      const defaultBatch: Batch = {
        id: crypto.randomUUID(),
        name: "1º Lote",
        startDate: "",
        endDate: "",
        capacidadeInicial: totalCapacity,
        ticketTypes: [
          { id: crypto.randomUUID(), name: mode === 'free' ? "Ingresso Gratuito" : "Inteira", price: 0, quantity: totalCapacity, requiresProof: false, proofDescription: "", poolId: null, poolName: null, description: "" }
        ]
      }
      onBatchesChange([defaultBatch])
    }
  }, [mode, batches.length, totalCapacity, onBatchesChange])

  const handleUpdateBatch = (idx: number, field: string, value: any) => {
    const newBatches = [...batches]
    newBatches[idx] = { ...newBatches[idx], [field]: value }
    if (field === 'capacidadeInicial') {
      onTotalCapacityChange(newBatches.reduce((acc, b) => acc + (parseInt(b.capacidadeInicial as any) || 0), 0))
    }
    onBatchesChange(newBatches)
  }

  const handleUpdateTicketType = (bIdx: number, tIdx: number, field: string, value: any) => {
    const newBatches = [...batches]
    newBatches[bIdx].ticketTypes[tIdx] = { ...newBatches[bIdx].ticketTypes[tIdx], [field]: value }
    onBatchesChange(newBatches)
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="bg-muted/30 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2 text-primary">
                <Ticket className="w-5 h-5 text-secondary" /> Bilheteria Viby
              </CardTitle>
              <CardDescription className="font-medium">Gestão inteligente de ingressos e moedas.</CardDescription>
            </div>
            <div className="flex items-center gap-4">
               {mode !== 'free' && mode !== 'none' && onCurrencyChange && (
                  <div className="space-y-1">
                    <Label className="text-[8px] font-black uppercase opacity-40 ml-1">Moeda Oficial</Label>
                    <Select value={eventCurrency} onValueChange={onCurrencyChange as any}>
                       <SelectTrigger className="h-9 rounded-xl text-[10px] font-black uppercase w-28 bg-white"><SelectValue /></SelectTrigger>
                       <SelectContent className="rounded-xl">
                          <SelectItem value="BRL">Real (BRL)</SelectItem>
                          <SelectItem value="USD">Dollar (USD)</SelectItem>
                          <SelectItem value="EUR">Euro (EUR)</SelectItem>
                       </SelectContent>
                    </Select>
                  </div>
               )}
               <div className="bg-white p-1 rounded-xl border flex flex-wrap gap-1 shadow-sm h-fit">
                  {[{ id: 'none', label: 'Sem Venda' }, { id: 'free', label: 'Grátis' }, { id: 'paid_single', label: 'Único' }, { id: 'batches', label: 'Lotes' }].map((m) => (
                    <button key={m.id} type="button" className={cn("rounded-lg text-[9px] font-black uppercase px-4 h-8 transition-all", mode === m.id ? "bg-secondary text-white shadow-md" : "text-muted-foreground hover:bg-muted")} onClick={() => onModeChange(m.id as BilheteriaMode)}>{m.label}</button>
                  ))}
               </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
           {mode !== 'none' && (
             <div className="space-y-8">
               <div className="flex flex-col items-center gap-4 text-center max-w-xs mx-auto">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Capacidade Total</Label>
                  <Input type="number" value={totalCapacity} onChange={(e) => onTotalCapacityChange(parseInt(e.target.value) || 0)} className="h-16 text-4xl font-black rounded-2xl text-center border-secondary/20 shadow-inner bg-muted/20" />
               </div>

               {batches.map((batch, bIdx) => (
                 <Card key={batch.id} className="border-2 border-border/60 rounded-[2.5rem] bg-white overflow-hidden shadow-sm relative group/batch">
                    <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between py-4 px-8">
                       <div className="flex items-center gap-3">
                          <Layers className="w-4 h-4 text-secondary" />
                          <Input value={batch.name} onChange={(e) => handleUpdateBatch(bIdx, 'name', e.target.value)} className="h-8 p-0 border-none bg-transparent font-black italic uppercase text-lg text-primary focus-visible:ring-0 w-48" />
                       </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase opacity-60">Ingressos deste Lote</Label>
                             <Input type="number" value={batch.capacidadeInicial} onChange={(e) => handleUpdateBatch(bIdx, 'capacidadeInicial', e.target.value)} className="rounded-xl h-11 font-black" />
                          </div>
                          <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Início</Label><Input type="datetime-local" value={batch.startDate} onChange={(e) => handleUpdateBatch(bIdx, 'startDate', e.target.value)} className="rounded-xl h-11 text-xs" /></div>
                          <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Fim</Label><Input type="datetime-local" value={batch.endDate} onChange={(e) => handleUpdateBatch(bIdx, 'endDate', e.target.value)} className="rounded-xl h-11 text-xs" /></div>
                       </div>

                       <div className="space-y-4 pt-4 border-t border-dashed">
                          {batch.ticketTypes.map((type: any, tIdx: number) => (
                            <div key={type.id} className="p-5 rounded-2xl border bg-muted/5">
                               <div className="flex flex-col lg:flex-row gap-6 lg:items-end">
                                  <div className="flex-1 space-y-2"><Label className="text-[8px] uppercase font-black opacity-40">Categoria</Label><Input value={type.name} onChange={(e) => handleUpdateTicketType(bIdx, tIdx, 'name', e.target.value)} className="h-11 rounded-xl font-bold bg-white" /></div>
                                  <div className="w-full lg:w-36 space-y-2">
                                     <Label className="text-[8px] uppercase font-black opacity-40">Preço ({eventCurrency})</Label>
                                     <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black opacity-30">{currencySymbol}</span>
                                        <Input type="number" step="0.01" value={type.price} onChange={(e) => handleUpdateTicketType(bIdx, tIdx, 'price', parseFloat(e.target.value) || 0)} className="h-11 rounded-xl font-black text-secondary bg-white pl-9" />
                                     </div>
                                  </div>
                               </div>
                            </div>
                          ))}
                       </div>
                    </CardContent>
                 </Card>
               ))}
             </div>
           )}
        </CardContent>
      </Card>
    </div>
  )
}