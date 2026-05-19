
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
  Share2, 
  ArrowLeft, 
  Ticket, 
  Info,
  BadgeCheck,
  Loader2,
  CheckCircle2,
  Clock,
  ExternalLink
} from "lucide-react"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import Link from "next/link"

export default function EventoDetalhesPage() {
  const params = useParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const eventId = params.id as string
  
  const eventRef = React.useMemo(() => db ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)
  
  const organizerRef = React.useMemo(() => 
    (db && event?.organizerId) ? doc(db, "users", event.organizerId) : null, 
    [db, event?.organizerId]
  )
  const { data: organizerProfile, loading: organizerLoading } = useDoc<any>(organizerRef)

  // Perfil do usuário logado para capturar o sexo/gênero
  const currentUserRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: currentUserProfile } = useDoc<any>(currentUserRef)
  
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

  const formatDateTime = (dateValue: any) => {
    if (!dateValue) return { date: "A definir", time: "" };
    try {
      let d: Date;
      if (dateValue?.toDate) {
        d = dateValue.toDate();
      } else {
        d = new Date(dateValue);
      }
      if (isNaN(d.getTime())) return { date: "A definir", time: "" };

      return {
        date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
        time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
    } catch (e) {
      return { date: "A definir", time: "" };
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
    
    // Define preço e lote (simulado para MVP)
    const price = event.isFree ? 0 : (event.batches?.[0]?.price || 0);
    const batchName = event.isFree ? "Gratuito" : (event.batches?.[0]?.name || "Lote Único");

    const regData = {
      eventId,
      eventTitle: event.title,
      userId: user.uid,
      userName: currentUserProfile?.name || user.displayName || user.email,
      userEmail: user.email,
      userGender: currentUserProfile?.gender || "Não informado",
      organizerId: event.organizerId,
      timestamp: serverTimestamp(),
      price: price,
      batchName: batchName,
      checkedIn: false
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

  if (eventLoading) {
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

  const start = formatDateTime(event.date);
  const end = formatDateTime(event.endDate);

  const orgName = organizerProfile?.name || event.organizer?.name || "Organizador";
  const orgAvatar = organizerProfile?.avatar || event.organizer?.avatar;
  const orgIsVerified = organizerProfile?.isVerified ?? event.organizer?.isVerified;
  const orgUsername = organizerProfile?.username;

  return (
    <div className="space-y-8 pb-20 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-semibold">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="rounded-full h-10 w-10">
            <Share2 className="w-4 h-4" />
          </Button>
          <Button 
            onClick={handleRegisterInterest}
            disabled={isRegistered || registering}
            className={`font-bold px-6 rounded-full h-10 shadow-lg transition-all ${isRegistered ? "bg-green-500 text-white" : "bg-secondary text-white hover:scale-105"}`}
          >
            {registering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isRegistered ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Já Inscrito</> : "Tenho Interesse"}
          </Button>
        </div>
      </div>

      <div className="relative h-[300px] md:h-[450px] w-full rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white">
        <Image 
          src={event.image || "https://picsum.photos/seed/event/1200/800"} 
          alt={event.title} 
          fill 
          className="object-cover"
          unoptimized 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 md:p-10 w-full">
          <div className="flex flex-col gap-4 max-w-4xl">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-secondary text-white border-none text-xs px-4 py-1 rounded-full uppercase font-black tracking-widest">
                {event.type}
              </Badge>
              {event.isFree && (
                <Badge className="bg-green-500 text-white border-none text-xs px-4 py-1 rounded-full uppercase font-black tracking-widest">
                  Grátis
                </Badge>
              )}
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter leading-tight">{event.title}</h1>
            <div className="flex flex-wrap gap-x-6 gap-y-3 text-white/90 text-sm font-semibold">
              <span className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full">
                <MapPin className="w-4 h-4 text-secondary" />
                {event.address?.street || event.location}, {event.city}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-none shadow-sm bg-card rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <Info className="w-5 h-5 text-secondary" /> 
                Sobre o Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-muted-foreground leading-relaxed text-lg whitespace-pre-line font-medium">
                {event.description || event.shortDescription}
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-none shadow-sm rounded-[1.5rem] bg-card p-6 flex flex-col items-center text-center gap-2">
              <div className="p-3 bg-secondary/10 rounded-2xl">
                <Calendar className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Data do Evento</p>
                <p className="text-lg font-bold">{start.date}</p>
              </div>
            </Card>

            <Card className="border-none shadow-sm rounded-[1.5rem] bg-card p-6 flex flex-col items-center text-center gap-2">
              <div className="p-3 bg-secondary/10 rounded-2xl">
                <Clock className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Horário</p>
                <p className="text-lg font-bold">
                  {start.time} {event.endDate && `até ${end.time}`}
                </p>
              </div>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-lg bg-card rounded-[2rem] border-t-8 border-secondary overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Ticket className="w-5 h-5 text-secondary" /> 
                Garantir Presença
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Este evento está em fase de divulgação exclusiva no <strong>Viby</strong>. 
                Ao marcar interesse, você entra para a lista prioritária do organizador.
              </p>
              <div className="bg-muted/50 p-4 rounded-2xl space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase opacity-60">
                  <span>Status</span>
                  <span className="text-secondary">{event.status || "Ativo"}</span>
                </div>
                <div className="flex justify-between text-sm font-black">
                  <span>Lote</span>
                  <span>{event.batches?.[0]?.name || "Lote Único"}</span>
                </div>
              </div>
              <Button 
                onClick={handleRegisterInterest} 
                disabled={isRegistered || registering}
                className={`w-full font-black py-7 rounded-2xl text-lg shadow-xl transition-all ${isRegistered ? "bg-green-500 hover:bg-green-600" : "bg-secondary hover:bg-secondary/90 hover:scale-105"} text-white`}
              >
                {registering ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {isRegistered ? "Inscrito com Sucesso!" : "Tenho Interesse"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-card rounded-[2rem]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase font-black text-muted-foreground tracking-widest">Organizador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border-2 border-secondary/20 p-0.5">
                  <AvatarImage src={orgAvatar} alt={orgName} className="rounded-full object-cover" />
                  <AvatarFallback className="font-bold">{orgName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-base leading-none">{orgName}</h4>
                    {orgIsVerified && <BadgeCheck className="w-4 h-4 text-secondary" />}
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Promotor Verificado</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl text-xs font-bold gap-2 h-10" asChild>
                  <Link href={orgUsername ? `/${orgUsername}` : `/dashboard`} className="w-full">
                    Ver Perfil
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
