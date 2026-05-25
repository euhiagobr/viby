
"use client"

import * as React from "react"
import { MapPin, Navigation, ExternalLink, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"

interface EventLocationProps {
  address: any
  location?: string
  city?: string
  eventId: string
}

export function EventLocation({ address = {}, location, city, eventId }: EventLocationProps) {
  const fullAddress = `${address.street || location || ""}, ${address.number || ""}, ${address.neighborhood || ""}, ${address.city || city || ""}`;
  
  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-secondary rounded-full" />
          <h2 className="text-2xl font-black uppercase italic tracking-tighter">Localização</h2>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" asChild className="rounded-full h-10 border-secondary/20 text-secondary font-black uppercase text-[10px] gap-2 hover:bg-secondary hover:text-white transition-all">
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noopener noreferrer">
                 <Image src="https://firebasestorage.googleapis.com/v0/b/ong-desafios-3942a.firebasestorage.app/o/site_assets%2Fgoogle-maps-icon.png?alt=media" width={14} height={14} alt="G" /> Google Maps
              </a>
           </Button>
           <Button variant="outline" size="sm" asChild className="rounded-full h-10 border-secondary/20 text-secondary font-black uppercase text-[10px] gap-2 hover:bg-secondary hover:text-white transition-all">
              <a href={`https://waze.com/ul?q=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noopener noreferrer">
                 <Image src="https://firebasestorage.googleapis.com/v0/b/ong-desafios-3942a.firebasestorage.app/o/site_assets%2Fwaze-icon.png?alt=media" width={14} height={14} alt="W" /> Waze
              </a>
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <div className="space-y-6">
            <div className="p-8 bg-muted/20 rounded-[2.5rem] border border-border/40 space-y-4">
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Espaço / Nome do Local</p>
                  <p className="text-lg font-black uppercase italic text-primary leading-tight">{address.locationName || location || "Local Confirmado"}</p>
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Endereço Completo</p>
                  <p className="text-sm font-bold text-muted-foreground leading-relaxed">
                    {address.street || "Endereço principal"}, {address.number || "s/n"}
                    {address.complement && ` - ${address.complement}`}
                  </p>
                  <p className="text-xs font-bold text-primary uppercase">
                    {address.neighborhood}, {address.city} - {address.state}
                  </p>
               </div>
            </div>

            <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-center gap-4">
               <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary">
                  <Globe className="w-6 h-6" />
               </div>
               <p className="text-[10px] font-black uppercase leading-tight text-secondary">A Viby garante a segurança dos dados de localização processados pela plataforma.</p>
            </div>
         </div>

         <div className="aspect-square w-full rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl relative bg-muted group">
            {/* Embed do Google Maps (Simulado com imagem ou placeholder se não houver API key configurada) */}
            <iframe
              width="100%"
              height="100%"
              frameBorder="0"
              style={{ border: 0 }}
              src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyDWOoEhxGwwTzEuCx5ire2ZaddlH3X4Vcw&q=${encodeURIComponent(fullAddress)}`}
              allowFullScreen
            />
            <div className="absolute inset-0 pointer-events-none border-[12px] border-transparent group-hover:border-secondary/10 transition-all rounded-[2rem]" />
         </div>
      </div>
    </section>
  )
}
