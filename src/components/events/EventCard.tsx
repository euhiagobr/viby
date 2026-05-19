
"use client"

import { Calendar, MapPin, MoreVertical, Clock, Ticket } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"

interface EventCardProps {
  event: any 
}

export function EventCard({ event }: EventCardProps) {
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

  // Lógica de preço
  const getPriceDisplay = () => {
    if (event.isFree) return "Grátis";
    if (event.batches && event.batches.length > 0) {
      const prices = event.batches.map((b: any) => parseFloat(b.price) || 0);
      const minPrice = Math.min(...prices);
      return `A partir de R$ ${minPrice.toFixed(2).replace('.', ',')}`;
    }
    return "Consulte";
  };

  return (
    <Card className="group overflow-hidden border-none shadow-lg bg-card transition-all hover:-translate-y-1 hover:shadow-xl rounded-[1.5rem]">
      <div className="relative h-48 w-full">
        <Image
          src={event.image || "https://picsum.photos/seed/event/600/400"}
          alt={event.title}
          fill
          className="object-cover transition-transform group-hover:scale-105"
          unoptimized
        />
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <Badge className="bg-secondary text-white border-none shadow-md px-3 py-1 text-[10px] font-black uppercase tracking-wider">
            {event.categoryName || "Evento"}
          </Badge>
          <Badge className={`${event.isFree ? "bg-green-500" : "bg-primary"} text-white border-none shadow-md px-3 py-1 text-[10px] font-black uppercase tracking-wider`}>
            {getPriceDisplay()}
          </Badge>
        </div>
      </div>
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-lg font-bold line-clamp-1 group-hover:text-secondary transition-colors">{event.title}</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
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
      <CardFooter className="p-4 pt-0">
        <Button asChild className="w-full bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-10 shadow-sm">
          <Link href={eventLink} className="flex items-center gap-2">
            <Ticket className="w-4 h-4" />
            Ver Detalhes
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
