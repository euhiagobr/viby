
"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, getDoc } from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Ticket, Calendar, MapPin, Clock, ExternalLink, QrCode, AlertCircle } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"

export default function MeusIngressosPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  const registrationsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "registrations"), where("userId", "==", user.uid))
  }, [db, user])

  const { data: registrations, loading: regLoading } = useCollection<any>(registrationsQuery)

  if (regLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Meus Ingressos</h1>
        <p className="text-muted-foreground font-medium">Sua coleção de experiências e acessos confirmados.</p>
      </div>

      {!registrations || registrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-border gap-6 shadow-sm">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
            <Ticket className="w-10 h-10 text-muted-foreground opacity-30" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-bold">Nenhum ingresso por aqui ainda.</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Explore os eventos e garanta sua presença nos melhores momentos.</p>
          </div>
          <Button asChild className="bg-secondary text-white font-black px-10 h-12 rounded-full shadow-lg hover:scale-105 transition-transform">
            <Link href="/dashboard">Explorar Eventos</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {registrations.map((reg) => (
            <TicketListItem key={reg.id} registration={reg} />
          ))}
        </div>
      )}
    </div>
  )
}

function TicketListItem({ registration }: { registration: any }) {
  const db = useFirestore()
  const [event, setEvent] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(!registration.eventTitle) // Carrega se não houver denormalização

  React.useEffect(() => {
    // Se já temos os dados básicos denormalizados, podemos mostrar o card e carregar o resto em bg
    if (!db || !registration.eventId) return
    
    const fetchEvent = async () => {
      try {
        const eventDoc = await getDoc(doc(db, "events", registration.eventId))
        if (eventDoc.exists()) {
          setEvent({ ...eventDoc.data(), id: eventDoc.id })
        }
      } catch (e) {
        console.error("Erro ao carregar evento do ingresso:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchEvent()
  }, [db, registration.eventId])

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "A definir";
    try {
      let d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      if (isNaN(d.getTime())) return "A definir";
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch (e) { return "---"; }
  }

  const formatTime = (dateValue: any) => {
    if (!dateValue) return "";
    try {
      let d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ""; }
  }

  const getStatusBadge = () => {
    const status = registration.paymentStatus || (registration.price === 0 ? "Disponível" : "Pendente");
    switch (status) {
      case "Disponível": return <Badge className="bg-green-500 text-white border-none text-[10px] font-black uppercase px-3">Válido</Badge>;
      case "Pago": return <Badge className="bg-secondary text-white border-none text-[10px] font-black uppercase px-3">Confirmado</Badge>;
      case "Pendente": return <Badge variant="outline" className="text-orange-500 border-orange-500 text-[10px] font-black uppercase px-3">Pendente</Badge>;
      case "Expirado": return <Badge variant="destructive" className="text-[10px] font-black uppercase px-3">Expirado</Badge>;
      default: return <Badge variant="secondary" className="text-[10px] font-black uppercase px-3">{status}</Badge>;
    }
  }

  if (loading && !registration.eventTitle) {
    return (
      <Card className="h-40 border-none shadow-sm animate-pulse bg-white rounded-[1.5rem]">
        <CardContent className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/20" />
        </CardContent>
      </Card>
    )
  }

  const displayTitle = event?.title || registration.eventTitle || "Evento";
  const displayImage = event?.image || registration.eventImage || "https://picsum.photos/seed/event/600/400";
  const displayDate = event?.date || registration.eventDate;
  const displayCity = event?.city || registration.eventCity || "Local não definido";

  return (
    <Card className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all rounded-[1.5rem] bg-white flex flex-col sm:flex-row group">
      <div className="relative w-full sm:w-44 h-40 sm:h-auto bg-muted">
        <Image 
          src={displayImage} 
          alt={displayTitle} 
          fill 
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3">
          {getStatusBadge()}
        </div>
      </div>
      
      <CardContent className="p-6 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-black text-lg leading-tight line-clamp-1 uppercase italic tracking-tighter group-hover:text-secondary transition-colors">
              {displayTitle}
            </h3>
            {registration.checkedIn && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 text-[9px] font-black uppercase h-5 px-2">
                Check-in OK
              </Badge>
            )}
          </div>
          
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-tight">
              <Calendar className="w-3.5 h-3.5 text-secondary" />
              <span>{formatDate(displayDate)}</span>
              <span className="opacity-20">|</span>
              <Clock className="w-3.5 h-3.5 text-secondary" />
              <span>{formatTime(displayDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-tight">
              <MapPin className="w-3.5 h-3.5 text-secondary" />
              <span className="line-clamp-1">{displayCity}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-dashed border-border/60">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">
              {registration.batchName || "Lote Único"}
            </span>
            <span className="text-sm font-black text-primary mt-1">
              {registration.price === 0 ? "GRÁTIS" : `R$ ${parseFloat(registration.price).toFixed(2)}`}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-9 px-3 text-[10px] font-black uppercase rounded-xl hover:bg-muted" asChild>
               <Link href={event?.organizer?.username ? `/${event.organizer.username}/${event.id}` : '#'}>
                 <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Detalhes
               </Link>
            </Button>
            <Button size="sm" className="h-9 px-4 text-[10px] font-black uppercase rounded-xl bg-primary text-white hover:bg-primary/90 shadow-sm">
               <QrCode className="w-3.5 h-3.5 mr-1.5" /> Voucher
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
