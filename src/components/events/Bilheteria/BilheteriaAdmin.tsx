
"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Ticket, 
  Plus, 
  Layers, 
  Info,
  Calendar,
  Zap,
  ChevronRight,
  ArrowRight,
  Trash2,
  Copy
} from "lucide-react"
import { cn } from "@/lib/utils"
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
  allowCoupon?: boolean
}

interface Batch {
  id: string
  name: string
  startDate: string
  endDate: string
  capacidadeInicial: number
  ticketTypes: TicketType[]
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
  sessionLabel?: string 
}

export function BilheteriaAdmin({ 
  mode, 
  onModeChange, 
  batches, 
  onBatchesChange, 
  totalCapacity, 
  onTotalCapacityChange,
  eventCurrency = 'BRL',
  onCurrencyChange,
  sessionLabel
}: BilheteriaAdminProps) {
  const currencySymbol = eventCurrency === 'BRL' ? 'R$' : eventCurrency === 'USD' ? '$' : '€';

  const handleUpdateBatch = (idx: number, field: string, value: any) => {
    const newBatches = [...batches]
    newBatches[idx] = { ...newBatches[idx], [field]: value }
    
    if (field === 'capacidadeInicial') {
      const newTotal = newBatches.reduce((acc, b) => acc + (parseInt(b.capacidadeInicial as any) || 0), 0)
      onTotalCapacityChange(newTotal)
    }
    onBatchesChange(newBatches)
  }

  const handleUpdateTicketType = (bIdx: number, tIdx: number, field: string, value: any) => {
    const newBatches = [...batches]
    newBatches[bIdx].ticketTypes[tIdx] = { ...newBatches[bIdx].ticketTypes[tIdx], [field]: value }
    onBatchesChange(newBatches)
  }

  const addBatch = () => {
    const id = Math.random().toString(36).substring(2, 9)
    const newBatch: Batch = {
      id,
      name: batches.length === 0 ? "Lote Único" : `Lote ${batches.length + 1}`,
      startDate: "",
      endDate: "",
      capacidadeInicial: 100,
      ticketTypes: [
        { id: 't1', name: 'Inteira', price: mode === 'free' ? 0 : 50, quantity: 100, allowCoupon: true }
      ]
    }
    onBatchesChange([...batches, newBatch])
    onTotalCapacityChange(totalCapacity + 100)
  }

  const removeBatch = (idx: number) => {
    const batchToRemove = batches[idx]
    const newBatches = batches.filter((_, i) => i !== idx)
    onBatchesChange(newBatches)
    onTotalCapacityChange(totalCapacity - (batchToRemove.capacidadeInicial || 0))
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20 p-4 rounded-2xl border border-dashed">
        <div className="space-y-0.5">
           {sessionLabel && <p className="text-[10px] font-black uppercase text-secondary italic">{sessionLabel}</p>}
           <p className="text-xs font-bold text-primary uppercase">Modo de Bilheteria</p>
        </div>
        <div className="bg-white p-1 rounded-xl border flex flex-wrap gap-1 shadow-sm h-fit">
          {[{ id: 'none', label: 'Sem Venda' }, { id: 'free', label: 'Grátis' }, { id: 'paid_single', label: 'Único' }, { id: 'batches', label: 'Lotes' }].map((m) => (
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

      {mode !== 'none' && (
        <div className="space-y-6">
          {batches.length === 0 && (
            <div className="py-10 text-center border-2 border-dashed rounded-3xl opacity-40">
               <Ticket className="w-10 h-10 mx-auto mb-2" />
               <p className="text-[10px] font-black uppercase">Nenhum lote configurado</p>
               <Button type="button" variant="link" onClick={addBatch} className="text-secondary font-black text-xs uppercase">Adicionar Lote agora</Button>
            </div>
          )}

          {batches.map((batch, bIdx) => (
            <Card key={batch.id} className="border-2 border-border/60 rounded-[2rem] bg-white overflow-hidden shadow-sm relative group/batch">
              <div className="bg-muted/10 border-b flex flex-row items-center justify-between py-4 px-8">
                 <div className="flex items-center gap-3">
                    <Layers className="w-4 h-4 text-secondary" />
                    <Input 
                      value={batch.name} 
                      onChange={(e) => handleUpdateBatch(bIdx, 'name', e.target.value)} 
                      className="h-8 p-0 border-none bg-transparent font-black italic uppercase text-lg text-primary focus-visible:ring-0 w-48" 
                    />
                 </div>
                 {batches.length > 1 && (
                   <button type="button" onClick={() => removeBatch(bIdx)} className="text-destructive opacity-20 hover:opacity-100 transition-opacity">
                      <Trash2 className="w-4 h-4" />
                   </button>
                 )}
              </div>
              <CardContent className="p-8 space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Capacidade do Lote</Label>
                       <Input 
                        type="number" 
                        value={batch.capacidadeInicial} 
                        onChange={(e) => handleUpdateBatch(bIdx, 'capacidadeInicial', e.target.value)} 
                        className="rounded-xl h-11 font-black" 
                       />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Vendas Iniciam</Label>
                      <Input 
                        type="datetime-local" 
                        value={batch.startDate} 
                        onChange={(e) => handleUpdateBatch(bIdx, 'startDate', e.target.value)} 
                        className="rounded-xl h-11 text-xs" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Vendas Encerram</Label>
                      <Input 
                        type="datetime-local" 
                        value={batch.endDate} 
                        onChange={(e) => handleUpdateBatch(bIdx, 'endDate', e.target.value)} 
                        className="rounded-xl h-11 text-xs" 
                      />
                    </div>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-dashed">
                    {batch.ticketTypes.map((type: any, tIdx: number) => (
                      <div key={type.id} className="p-5 rounded-2xl border bg-muted/5">
                         <div className="flex flex-col lg:flex-row gap-6 lg:items-end">
                            <div className="flex-1 space-y-2">
                               <Label className="text-[8px] uppercase font-black opacity-40">Categoria</Label>
                               <Input 
                                value={type.name} 
                                onChange={(e) => handleUpdateTicketType(bIdx, tIdx, 'name', e.target.value)} 
                                className="h-11 rounded-xl font-bold bg-white" 
                               />
                            </div>
                             <div className="w-full lg:w-48 space-y-2">
                                <Label className="text-[8px] uppercase font-black opacity-40">Permitido usar cupom de desconto</Label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={type.allowCoupon !== false}
                                    onChange={(e) => handleUpdateTicketType(bIdx, tIdx, 'allowCoupon', e.target.checked)}
                                  />
                                  <span className="text-[12px] font-bold">Ativar</span>
                                </div>
                             </div>
                            {mode !== 'free' && (
                              <div className="w-full lg:w-36 space-y-2">
                                 <Label className="text-[8px] uppercase font-black opacity-40">Preço ({eventCurrency})</Label>
                                 <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black opacity-30">{currencySymbol}</span>
                                    <Input 
                                      type="number" 
                                      step="0.01" 
                                      value={type.price} 
                                      onChange={(e) => handleUpdateTicketType(bIdx, tIdx, 'price', parseFloat(e.target.value) || 0)} 
                                      className="h-11 rounded-xl font-black text-secondary bg-white pl-9" 
                                    />
                                 </div>
                              </div>
                            )}
                         </div>
                      </div>
                    ))}
                 </div>
              </CardContent>
            </Card>
          ))}

          {(mode === 'batches' || batches.length === 0) && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={addBatch} 
              className="w-full h-14 rounded-2xl border-dashed border-secondary/30 text-secondary uppercase font-black italic text-xs gap-2"
            >
              <Plus className="w-4 h-4" /> Adicionar Lote
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
