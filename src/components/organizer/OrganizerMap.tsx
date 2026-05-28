"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, ExternalLink } from "lucide-react";

interface OrganizerMapProps {
  organization: any;
}

export function OrganizerMap({ organization }: OrganizerMapProps) {
  // O componente do mapa físico (iframe) ainda exige rua/número
  if (!organization.street || !organization.city) return null;

  const addressStr = `${organization.street}, ${organization.number || ""} - ${organization.neighborhood || ""}, ${organization.city} - ${organization.state || ""}`;
  const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(addressStr)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressStr)}`;

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 px-2">
        <div className="p-2 bg-primary/5 rounded-lg text-primary">
          <MapPin className="w-5 h-5" />
        </div>
        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Localização da Sede</h2>
      </div>

      <Card className="border-none shadow-sm rounded-[3rem] bg-white overflow-hidden p-0 relative">
        <div className="relative h-80 bg-muted overflow-hidden">
          <iframe
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={mapEmbedUrl}
            title="Sede da Marca"
          />
        </div>

        <CardContent className="p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-2">
            <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">{organization.name} Sede</h3>
            <p className="text-sm font-medium text-muted-foreground leading-relaxed max-w-md">{addressStr}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="rounded-2xl h-14 px-8 font-black uppercase italic text-xs gap-3 border-secondary/20 text-secondary" asChild>
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                <Navigation className="w-4 h-4 fill-current" /> Google Maps
              </a>
            </Button>
            <Button variant="ghost" className="rounded-2xl h-14 px-8 font-bold uppercase text-[10px] gap-2" asChild>
              <a href={`https://www.waze.com/ul?q=${encodeURIComponent(addressStr)}&navigate=yes`} target="_blank" rel="noopener noreferrer">
                Waze
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}