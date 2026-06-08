
"use client"

import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { EVENT_TYPES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Info, AlertTriangle, Coins, Clock, ArrowRight } from "lucide-react"

interface EventTypeProps {
  value: string
  onChange: (val: string) => void
  externalUrl?: string
  onExternalUrlChange?: (val: string) => void
  disclosurePrice?: number
  onDisclosurePriceChange?: (val: number) => void
  disclosurePriceSecondary?: number
  onDisclosurePriceSecondaryChange?: (val: number) => void
  disclosureRule?: string
  onDisclosureRuleChange?: (val: string) => void
  disclosureSwitchTime?: string
  onDisclosureSwitchTimeChange?: (val: string) => void
  disabled?: boolean
  isPublic?: boolean
  config?: Record<string, { enabled: boolean; message: string }>
}

export function EventType({ 
  value, 
  onChange, 
  externalUrl, 
  onExternalUrlChange, 
  disclosurePrice,
  onDisclosurePriceChange,
  disclosurePriceSecondary,
  onDisclosurePriceSecondaryChange,
  disclosureRule,
  onDisclosureRuleChange,
  disclosureSwitchTime,
  onDisclosureSwitchTimeChange,
  disabled, 
  isPublic,
  config 
}: EventTypeProps) {
  if (isPublic) return null;

  const activeConfig = config?.[value];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase opacity-60">Tipo de Experiência</Label>
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="rounded-xl h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {EVENT_TYPES.filter(t => config?.[t.value]?.enabled !== false || t.value === value).map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeConfig?.message && (
          <div className="p-3 bg-secondary/5 rounded-xl border border-secondary/20 flex items-start gap-2 mt-2 animate-in zoom-in-95">
            <Info className="w-3.5 h-3.5 text-secondary shrink-0 mt-0.5" />
            <p className="text-[10px] font-bold text-secondary uppercase leading-tight">{activeConfig.message}</p>
          </div>
        )}
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

      {value === 'divulgacao' && (
        <div className="space-y-6 animate-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-secondary flex items-center gap-1.5">
                <Coins className="w-3 h-3" /> Entrada Inicial (R$)
              </Label>
              <Input 
                type="number"
                step="0.01"
                value={disclosurePrice ?? ""} 
                onChange={e => onDisclosurePriceChange?.(parseFloat(e.target.value) || 0)} 
                placeholder="0,00 (Grátis)" 
                className="rounded-xl h-11 border-secondary/20 font-bold"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-secondary flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Regra Visual (Ex: Até 21h)
              </Label>
              <Input 
                value={disclosureRule || ""} 
                onChange={e => onDisclosureRuleChange?.(e.target.value)} 
                placeholder="ex: Grátis até as 21h" 
                className="rounded-xl h-11 border-secondary/20"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="p-4 bg-muted/30 rounded-2xl border-2 border-dashed space-y-4">
             <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-secondary" />
                <span className="text-[10px] font-black uppercase">Mudança Automática (Opcional)</span>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                   <Label className="text-[9px] font-black uppercase opacity-60">Trocar para Valor (R$)</Label>
                   <Input 
                      type="number"
                      step="0.01"
                      value={disclosurePriceSecondary ?? ""} 
                      onChange={e => onDisclosurePriceSecondaryChange?.(parseFloat(e.target.value) || 0)} 
                      placeholder="Valor após mudança" 
                      className="rounded-xl h-10 bg-white"
                   />
                </div>
                <div className="space-y-2">
                   <Label className="text-[9px] font-black uppercase opacity-60">Horário da Mudança</Label>
                   <Input 
                      type="datetime-local"
                      value={disclosureSwitchTime || ""} 
                      onChange={e => onDisclosureSwitchTimeChange?.(e.target.value)} 
                      className="rounded-xl h-10 bg-white text-xs"
                   />
                </div>
             </div>
             <p className="text-[8px] font-bold text-muted-foreground uppercase leading-tight">
               Se configurado, o card do evento mudará o preço automaticamente no horário definido.
             </p>
          </div>
        </div>
      )}
    </div>
  )
}
