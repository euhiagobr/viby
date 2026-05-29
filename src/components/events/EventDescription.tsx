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

export function EventDescription({ value, onChange, isPublic, className }: EventDescriptionProps) {
  if (isPublic) {
    return (
      <div className={cn("text-lg md:text-xl font-medium text-foreground/80 leading-relaxed", className)}>
        <RichText content={value} />
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-[10px] font-black uppercase opacity-60">Descrição Detalhada</Label>
      <Textarea 
        value={value} 
        onChange={e => onChange?.(e.target.value)} 
        required 
        className="min-h-[200px] rounded-[1.5rem] border-dashed border-secondary/20 p-6 text-base"
        placeholder="Conte tudo sobre a experiência. Use **texto** para negrito e +texto+ para destaque."
      />
    </div>
  )
}
