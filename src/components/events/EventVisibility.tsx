"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface EventVisibilityProps {
  value: string
  onChange?: (val: string) => void
  isPublic?: boolean
}

export function EventVisibility({ value, onChange, isPublic }: EventVisibilityProps) {
  if (isPublic) {
    return (
      <Badge className={cn(
        "uppercase text-[9px] font-black px-2.5 h-6 shadow-sm border-none",
        value === 'Ativo' ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
      )}>
        {value || 'Pendente'}
      </Badge>
    )
  }

  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-black uppercase opacity-60">Status de Visibilidade</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="rounded-xl h-11 font-bold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="Ativo">Público (Ativo)</SelectItem>
          <SelectItem value="Rascunho">Rascunho</SelectItem>
          <SelectItem value="Privado">Privado (Link Direto)</SelectItem>
          <SelectItem value="Oculto">Oculto</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
