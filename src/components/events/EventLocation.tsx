"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { MapPin, Navigation } from "lucide-react"
import { cn } from "@/lib/utils"

interface EventLocationProps {
  address: any
  onChange?: (address: any) => void
  isPublic?: boolean
}

export function EventLocation({ address, onChange, isPublic }: EventLocationProps) {
  const handleCepBlur = async () => {
    if (!address.cep || !onChange) return
    const cleanCep = address.cep.replace(/\D/g, "")
    if (cleanCep.length !== 8) return
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await response.json()
      if (!data.erro) {
        onChange({
          ...address,
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || ""
        })
      }
    } catch (e) {}
  }

  if (isPublic) {
    const addressStr = `${address.street}, ${address.number || ""} - ${address.neighborhood}, ${address.city} - ${address.state}`;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
            <MapPin className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary">Localização</h2>
        </div>
        <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-border/40">
           <div className="h-64 bg-muted w-full">
              <iframe
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                src={`https://maps.google.com/maps?q=${encodeURIComponent(addressStr)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
              />
           </div>
           <div className="p-8 flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Endereço</p>
                <p className="font-bold text-primary">{addressStr}</p>
              </div>
              <Button asChild variant="outline" className="rounded-xl font-black uppercase italic text-[10px] gap-2 border-secondary text-secondary">
                 <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressStr)}`} target="_blank">
                    <Navigation className="w-4 h-4 fill-current" /> Abrir no Maps
                 </a>
              </Button>
           </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase opacity-60">CEP</Label>
          <Input 
            value={address.cep || ""} 
            onChange={e => onChange?.({...address, cep: e.target.value})} 
            onBlur={handleCepBlur} 
            placeholder="00000-000" 
            className="rounded-xl h-11" 
          />
        </div>
        <div className="md:col-span-3 space-y-2">
          <Label className="text-[10px] font-black uppercase opacity-60">Logradouro / Rua</Label>
          <Input 
            value={address.street || ""} 
            onChange={e => onChange?.({...address, street: e.target.value})} 
            required 
            className="rounded-xl h-11" 
          />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cidade</Label><Input value={address.city || ""} readOnly className="rounded-xl h-11 bg-muted/30" /></div>
        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Estado (UF)</Label><Input value={address.state || ""} readOnly className="rounded-xl h-11 bg-muted/30" /></div>
        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Bairro</Label><Input value={address.neighborhood || ""} onChange={e => onChange?.({...address, neighborhood: e.target.value})} required className="rounded-xl h-11" /></div>
        <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Número</Label><Input value={address.number || ""} onChange={e => onChange?.({...address, number: e.target.value})} required className="rounded-xl h-11" /></div>
      </div>
    </div>
  )
}
