"use client"

import { Calendar, MapPin, Tag, MoreVertical } from "lucide-react"
import { Event } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Image from "next/image"

interface EventCardProps {
  event: Event
}

export function EventCard({ event }: EventCardProps) {
  return (
    <Card className="group overflow-hidden border-none shadow-lg bg-card transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className="relative h-48 w-full">
        <Image
          src={event.image}
          alt={event.title}
          fill
          className="object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute top-3 left-3">
          <Badge className="bg-primary/80 backdrop-blur-md text-white border-none">
            {event.type}
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
          {event.description}
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <Calendar className="w-3.5 h-3.5 text-secondary" />
            <span>{event.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <MapPin className="w-3.5 h-3.5 text-secondary" />
            <span>{event.location}, {event.city}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button className="w-full bg-primary hover:bg-primary/90 text-white font-semibold">
          Ver Detalhes
        </Button>
      </CardFooter>
    </Card>
  )
}
