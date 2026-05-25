
"use client"

import * as React from "react"
import Image from "next/image"
import { Calendar, MapPin, BadgeCheck, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface EventHeroProps {
  event: any
}

export function EventHero({ event }: EventHeroProps) {
  const formatDate = (dateValue: any) => {
    if (!dateValue) return "A definir";
    const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const isVerified = event.organizer?.isVerified || false;

  return (
    <section className="relative w-full h-[60vh] min-h-[400px] max-h-[700px] overflow-hidden">
      {/* Imagem de Fundo com Blur */}
      <div className="absolute inset-0 z-0">
        <Image 
          src={event.image || "https://picsum.photos/seed/event/1200/800"} 
          alt={event.title} 
          fill 
          className="object-cover scale-110 blur-2xl opacity-20"
          unoptimized
        />
      </div>

      {/* Capa do Evento */}
      <div className="container mx-auto px-4 h-full relative z-10 flex flex-col justify-end pb-12 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8 space-y-6">
             <div className="flex flex-wrap gap-2">
                <Badge className="bg-secondary text-white font-black uppercase text-[10px] tracking-wider h-6 px-4 border-none">
                  {event.categoryName || "Geral"}
                </Badge>
                {event.isFeatured && (
                  <Badge className="bg-primary text-white font-black uppercase text-[10px] tracking-wider h-6 px-4 border-none flex items-center gap-1.5">
                    <Star className="w-3 h-3 fill-current" /> Destaque
                  </Badge>
                )}
             </div>

             <h1 className="text-4xl md:text-6xl lg:text-7xl font-black uppercase italic tracking-tighter leading-[0.9] text-primary">
               {event.title}
             </h1>

             <div className="flex flex-wrap gap-x-8 gap-y-3 pt-2">
                <div className="flex items-center gap-2.5">
                   <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center border border-border/40">
                      <Calendar className="w-5 h-5 text-secondary" />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Quando</span>
                      <span className="text-sm font-bold">{formatDate(event.date)}</span>
                   </div>
                </div>

                <div className="flex items-center gap-2.5">
                   <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center border border-border/40">
                      <MapPin className="w-5 h-5 text-secondary" />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Onde</span>
                      <span className="text-sm font-bold">{event.city || event.address?.city}</span>
                   </div>
                </div>
             </div>
          </div>

          <div className="hidden lg:block lg:col-span-4">
             <div className="relative aspect-[4/5] w-full rounded-[2.5rem] overflow-hidden shadow-2xl border-[12px] border-white/80 backdrop-blur-xl group cursor-zoom-in">
                <Image 
                  src={event.image || "https://picsum.photos/seed/event/800/1000"} 
                  alt={event.title} 
                  fill 
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                  unoptimized
                />
                {isVerified && (
                  <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-xl">
                    <BadgeCheck className="w-6 h-6 fill-blue-500 text-white" />
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </section>
  )
}
