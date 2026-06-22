
"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Calendar, Clock, Info, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface CustomOccurrence {
  date: string;
  startTime: string;
  endTime: string;
}

interface EventRecurrenceProps {
  isRecurring: boolean
  onIsRecurringChange: (val: boolean) => void
  frequency: string
  onFrequencyChange: (val: string) => void
  recurringEndDate: string
  onRecurringEndDateChange: (val: string) => void
  customOccurrences?: CustomOccurrence[]
  onCustomOccurrencesChange?: (val: CustomOccurrence[]) => void
  isPublic?: boolean
}

export function EventRecurrence({ 
  isRecurring, 
  onIsRecurringChange, 
  frequency, 
  onFrequencyChange, 
  recurringEndDate, 
  onRecurringEndDateChange,
  customOccurrences = [],
  onCustomOccurrencesChange,
  isPublic 
}: EventRecurrenceProps) {
  if (isPublic) return null;

  const handleAddCustom = () => {
    const safeOccurrences = customOccurrences || [];
    const newList = [...safeOccurrences, { date: "", startTime: "19:00", endTime: "22:00" }];
    onCustomOccurrencesChange?.(newList);
  };

  const handleUpdateCustom = (index: number, field: keyof CustomOccurrence, val: string) => {
    const safeOccurrences = customOccurrences || [];
    const newList = [...safeOccurrences];
    newList[index] = { ...newList[index], [field]: val };
    onCustomOccurrencesChange?.(newList);
  };

  const handleRemoveCustom = (index: number) => {
    const safeOccurrences = customOccurrences || [];
    const newList = safeOccurrences.filter((_, i) => i !== index);
    onCustomOccurrencesChange?.(newList);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-secondary/5 rounded-2xl border border-secondary/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
            <RefreshCw className={cn("w-5 h-5", isRecurring && "animate-spin-slow")} />
          </div>
          <div>
            <p className="text-sm font-bold uppercase italic text-primary">Evento Recorrente?</p>
            <p className="text-[10px] font-medium text-muted-foreground uppercase">Ative para criar uma série de datas automáticas ou personalizadas.</p>
          </div>
        </div>
        <Switch checked={isRecurring} onCheckedChange={onIsRecurringChange} />
      </div>

      {isRecurring && (
        <div className="space-y-6 p-6 bg-white rounded-3xl border-2 border-dashed border-secondary/20 animate-in slide-in-from-top-2">
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
                <SelectItem value="custom">Personalizada (Várias Datas)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {frequency !== 'custom' ? (
            <div className="grid grid-cols-1 md:grid-cols-1 gap-6 animate-in fade-in">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Data Limite da Série</Label>
                <Input 
                  type="date" 
                  value={recurringEndDate} 
                  onChange={e => onRecurringEndDateChange(e.target.value)}
                  className="rounded-xl h-11"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in">
               <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase opacity-60">Agenda Personalizada</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddCustom} className="h-8 rounded-lg font-black text-[9px] uppercase gap-2 border-secondary text-secondary">
                     <Plus className="w-3 h-3" /> Adicionar Data
                  </Button>
               </div>

               <div className="space-y-3">
                  {(customOccurrences || []).length === 0 && (
                    <div className="py-8 text-center border-2 border-dashed rounded-2xl opacity-20">
                       <Calendar className="w-8 h-8 mx-auto mb-2" />
                       <p className="text-[9px] font-black uppercase">Nenhuma data adicionada</p>
                    </div>
                  )}
                  {(customOccurrences || []).map((occ, idx) => (
                    <div key={idx} className="flex gap-2 items-end bg-muted/20 p-3 rounded-2xl border border-border/40 group animate-in slide-in-from-left-2">
                       <div className="flex-1 space-y-1">
                          <Label className="text-[8px] font-black uppercase opacity-40 ml-1">Data</Label>
                          <Input type="date" value={occ.date} onChange={e => handleUpdateCustom(idx, 'date', e.target.value)} className="h-10 rounded-xl border-none bg-white font-bold text-xs" />
                       </div>
                       <div className="w-24 space-y-1">
                          <Label className="text-[8px] font-black uppercase opacity-40 ml-1">Início</Label>
                          <Input type="time" value={occ.startTime} onChange={e => handleUpdateCustom(idx, 'startTime', e.target.value)} className="h-10 rounded-xl border-none bg-white font-bold text-xs" />
                       </div>
                       <div className="w-24 space-y-1">
                          <Label className="text-[8px] font-black uppercase opacity-40 ml-1">Fim</Label>
                          <Input type="time" value={occ.endTime} onChange={e => handleUpdateCustom(idx, 'endTime', e.target.value)} className="h-10 rounded-xl border-none bg-white font-bold text-xs" />
                       </div>
                       <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveCustom(idx)} className="h-10 w-10 text-destructive hover:bg-destructive/5">
                          <Trash2 className="w-4 h-4" />
                       </Button>
                    </div>
                  ))}
               </div>
            </div>
          )}

          <div className="p-4 bg-muted/30 rounded-xl flex gap-3">
            <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase">
              {frequency === 'custom' 
                ? "Cada data adicionada gerará uma sessão independente com sua própria gestão de público."
                : "Ao salvar, o Viby gerará ocorrências individuais até a data limite."}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
