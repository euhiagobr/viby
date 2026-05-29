"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Calendar, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface EventDateTimeProps {
  startDate: string
  endDate: string
  onStartDateChange?: (val: string) => void
  onEndDateChange?: (val: string) => void
  isPublic?: boolean
}

export function EventDateTime({ startDate, endDate, onStartDateChange, onEndDateChange, isPublic }: EventDateTimeProps) {
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

  const start = formatDateTime(startDate)
  const end = formatDateTime(endDate)

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
            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Término</p>
            <p className="font-bold text-sm">{end.date} às {end.time}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
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
          className="rounded-xl h-11 text-xs font-bold" 
        />
      </div>
    </div>
  )
}
