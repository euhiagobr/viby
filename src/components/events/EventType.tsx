"use client"

import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { EVENT_TYPES } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface EventTypeProps {
  value: string
  onChange: (val: string) => void
  externalUrl?: string
  onExternalUrlChange?: (val: string) => void
  disabled?: boolean
  isPublic?: boolean
}

export function EventType({ value, onChange, externalUrl, onExternalUrlChange, disabled, isPublic }: EventTypeProps) {
  if (isPublic) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase opacity-60">Tipo de Experiência</Label>
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="rounded-xl h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {EVENT_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value === 'externo' && onExternalUrlChange && (
        <div className="space-y-2 animate-in slide-in-from-top-2">
          <Label className="text-[10px] font-black uppercase text-secondary">Link para Compra Externa</Label>
          <Input 
            value={externalUrl || ""} 
            onChange={e => onExternalUrlChange(e.target.value)} 
            placeholder="https://exemplo.com/ingressos" 
            className="rounded-xl h-11 border-secondary/20"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  )
}
