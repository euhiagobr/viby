"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Calendar, Clock, AlertTriangle, ArrowRight } from "lucide-react"
import { cn, normalizeEventDates } from "@/lib/utils"

interface EventDateTimeProps {
  startDate: string
  endDate: string
  onStartDateChange?: (val: string) => void
  onEndDateChange?: (val: string) => void
  isPublic?: boolean
}

export function EventDateTime({ startDate, endDate, onStartDateChange, onEndDateChange, isPublic }: EventDateTimeProps) {
  const normalized = React.useMemo(() => normalizeEventDates(startDate, endDate), [startDate, endDate]);
  const isOvernight = React.useMemo(() => {
    if (!normalized.isValid) return false;
    return new Date(normalized.startDate).toDateString() !== new Date(normalized.endDate).toDateString();
  }, [normalized]);

  const formatDateTime = (val: string) => {
    if (!val) return { date: "A definir", time: "" }
    try {
      const d = new Date(val)
      return {
        date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
        time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }
    } catch (e) { return { date: "---", time: "" } }
  }

  const start = formatDateTime(normalized.startDate)
  const end = formatDateTime(normalized.endDate)

  if (isPublic) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-6 bg-white rounded-[1.5rem] shadow-sm flex flex-col items-center text-center gap-2">
          <div className="p-3 bg-secondary/10 rounded-2xl text-secondary">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Início</p>
            <p className="font-bold text-sm">{start.date} às {start.time}</p>
          </div>
        </div>
        <div className="p-6 bg-white rounded-[1.5rem] shadow-sm flex flex-col items-center text-center gap-2">
          <div className="p-3 bg-secondary/10 rounded-2xl text-secondary">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Encerramento</p>
            <p className="font-bold text-sm">{end.date} às {end.time}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase opacity-60">Início do Evento</Label>
          <Input 
            type="datetime-local" 
            value={startDate} 
            onChange={e => onStartDateChange?.(e.target.value)} 
            required 
            className="rounded-xl h-11 text-xs font-bold" 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase opacity-60">Término do Evento</Label>
          <Input 
            type="datetime-local" 
            value={endDate} 
            onChange={e => onEndDateChange?.(e.target.value)} 
            required 
            className={cn("rounded-xl h-11 text-xs font-bold", !normalized.isValid && "border-destructive")}
          />
        </div>
      </div>

      {!normalized.isValid && startDate && endDate && (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3 animate-in shake">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-[10px] font-black uppercase text-red-700 leading-relaxed">
            {normalized.error}
          </p>
        </div>
      )}

      {isOvernight && normalized.isValid && (
        <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-center justify-between animate-in zoom-in-95">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                <Clock className="w-4 h-4" />
             </div>
             <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase text-secondary">Evento atravessa a madrugada</p>
                <p className="text-[10px] font-bold text-primary uppercase">
                   Termina em: {new Date(normalized.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} • {end.time}h
                </p>
             </div>
          </div>
          <Badge className="bg-secondary text-white text-[8px] font-black uppercase">Auto-Ajuste</Badge>
        </div>
      )}
    </div>
  )
}
