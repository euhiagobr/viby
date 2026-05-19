"use client"

import * as React from "react"
import { Calendar, MapPin, Clock, Ticket } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

function InstagramVerifiedBadge({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      className={cn("w-3 h-3", className)} 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M22.5 12.5C22.5 18.0228 18.0228 22.5 12.5 22.5C6.97715 22.5 2.5 18.0228 2.5 12.5C2.5 6.97715 6.97715 2.5 12.5 2.5C18.0228 2.5 22.5 6.97715 22.5 12.5Z" 
        fill="#0095F6"
      />
      <path 
        d="M10 14.5L7.5 12L6.5 13L10 16.5L17.5 9L16.5 8L10 14.5Z" 
        fill="white" 
        stroke="white" 
        strokeWidth="0.5"
      />
    </svg>
  )
}

interface EventCardProps {
  event: any 
}

export function EventCard({ event }: EventCardProps) {
  const router = useRouter()
  
  const formatDate = (dateValue: any) => {
    if (!dateValue) return "A definir";
    try {
      let d: Date;
      if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
        d = dateValue.toDate();
      } else if (dateValue instanceof Date) {
        d = dateValue;
      } else {
        d = new Date(dateValue);
      }
      if (isNaN(d.getTime())) return "A definir";
      return d.toLocaleDateString('pt-BR');
    } catch (e) {
      return "A definir";
    }
  };

  const formatTime = (dateValue: any) => {
    if (!dateValue) return "";
    try {
      let d: Date;
      if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
        d = dateValue.toDate();
      } else if (dateValue instanceof Date) {
        d = dateValue;
      } else {
        d = new Date(dateValue);
      }
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return "";
    }
  };

  const formattedDate = formatDate(event.date);
  const formattedTime = formatTime(event.date);
  
  const username = event.organizer?.username || "evento";
  const eventLink = `/${username}/${event.id}`;
  const profileLink = `/${username}`;

  const getPriceDisplay = () => {
    if (event.isFree) return "Grátis";
    if (event.batches && event.batches.length > 0) {
      const prices = event.batches.map((b: any) => parseFloat(b.price) || 0);
      const minPrice = Math.min(...prices);
      return minPrice === 0 ? "Grátis" : `A partir de R$ ${minPrice.toFixed(2).replace('.', ',')}`;
    }
    return "Consulte";
  };

  const handleCardClick = () => {
    router.push(eventLink)
  }

  const handleOrganizerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(profileLink)
  }

  const categoryDisplay = event.categoryName || event.type || "Evento";

  return (
    <Card 
      className="group overflow-hidden border-none shadow-lg bg-card transition-all hover:-translate-y-1 hover:shadow-xl rounded-[1.5rem] cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="relative h-48 w-full bg-muted">
        <Image
          src={event.image || `https://picsum.photos/seed/${event.id}/600/400`}
          alt={event.title}
          fill
          className="object-cover transition-transform group-hover:scale-105"
          unoptimized
          data-ai-hint="event cover"
        />
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <Badge className="bg-secondary text-white border-none shadow-md px-3 py-1 text-[10px] font-black uppercase tracking-wider">
            {categoryDisplay}
          </Badge>
          <Badge className={cn("text-white border-none shadow-md px-3 py-1 text-[10px] font-black uppercase tracking-wider", event.isFree ? "bg-green-500" : "bg-primary")}>
            {getPriceDisplay()}
          </Badge>
        </div>
      </div>
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-lg font-bold line-clamp-1 group-hover:text-secondary transition-colors">
            {event.title}
          </h3>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem] font-medium">
          {event.shortDescription || event.description}
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-black uppercase tracking-tight">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-secondary" />
              {formattedDate}
            </span>
            {formattedTime && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-secondary" />
                {formattedTime}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-black uppercase tracking-tight">
            <MapPin className="w-3.5 h-3.5 text-secondary" />
            <span className="line-clamp-1">{event.city || "Local não definido"}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-2 border-t border-border flex items-center justify-between">
        <div 
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          onClick={handleOrganizerClick}
        >
          <Avatar className="h-6 w-6 border border-secondary/20">
            <AvatarImage src={event.organizer?.avatar} alt={event.organizer?.name} className="object-cover" />
            <AvatarFallback className="text-[10px] font-bold bg-muted">
              {event.organizer?.name?.charAt(0) || "O"}
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase hover:text-secondary truncate max-w-[100px]">
              {event.organizer?.name || "Organizador"}
            </span>
            {event.organizer?.isVerified && (
              <InstagramVerifiedBadge />
            )}
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 text-[10px] font-black uppercase gap-1.5 text-secondary hover:bg-secondary/10"
        >
          <Ticket className="w-3.5 h-3.5" />
          Detalhes
        </Button>
      </CardFooter>
    </Card>
  )
}