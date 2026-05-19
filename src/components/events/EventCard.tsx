"use client"

import { Calendar, MapPin, MoreVertical, Clock } from "lucide-react"
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
    if (!dateValue) return "Data não definida";
    try {
      let d: Date;
      if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
        d = dateValue.toDate();
      } else if (dateValue instanceof Date) {
        d = dateValue;
      } else {
        d = new Date(dateValue);
      }

      if (isNaN(d.getTime())) return "Data não definida";
      
      return d.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    } catch (e) {
      return "Data não definida";
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
      
      return d.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (e) {
      return "";
    }
  };

  const formattedDate = formatDate(event.date);
  const formattedTime = formatTime(event.date);

  return (
    <Card className="group overflow-hidden border-none shadow-lg bg-card transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className="relative h-48 w-full">
        <Image
          src={event.image || "https://picsum.photos/seed/event/600/400"}
          alt={event.title}
          fill
          className="object-cover transition-transform group-hover:scale-105"
          unoptimized
        />
        <div className="absolute top-3 left-3">
          <Badge className="bg-primary/80 backdrop-blur-md text-white border-none">
            {event.type || "Público"}
          </Badge>
        </div>
      </div>
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-bold line-clamp-1">{event.title}</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
          {event.shortDescription || event.description}
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
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
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <MapPin className="w-3.5 h-3.5 text-secondary" />
            <span className="line-clamp-1">{event.city || "Local não definido"}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button asChild className="w-full bg-primary hover:bg-primary/90 text-white font-semibold">
          <Link href={`/dashboard/evento/${event.id}`}>
            Ver Detalhes
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
