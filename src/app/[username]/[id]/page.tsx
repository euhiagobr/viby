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
  Loader2,
  CheckCircle2,
  Clock,
  ExternalLink,
  AlertTriangle
} from "lucide-react"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import Link from "next/link"
import { generateUniqueTicketCode } from "@/lib/ticket-utils"

function InstagramVerifiedBadge({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className} 
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

export default function EventoDetalhesPage() {
  const params = useParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const eventId = params.id as string
  const usernameFromUrl = params.username as string
  
  const eventRef = React.useMemo(() => db ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)
  
  const organizerRef = React.useMemo(() => 
    (db && event?.organizerId) ? doc(db, "users", event.organizerId) : null, 
    [db, event?.organizerId]
  )
  const { data: organizerProfile } = useDoc<any>(organizerRef)

  const currentUserRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: currentUserProfile } = useDoc<any>(currentUserRef)
  
  const [isRegistered, setIsRegistered] = React.useState(false)
  const [registering, setRegistering] = React.useState(false)
  const [activeBatch, setActiveBatch] = React.useState<any>(null)
  const [saleStatus, setSaleStatus] = React.useState<'open' | 'pending' | 'ended' | 'soldout'>('pending')

  // Lógica de disponibilidade baseada em UTC-3
  React.useEffect(() => {
    if (!event) return

    const checkAvailability = () => {
      // Forçar horário de Brasília (UTC-3)
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
      const batches = event.batches || []
      
      if (batches.length === 0) {
        setSaleStatus('ended')
        return
      }

      // Procurar o primeiro lote disponível cronologicamente e com estoque
      let foundBatch = null
      let allSoldOut = true
      let allEnded = true
      let anyUpcoming = false

      for (const batch of batches) {
        const start = batch.startDate ? new Date(batch.startDate) : null
        const end = batch.endDate ? new Date(batch.endDate) : null
        const stock = parseInt(batch.available) || 0

        const isStarted = !start || now >= start
        const isNotEnded = !end || now <= end
        const hasStock = stock > 0

        if (isStarted && isNotEnded && hasStock) {
          foundBatch = batch
          setSaleStatus('open')
          break
        }

        if (hasStock) allSoldOut = false
        if (isNotEnded) allEnded = false
        if (!isStarted) anyUpcoming = true
      }

      if (foundBatch) {
        setActiveBatch(foundBatch)
      } else if (allSoldOut) {
        setSaleStatus('soldout')
      } else if (allEnded) {
        setSaleStatus('ended')
      } else if (anyUpcoming) {
        setSaleStatus('pending')
      } else {
        setSaleStatus('ended')
      }
    }

    checkAvailability()
    const timer = setInterval(checkAvailability, 60000) // Revalida a cada minuto
    return () => clearInterval(timer)
  }, [event])

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

    if (!db || !eventId || !event || saleStatus !== 'open') return

    setRegistering(true)
    
    try {
      const price = activeBatch?.price || 0;
      const batchName = activeBatch?.name || (event.isFree ? "Gratuito" : "Lote Único");
      const ticketCode = await generateUniqueTicketCode(db);

      const regData = {
        eventId,
        eventTitle: event.title,
        eventImage: event.image || "",
        eventDate: event.date,
        eventCity: event.city || "",
        userId: user.uid,
        userName: currentUserProfile?.name || user.displayName || user.email || "Usuário",
        userEmail: user.email,
        userGender: currentUserProfile?.gender || "Não informado",
        userBirthDate: currentUserProfile?.birthDate || "",
        organizerId: event.organizerId,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        price: price,
        batchName: batchName,
        checkedIn: false,
        paymentStatus: price === 0 ? "Disponível" : "Pendente",
        ticketCode: ticketCode,
        status: "Ativo",
        visibility: "public",
        purchaseType: price === 0 ? "free" : "paid"
      }

      await addDoc(collection(db, "registrations"), regData)
      setIsRegistered(true)
      toast({ title: "Confirmado!", description: "Sua presença foi registrada e seu ingresso gerado." })
    } catch (error: any) {
      const permissionError = new FirestorePermissionError({
        path: "registrations",
        operation: "create"
      })
      errorEmitter.emit("permission-error", permissionError)
      toast({ variant: "destructive", title: "Erro ao registrar", description: error.message })
    } finally {
      setRegistering(false)
    }
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
  const orgUsername = organizerProfile?.username || usernameFromUrl;

  const getButtonText = () => {
    if (isRegistered) return "Já Inscrito"
    if (saleStatus === 'pending') return "Vendas em Breve"
    if (saleStatus === 'soldout') return "Ingressos Esgotados"
    if (saleStatus === 'ended') return "Vendas Encerradas"
    return "Garantir Ingresso"
  }

  return (
    <div className="space-y-8 pb-20 max-w-6xl mx-auto px-4 pt-10">
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
            disabled={isRegistered || registering || saleStatus !== 'open'}
            className={`font-bold px-6 rounded-full h-10 shadow-lg transition-all ${
              isRegistered ? "bg-green-500 text-white" : 
              saleStatus === 'open' ? "bg-secondary text-white hover:scale-105" : "bg-muted text-muted-foreground"
            }`}
          >
            {registering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isRegistered ? <CheckCircle2 className="w-4 h-4 mr-2" /> : null}
            {getButtonText()}
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
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter leadership-tight">{event.title}</h1>
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
              <div className="p-3 bg-secondary/10 rounded-2xl"><Calendar className="w-6 h-6 text-secondary" /></div>
              <div><p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Data</p><p className="text-lg font-bold">{start.date}</p></div>
            </Card>
            <Card className="border-none shadow-sm rounded-[1.5rem] bg-card p-6 flex flex-col items-center text-center gap-2">
              <div className="p-3 bg-secondary/10 rounded-2xl"><Clock className="w-6 h-6 text-secondary" /></div>
              <div><p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Horário</p><p className="text-lg font-bold">{start.time} {event.endDate && `até ${end.time}`}</p></div>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className={`border-none shadow-lg bg-card rounded-[2rem] border-t-8 ${saleStatus === 'open' ? 'border-secondary' : 'border-muted'} overflow-hidden`}>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg font-bold"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {saleStatus === 'open' && activeBatch ? (
                <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Lote Atual</span>
                    <Badge variant="outline" className="text-[10px] font-bold border-secondary text-secondary uppercase">{activeBatch.name}</Badge>
                  </div>
                  <p className="text-2xl font-black text-primary">
                    {activeBatch.price === 0 ? "GRATUITO" : `R$ ${parseFloat(activeBatch.price).toFixed(2).replace('.', ',')}`}
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground">Vendas terminam em: {new Date(activeBatch.endDate).toLocaleString('pt-BR')}</p>
                </div>
              ) : (
                <div className="p-6 text-center space-y-2 bg-muted/20 rounded-2xl">
                  {saleStatus === 'soldout' ? (
                    <>
                      <AlertTriangle className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                      <p className="font-black text-lg uppercase italic tracking-tighter">Esgotado</p>
                      <p className="text-xs text-muted-foreground">Todos os ingressos deste evento foram adquiridos.</p>
                    </>
                  ) : saleStatus === 'pending' ? (
                    <>
                      <Clock className="w-8 h-8 text-secondary mx-auto mb-2" />
                      <p className="font-black text-lg uppercase italic tracking-tighter">Em Breve</p>
                      <p className="text-xs text-muted-foreground">As vendas ainda não iniciaram. Fique atento!</p>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="font-black text-lg uppercase italic tracking-tighter">Encerrado</p>
                      <p className="text-xs text-muted-foreground">O período de vendas para este evento terminou.</p>
                    </>
                  )}
                </div>
              )}

              <Button 
                onClick={handleRegisterInterest} 
                disabled={isRegistered || registering || saleStatus !== 'open'} 
                className={`w-full font-black py-7 rounded-2xl text-lg shadow-xl ${isRegistered ? "bg-green-500 hover:bg-green-600" : (saleStatus === 'open' ? "bg-secondary hover:bg-secondary/90" : "bg-muted cursor-not-allowed")} text-white`}
              >
                {registering ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {getButtonText()}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-card rounded-[2rem]">
            <CardHeader><CardTitle className="text-sm uppercase font-black text-muted-foreground tracking-widest">Organizador</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border-2 border-secondary/20 p-0.5">
                  <AvatarImage src={orgAvatar} alt={orgName} className="rounded-full object-cover" />
                  <AvatarFallback className="font-bold">{orgName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-base">{orgName}</h4>
                    {orgIsVerified && <InstagramVerifiedBadge className="w-4 h-4" />}
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Promotor Verificado</p>
                </div>
              </div>
              <Button variant="outline" className="w-full rounded-xl text-xs font-bold gap-2 h-10" asChild>
                <Link href={`/${orgUsername}`}>Ver Perfil Completo <ExternalLink className="w-3 h-3" /></Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
