
"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, getDoc, updateDoc } from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Loader2, 
  Ticket, 
  Calendar, 
  MapPin, 
  Clock, 
  ExternalLink, 
  QrCode, 
  User as UserIcon,
  Save,
  CheckCircle2
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"

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
  const [loading, setLoading] = React.useState(!registration.eventTitle)
  const [isAttendeeModalOpen, setIsAttendeeModalOpen] = React.useState(false)
  const [attendeeName, setAttendeeName] = React.useState(registration.attendeeName || registration.userName || "")
  const [attendeeCPF, setAttendeeCPF] = React.useState(registration.attendeeCPF || "")
  const [isSavingAttendee, setIsSavingAttendee] = React.useState(false)

  React.useEffect(() => {
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

  const handleUpdateAttendee = async () => {
    if (!db || !registration.id) return
    setIsSavingAttendee(true)
    try {
      await updateDoc(doc(db, "registrations", registration.id), {
        attendeeName,
        attendeeCPF
      })
      toast({ title: "Dados atualizados!", description: "O nome e CPF do participante foram salvos." })
      setIsAttendeeModalOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Não foi possível atualizar os dados." })
    } finally {
      setIsSavingAttendee(false)
    }
  }

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
            <div className="flex items-center gap-2 pt-1">
              <UserIcon className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-bold text-primary uppercase">
                Para: {registration.attendeeName || registration.userName || "Não definido"}
              </span>
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
            <Dialog open={isAttendeeModalOpen} onOpenChange={setIsAttendeeModalOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-9 px-3 text-[10px] font-black uppercase rounded-xl border-dashed">
                  <UserIcon className="w-3.5 h-3.5 mr-1.5" /> Participante
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-[2rem] max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black italic uppercase tracking-tighter">Dados do Participante</DialogTitle>
                  <DialogDescription>Quem vai usar este ingresso na portaria?</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Nome Completo</Label>
                    <Input 
                      value={attendeeName}
                      onChange={(e) => setAttendeeName(e.target.value)}
                      placeholder="Nome de quem vai entrar"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">CPF</Label>
                    <Input 
                      value={attendeeCPF}
                      onChange={(e) => setAttendeeCPF(e.target.value.replace(/\D/g, "").substring(0, 11))}
                      placeholder="000.000.000-00"
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    onClick={handleUpdateAttendee} 
                    disabled={isSavingAttendee || !attendeeName}
                    className="w-full bg-secondary text-white font-black h-12 rounded-xl"
                  >
                    {isSavingAttendee ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Salvar Dados
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button size="sm" className="h-9 px-4 text-[10px] font-black uppercase rounded-xl bg-primary text-white hover:bg-primary/90 shadow-sm" asChild>
               <Link href={`/dashboard/ingressos/${registration.id}/voucher`}>
                 <QrCode className="w-3.5 h-3.5 mr-1.5" /> Voucher
               </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
