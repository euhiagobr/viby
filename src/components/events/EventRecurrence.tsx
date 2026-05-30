"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Calendar, Clock, Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface EventRecurrenceProps {
  isRecurring: boolean
  onIsRecurringChange: (val: boolean) => void
  frequency: string
  onFrequencyChange: (val: string) => void
  recurringEndDate: string
  onRecurringEndDateChange: (val: string) => void
  isPublic?: boolean
}

export function EventRecurrence({ 
  isRecurring, 
  onIsRecurringChange, 
  frequency, 
  onFrequencyChange, 
  recurringEndDate, 
  onRecurringEndDateChange,
  isPublic 
}: EventRecurrenceProps) {
  if (isPublic) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-secondary/5 rounded-2xl border border-secondary/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
            <RefreshCw className={cn("w-5 h-5", isRecurring && "animate-spin-slow")} />
          </div>
          <div>
            <p className="text-sm font-bold uppercase italic text-primary">Evento Recorrente?</p>
            <p className="text-[10px] font-medium text-muted-foreground uppercase">Ative para criar uma série de datas automáticas.</p>
          </div>
        </div>
        <Switch checked={isRecurring} onCheckedChange={onIsRecurringChange} />
      </div>

      {isRecurring && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white rounded-3xl border-2 border-dashed border-secondary/20 animate-in slide-in-from-top-2">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase opacity-60">Frequência da Série</Label>
            <Select value={frequency} onValueChange={onFrequencyChange}>
              <SelectTrigger className="rounded-xl h-11">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="daily">Diário</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="biweekly">Quinzenal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase opacity-60">Data Limite da Série</Label>
            <Input 
              type="date" 
              value={recurringEndDate} 
              onChange={e => onRecurringEndDateChange(e.target.value)}
              className="rounded-xl h-11"
            />
          </div>

          <div className="md:col-span-2 p-4 bg-muted/30 rounded-xl flex gap-3">
            <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase">
              Ao salvar, o Viby gerará ocorrências individuais até a data limite. Cada data terá sua própria capacidade e controle de check-in, mas compartilhará esta mesma descrição e imagem.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
