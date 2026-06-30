'use client';

import * as React from "react";
import { MapPin, Navigation, Sparkles, ArrowRight, Tag, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { calculateDistanceMeters } from "@/lib/event-scoring-utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import Link from "next/link";

interface ExperienceCardProps {
  experience: any;
  userLocation?: any;
  className?: string;
}

/**
 * @fileOverview Card especializado para Experiências.
 * Focado em disponibilidade e valor agregado, sem travas de data fixa.
 */
export function ExperienceCard({ experience, userLocation, className }: ExperienceCardProps) {
  const { formatPriceWithOriginal } = useCurrency();

  const distanceMeters = React.useMemo(() => {
    if (userLocation && typeof experience.latitude === 'number' && typeof experience.longitude === 'number') {
      return calculateDistanceMeters(userLocation, { latitude: experience.latitude, longitude: experience.longitude });
    }
    return null;
  }, [userLocation, experience.latitude, experience.longitude]);

  const pricingDisplay = React.useMemo(() => {
    const currency = experience.currency || 'BRL';
    if (typeof experience.startingPrice === 'number' && experience.startingPrice > 0) {
      return (
        <div className="flex flex-col items-end">
          <p className="text-[8px] font-black uppercase text-muted-foreground opacity-60 leading-none mb-1">A partir de</p>
          {formatPriceWithOriginal(experience.startingPrice, currency)}
        </div>
      );
    }
    return <span className="text-green-600 font-black italic uppercase text-[10px]">Grátis</span>;
  }, [experience.startingPrice, experience.currency, formatPriceWithOriginal]);

  const experienceUrl = `/${experience.organizer?.username || 'experiencia'}/experiencia/${experience.slug || experience.id}`;

  return (
    <Link 
      href={experienceUrl}
      className={cn(
        "group flex flex-col h-full overflow-hidden border-none shadow-md bg-card transition-all hover:-translate-y-1 hover:shadow-xl rounded-[2.5rem] cursor-pointer relative bg-white",
        className
      )}
    >
      <div className="relative aspect-[16/10] w-full bg-muted overflow-hidden shrink-0">
        {experience.image && (
          <Image 
            src={experience.image} 
            alt={experience.title} 
            fill 
            className="object-cover transition-transform duration-700 group-hover:scale-105" 
            unoptimized 
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
           <Badge className="bg-secondary text-white border-none shadow-lg px-3 py-1 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 fill-current" /> Vivência
           </Badge>
        </div>

        <div className="absolute bottom-4 right-4 flex items-center gap-1.5 z-10">
          {experience.category && (
            <Badge className="bg-white/90 text-primary border-none shadow-md px-3 py-1.5 text-[9px] font-black uppercase flex items-center gap-1">
              <Tag className="w-2.5 h-2.5" /> {experience.category}
            </Badge>
          )}
          {distanceMeters !== null && (
            <Badge className="bg-white/95 text-secondary border-none shadow-md px-3 py-1.5 text-[10px] font-black uppercase flex items-center gap-1">
              <Navigation className="w-3 h-3 fill-secondary" /> {distanceMeters < 1000 ? `${distanceMeters} m` : `${(distanceMeters/1000).toFixed(1)} km`}
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-6 flex flex-col flex-1 gap-4">
        <div className="space-y-1">
          <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary group-hover:text-secondary transition-colors leading-tight line-clamp-1">
            {experience.title}
          </h3>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest line-clamp-1">
            {experience.organizer?.name || "Organizador"}
          </p>
        </div>

        <div className="py-4 border-y border-dashed border-border/60">
           <p className="text-xs font-medium text-muted-foreground line-clamp-2 leading-relaxed italic">
             {experience.shortDescription || "Descubra uma nova vivência cultural única com a Viby."}
           </p>
        </div>

        <div className="flex items-center justify-between mt-auto">
           <div className="flex items-center gap-2">
              <div className="p-2 bg-muted rounded-xl text-secondary"><MapPin className="w-4 h-4" /></div>
              <span className="text-[10px] font-black uppercase text-primary truncate max-w-[120px]">{experience.city || "Sua Cidade"}</span>
           </div>
           <div className="text-right">
              {pricingDisplay}
           </div>
        </div>

        <div className="w-full h-11 flex items-center justify-center font-black bg-primary text-white rounded-2xl uppercase italic text-[10px] gap-2 shadow-lg group-hover:bg-secondary transition-colors shrink-0">
           Ver Disponibilidade <ArrowRight className="w-4 h-4" />
        </div>
      </CardContent>
    </Link>
  );
}
