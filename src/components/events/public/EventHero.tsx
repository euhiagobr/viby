
"use client"

import * as React from "react"
import Image from "next/image"
import { Calendar, MapPin, BadgeCheck, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function EventHero({ event }: { event: any }) {
  const dateValue = event.date;
  const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
  const formattedDate = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const formattedTime = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="relative w-full h-[40vh] md:h-[60vh] bg-black overflow-hidden">
      <Image 
        src={event.image || "https://picsum.photos/seed/event/1200/800"} 
        alt={event.title} 
        fill 
        className="object-cover opacity-60"
        priority
        unoptimized
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 lg:p-20 max-w-7xl mx-auto w-full">
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-secondary text-white font-black uppercase text-[10px] tracking-widest px-4 py-1.5 rounded-full border-none shadow-xl">
              {event.categoryName || "Evento"}
            </Badge>
            {event.featured && (
              <Badge className="bg-yellow-400 text-black font-black uppercase text-[10px] tracking-widest px-4 py-1.5 rounded-full border-none shadow-xl flex items-center gap-1">
                <Star className="w-3 h-3 fill-current" /> Destaque
              </Badge>
            )}
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter uppercase italic leading-[0.9]">
            {event.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 md:gap-10 text-white/90 text-xs md:text-sm font-bold uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/10 backdrop-blur-md rounded-lg"><Calendar className="w-4 h-4 text-secondary" /></div>
              <div className="flex flex-col">
                <span>{formattedDate}</span>
                <span className="opacity-50 text-[10px]">{formattedTime}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/10 backdrop-blur-md rounded-lg"><MapPin className="w-4 h-4 text-secondary" /></div>
              <span>{event.city}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
