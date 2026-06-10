"use client"

import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { EVENT_TYPES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Info, Coins, Clock, Plus, Trash2, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DisclosurePrice {
  price: number;
  untilTime: string; // Formato HH:mm
}

interface EventTypeProps {
  value: string
  onChange: (val: string) => void
  externalUrl?: string
  onExternalUrlChange?: (val: string) => void
  startingPrice?: number
  onStartingPriceChange?: (val: number) => void
  disclosurePrices?: DisclosurePrice[]
  onDisclosurePricesChange?: (prices: DisclosurePrice[]) => void
  disabled?: boolean
  isPublic?: boolean
  config?: Record<string, { enabled: boolean; message: string }>
}

export function EventType({ 
  value, 
  onChange, 
  externalUrl, 
  onExternalUrlChange, 
  startingPrice,
  onStartingPriceChange,
  disclosurePrices = [],
  onDisclosurePricesChange,
  disabled, 
  isPublic,
  config 
}: EventTypeProps) {
  if (isPublic) return null;

  const activeConfig = config?.[value];

  const handleAddPrice = () => {
    if (disclosurePrices.length >= 5) return;
    const newPrices = [...disclosurePrices, { price: 0, untilTime: "22:00" }];
    onDisclosurePricesChange?.(newPrices);
  };

  const handleUpdatePrice = (index: number, field: keyof DisclosurePrice, val: any) => {
    const newPrices = [...disclosurePrices];
    newPrices[index] = { ...newPrices[index], [field]: val };
    onDisclosurePricesChange?.(newPrices);
  };

  const handleRemovePrice = (index: number) => {
    const newPrices = disclosurePrices.filter((_, i) => i !== index);
    onDisclosurePricesChange?.(newPrices);
  };

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

      {(value === 'divulgacao' || value === 'externo') && (
        <div className="space-y-4 animate-in slide-in-from-top-2">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-1.5">
              <Tag className="w-3 h-3 text-secondary" /> Valor Inicial (Opcional)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black opacity-30">R$</span>
              <Input 
                type="number"
                step="0.01"
                value={startingPrice ?? ""} 
                onChange={e => onStartingPriceChange?.(parseFloat(e.target.value) || 0)} 
                placeholder="0,00" 
                className="rounded-xl h-11 pl-8 font-black border-secondary/20"
                disabled={disabled}
              />
            </div>
            <p className="text-[8px] font-bold text-muted-foreground uppercase px-1">Exibido como "A partir de". Deixe 0 para "Grátis".</p>
          </div>

          {value === 'externo' && onExternalUrlChange && (
            <div className="space-y-2">
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

          {onDisclosurePricesChange && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase text-secondary flex items-center gap-1.5">
                  <Coins className="w-3 h-3" /> Cronograma de Preços por Horário
                </Label>
                <span className="text-[8px] font-bold uppercase opacity-40">{disclosurePrices.length}/5</span>
              </div>

              <div className="space-y-3">
                {disclosurePrices.length === 0 && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleAddPrice}
                    className="w-full h-11 border-dashed border-secondary/30 text-secondary rounded-xl font-bold text-[10px] uppercase"
                  >
                    <Plus className="w-3 h-3 mr-2" /> Adicionar preços por hora
                  </Button>
                )}

                {disclosurePrices.map((item, index) => (
                  <div key={index} className="flex gap-2 items-end group animate-in slide-in-from-left-2 bg-muted/20 p-3 rounded-2xl border border-dashed border-border/40">
                    <div className="w-28 space-y-1">
                      <Label className="text-[8px] font-black uppercase opacity-40 ml-1">Valor (R$)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black opacity-30">R$</span>
                        <Input 
                          type="number"
                          step="0.01"
                          value={item.price ?? ""} 
                          onChange={e => handleUpdatePrice(index, 'price', parseFloat(e.target.value) || 0)} 
                          placeholder="0,00" 
                          className="rounded-xl h-10 border-none bg-white pl-8 font-black text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-[8px] font-black uppercase opacity-40 ml-1">Válido Até</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 opacity-30 text-secondary" />
                        <Input 
                          type="time"
                          value={item.untilTime} 
                          onChange={e => handleUpdatePrice(index, 'untilTime', e.target.value)} 
                          className="rounded-xl h-10 border-none bg-white pl-8 font-bold text-xs"
                        />
                      </div>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 text-destructive hover:bg-destructive/5"
                      onClick={() => handleRemovePrice(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                {disclosurePrices.length > 0 && disclosurePrices.length < 5 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={handleAddPrice}
                    className="w-full h-10 border-2 border-dashed border-muted text-muted-foreground hover:text-secondary hover:border-secondary/30 rounded-xl font-bold text-[9px] uppercase"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Adicionar próxima virada
                  </Button>
                )}
              </div>
            </div>
          )}
          
          <div className="p-4 bg-secondary/5 rounded-2xl flex gap-3 border border-secondary/10">
            <Info className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
            <p className="text-[8px] font-bold text-secondary uppercase leading-tight">
              Os preços por horário mudarão automaticamente conforme a hora do evento avançar. O "Valor Inicial" serve como base de vitrine.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
