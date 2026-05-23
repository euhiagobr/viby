
"use client"

import * as React from "react"
import { 
  Calendar, 
  MapPin, 
  Heart, 
  MessageCircle, 
  Share2, 
  MoreHorizontal,
  BadgeCheck,
  ArrowRight,
  Clock
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface EventTimelineCardProps {
  event: any
}

export function EventTimelineCard({ event }: EventTimelineCardProps) {
  const router = useRouter()
  const [isLiked, setIsLiked] = React.useState(false)
  
  const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date)
  const username = event.organizer?.username || "evento"
  const eventLink = `/${username}/${event.id}`

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = `${window.location.origin}${eventLink}`
    navigator.clipboard.writeText(url)
    toast({
      title: "Link copiado!",
      description: "O link do evento foi copiado para sua área de transferência.",
    })
  }

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsLiked(!isLiked)
    if (!isLiked) {
      toast({
        title: "Evento curtido!",
        description: "Este evento foi salvo nos seus favoritos.",
      })
    }
  }

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`${eventLink}#comentarios`)
  }

  return (
    <Card 
      className="overflow-hidden border-none shadow-xl bg-white rounded-[2rem] transition-all hover:shadow-2xl cursor-pointer w-full max-w-xl mx-auto"
      onClick={() => router.push(eventLink)}
    >
      {/* Header do Organizador */}
      <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-secondary/10">
            <AvatarImage src={event.organizer?.avatar} className="object-cover" />
            <AvatarFallback className="font-bold bg-muted">
              {event.organizer?.name?.charAt(0) || "O"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-sm font-black uppercase italic tracking-tighter text-primary">
                {event.organizer?.name || "Organizador"}
              </span>
              {event.organizer?.isVerified && (
                <BadgeCheck className="w-3.5 h-3.5 fill-blue-500 text-white" />
              )}
            </div>
            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">
              @{username}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-muted-foreground opacity-40">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </CardHeader>

      {/* Imagem do Evento */}
      <div className="relative aspect-square sm:aspect-[4/3] w-full bg-muted">
        <Image
          src={event.image || `https://picsum.photos/seed/${event.id}/800/600`}
          alt={event.title}
          fill
          className="object-cover"
          unoptimized
        />
        {event.categoryName && (
          <div className="absolute top-4 left-4">
            <Badge className="bg-white/90 text-primary border-none shadow-lg text-[10px] font-black uppercase px-3 py-1">
              {event.categoryName}
            </Badge>
          </div>
        )}
      </div>

      {/* Ações Sociais */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("h-10 w-10 rounded-full transition-transform active:scale-125", isLiked && "text-red-500")}
            onClick={handleLike}
          >
            <Heart className={cn("w-6 h-6", isLiked && "fill-current")} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 rounded-full"
            onClick={handleComment}
          >
            <MessageCircle className="w-6 h-6" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 rounded-full"
            onClick={handleShare}
          >
            <Share2 className="w-6 h-6" />
          </Button>
        </div>
        <Badge variant="outline" className="border-secondary text-secondary font-black uppercase text-[9px] h-6 px-3">
          {event.isFree ? "Grátis" : "Bilheteria Aberta"}
        </Badge>
      </div>

      {/* Conteúdo do Card */}
      <CardContent className="px-6 pb-6 space-y-4">
        <div className="space-y-1">
          <h3 className="text-xl font-black uppercase italic tracking-tighter leading-tight text-primary">
            {event.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 font-medium leading-relaxed">
            {event.description || event.shortDescription}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 py-4 border-y border-dashed border-border/60">
           <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-muted-foreground opacity-50 tracking-widest">Quando</p>
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                 <Calendar className="w-3.5 h-3.5 text-secondary" />
                 {eventDate.toLocaleDateString('pt-BR')}
                 <span className="opacity-30 mx-1">|</span>
                 <Clock className="w-3.5 h-3.5 text-secondary" />
                 {eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
           </div>
           <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-muted-foreground opacity-50 tracking-widest">Onde</p>
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                 <MapPin className="w-3.5 h-3.5 text-secondary" />
                 <span className="truncate">{event.city}</span>
              </div>
           </div>
        </div>

        <Button className="w-full h-12 bg-primary text-white font-black rounded-2xl uppercase italic text-xs gap-2 group hover:bg-secondary transition-colors">
          Ver detalhes do evento <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  )
}
