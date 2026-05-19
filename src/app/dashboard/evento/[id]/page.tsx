"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser } from "@/firebase"
import { doc, addDoc, collection, serverTimestamp, query, where, getDocs } from "firebase/firestore"
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
  Star,
  Loader2,
  CheckCircle2,
  Clock
} from "lucide-react"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

export default function EventoDetalhesPage() {
  const params = useParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const eventId = params.id as string
  
  const eventRef = React.useMemo(() => db ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading } = useDoc<any>(eventRef)
  
  const [isRegistered, setIsRegistered] = React.useState(false)
  const [registering, setRegistering] = React.useState(false)

  React.useEffect(() => {
    if (!db || !user || !eventId) return
    const checkReg = async () => {
      const q = query(collection(db, "registrations"), where("eventId", "==", eventId), where("userId", "==", user.uid))
      const snap = await getDocs(q)
      setIsRegistered(!snap.empty)
    }
    checkReg()
  }, [db, user, eventId])

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
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
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
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return "";
    }
  };

  const handleRegisterInterest = async () => {
    if (!auth || !user) {
      toast({ title: "Ação necessária", description: "Você precisa entrar para marcar interesse." })
      router.push("/login")
      return
    }

    if (!db || !eventId || !event) return

    setRegistering(true)
    const regData = {
      eventId,
      eventTitle: event.title,
      userId: user.uid,
      userName: user.displayName || user.email,
      userEmail: user.email,
      timestamp: serverTimestamp()
    }

    addDoc(collection(db, "registrations"), regData)
      .then(() => {
        setIsRegistered(true)
        toast({ title: "Confirmado!", description: "O organizador foi notificado do seu interesse." })
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: "registrations",
          operation: "create",
          requestResourceData: regData
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setRegistering(false))
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <h2 className="text-2xl font-bold">Evento não encontrado</h2>
        <Button onClick={() => router.push('/dashboard')}>Voltar para Explorar</Button>
      </div>
    )
  }

  const formattedDate = formatDate(event.date);
  const formattedTime = formatTime(event.date);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Share2 className="w-4 h-4" />
          </Button>
          <Button 
            onClick={handleRegisterInterest}
            disabled={isRegistered || registering}
            className={isRegistered ? "bg-green-500 text-white" : "bg-secondary text-white"}
          >
            {registering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isRegistered ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Inscrito</> : "Tenho Interesse"}
          </Button>
        </div>
      </div>

      <div className="relative h-[400px] w-full rounded-2xl overflow-hidden shadow-2xl">
        <Image src={event.image || "https://picsum.photos/seed/event/1200/800"} alt={event.title} fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 p-8 w-full">
          <div className="flex flex-col gap-4 max-w-4xl">
            <Badge className="w-fit bg-secondary text-white border-none text-sm px-4 py-1">{event.type}</Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">{event.title}</h1>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-white/90 text-sm font-medium">
              <span className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-secondary" />
                {formattedDate}
              </span>
              {formattedTime && (
                <span className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-secondary" />
                  {formattedTime}
                </span>
              )}
              <span className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-secondary" />
                {event.location || event.address?.street}, {event.city}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm bg-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Info className="w-5 h-5 text-secondary" /> Sobre o Evento</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed text-lg whitespace-pre-line">{event.description}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-sm bg-card">
            <CardHeader><CardTitle className="text-lg">Organizador</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-secondary/10">
                  <AvatarImage src={event.organizer?.avatar} alt={event.organizer?.name} />
                  <AvatarFallback>{event.organizer?.name?.charAt(0) || "O"}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-lg leading-none">{event.organizer?.name || "Organizador"}</h4>
                    {event.organizer?.isVerified && <BadgeCheck className="w-5 h-5 text-secondary fill-secondary/10" />}
                  </div>
                  <p className="text-xs text-muted-foreground">Promotor Verificado</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 p-4 rounded-2xl text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Eventos</p>
                  <p className="text-xl font-black text-foreground">{event.organizer?.totalEvents || 0}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-2xl text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Avaliação</p>
                  <div className="flex items-center justify-center gap-1">
                    <p className="text-xl font-black text-foreground">4.9</p>
                    <Star className="w-4 h-4 text-orange-400 fill-orange-400" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-card border-t-4 border-secondary">
            <CardHeader><CardTitle className="flex items-center gap-2"><Ticket className="w-5 h-5 text-secondary" /> Ingressos & Acesso</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Este evento está em fase de divulgação. Ao marcar interesse, você receberá atualizações sobre a abertura de vendas e lotes.</p>
              <Button 
                onClick={handleRegisterInterest} 
                disabled={isRegistered || registering}
                className={`w-full font-bold py-6 ${isRegistered ? "bg-green-500 hover:bg-green-600" : "bg-secondary hover:bg-secondary/90"} text-white`}
              >
                {registering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isRegistered ? "Você está na lista!" : "Tenho Interesse"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
