
"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RichText } from "@/components/ui/rich-text"
import { cn } from "@/lib/utils"

interface EventDescriptionProps {
  value: string
  onChange?: (val: string) => void
  isPublic?: boolean
  className?: string
}

/**
 * Componente de descrição de evento que utiliza o RichText para renderização de shortcodes.
 */
export function EventDescription({ value, onChange, isPublic, className }: EventDescriptionProps) {
  if (isPublic) {
    return (
      <div className={cn("space-y-6", className)}>
        <RichText 
          content={value} 
          className="text-lg md:text-xl font-medium text-foreground/80 leading-relaxed" 
        />
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between px-1">
        <Label className="text-[10px] font-black uppercase opacity-60">Descrição Detalhada</Label>
        <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-0 group-hover:opacity-100 transition-opacity">
          Suporta shortcodes Viby
        </span>
      </div>
      <Textarea 
        value={value} 
        onChange={e => onChange?.(e.target.value)} 
        required 
        className="min-h-[250px] rounded-[1.5rem] border-dashed border-secondary/20 p-8 text-base bg-muted/5 focus-visible:ring-secondary/30 transition-all leading-relaxed"
        placeholder="Conte tudo sobre a experiência. Use **texto** para negrito e +texto+ para destaque."
      />
    </div>
  )
}
