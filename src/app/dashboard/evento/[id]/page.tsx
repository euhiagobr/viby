"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { MOCK_EVENTS } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Calendar, 
  MapPin, 
  Users, 
  Share2, 
  ArrowLeft, 
  Ticket, 
  Info,
  BadgeCheck,
  Star
} from "lucide-react"
import Image from "next/image"

export default function EventoDetalhesPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  
  const event = MOCK_EVENTS.find(e => e.id === eventId)

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <h2 className="text-2xl font-bold">Evento não encontrado</h2>
        <Button onClick={() => router.push('/dashboard')}>Voltar para Explorar</Button>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header / Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Share2 className="w-4 h-4" />
          </Button>
          <Button className="bg-secondary text-white hover:bg-secondary/90">
            Seguir Evento
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative h-[400px] w-full rounded-2xl overflow-hidden shadow-2xl">
        <Image
          src={event.image}
          alt={event.title}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 p-8 w-full">
          <div className="flex flex-col gap-4 max-w-4xl">
            <Badge className="w-fit bg-secondary text-white border-none text-sm px-4 py-1">
              {event.type}
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
              {event.title}
            </h1>
            <div className="flex flex-wrap gap-6 text-white/90 text-sm font-medium">
              <span className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-secondary" />
                {event.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-secondary" />
                {event.location}, {event.city}
              </span>
              <span className="flex items-center gap-2">
                <Users className="w-5 h-5 text-secondary" />
                Capacidade: 2.500 pessoas
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Details & Map */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Info className="w-5 h-5 text-secondary" />
                Sobre o Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed text-lg">
                {event.description}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Prepare-se para uma experiência inesquecível. O {event.title} traz o que há de melhor em entretenimento e cultura para {event.city}. 
                Contaremos com infraestrutura completa, segurança reforçada e uma curadoria especial para garantir que cada momento seja único.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-card overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <MapPin className="w-5 h-5 text-secondary" />
                Localização
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[350px] w-full bg-muted relative">
                <iframe
                  src={`https://www.google.com/maps/embed/v1/place?key=REPLACE_WITH_YOUR_API_KEY&q=${encodeURIComponent(event.location + ' ' + event.city)}`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="grayscale hover:grayscale-0 transition-all duration-500"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-muted/80 pointer-events-none">
                  <div className="text-center p-6">
                    <MapPin className="w-10 h-10 text-secondary mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium text-muted-foreground">{event.location}</p>
                    <p className="text-xs text-muted-foreground">{event.city}, Brasil</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Organizer & Tickets */}
        <div className="space-y-8">
          {/* Perfil do Organizador */}
          <Card className="border-none shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Organizador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-secondary/10">
                  <AvatarImage src={event.organizer.avatar} alt={event.organizer.name} />
                  <AvatarFallback>{event.organizer.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-lg leading-none">{event.organizer.name}</h4>
                    {event.organizer.isVerified && (
                      <BadgeCheck className="w-5 h-5 text-secondary fill-secondary/10" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Promotor Verificado</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 p-4 rounded-2xl text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Eventos</p>
                  <p className="text-xl font-black text-foreground">{event.organizer.totalEvents}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-2xl text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Avaliação</p>
                  <div className="flex items-center justify-center gap-1">
                    <p className="text-xl font-black text-foreground">4.9</p>
                    <Star className="w-4 h-4 text-orange-400 fill-orange-400" />
                  </div>
                </div>
              </div>

              <Button variant="outline" className="w-full font-bold">
                Ver Perfil Completo
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-card border-t-4 border-secondary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-secondary" />
                Ingressos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {event.batches.map(batch => (
                <div key={batch.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border group hover:border-secondary/30 transition-all">
                  <div>
                    <p className="font-bold text-sm">{batch.name}</p>
                    <p className="text-xs text-muted-foreground">{batch.available} disponíveis</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-secondary text-lg">R$ {batch.price}</p>
                    <Badge variant="outline" className="text-[10px] uppercase">Lote Ativo</Badge>
                  </div>
                </div>
              ))}
              <Button className="w-full bg-secondary text-white hover:bg-secondary/90 font-bold py-6">
                Comprar Agora
              </Button>
              <p className="text-[10px] text-center text-muted-foreground">
                Taxas de serviço podem ser aplicadas ao finalizar a compra.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
