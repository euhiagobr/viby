
"use client"

import * as React from "react"
import { MapPin, Navigation, Map as MapIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function EventLocation({ address, location, city, eventId }: { address?: any, location?: string, city?: string, eventId: string }) {
  const fullAddress = address ? `${address.street}, ${address.number} - ${address.neighborhood}, ${address.city} - ${address.state}` : location;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress || city || "")}`;
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(fullAddress || city || "")}`;

  return (
    <div className="space-y-8">
      <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 px-1">Localização</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-black text-2xl uppercase italic tracking-tighter text-primary">{location || "Local Confirmado"}</h3>
            <p className="text-muted-foreground font-medium flex items-start gap-2">
              <MapPin className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
              {fullAddress}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="bg-primary text-white font-black rounded-xl h-12 uppercase italic text-[10px] tracking-widest gap-2 shadow-lg">
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <Navigation className="w-4 h-4" /> Google Maps
              </a>
            </Button>
            <Button asChild variant="outline" className="rounded-xl h-12 border-border font-black text-[10px] uppercase tracking-widest gap-2 hover:bg-muted">
              <a href={wazeUrl} target="_blank" rel="noopener noreferrer">
                <MapIcon className="w-4 h-4 text-secondary" /> Abrir no Waze
              </a>
            </Button>
          </div>
        </div>

        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden h-64 bg-muted/30">
          <iframe 
            width="100%" 
            height="100%" 
            style={{ border: 0 }} 
            loading="lazy" 
            allowFullScreen 
            src={`https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY_HERE&q=${encodeURIComponent(fullAddress || city || "")}`}
          />
        </Card>
      </div>
    </div>
  )
}
