"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser } from "@/firebase"
import { doc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Loader2, 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Clock, 
  User, 
  Ticket, 
  Download,
  Share2,
  AlertCircle,
  CheckCircle2
} from "lucide-react"
import Image from "next/image"
import { QRCodeSVG } from "qrcode.react"

export default function VoucherPage() {
  const params = useParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const regId = params.id as string

  const regRef = React.useMemo(() => (db && regId) ? doc(db, "registrations", regId) : null, [db, regId])
  const { data: registration, loading: regLoading } = useDoc<any>(regRef)

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "A definir";
    try {
      let d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      if (isNaN(d.getTime())) return "A definir";
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
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

  if (regLoading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (!registration) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <AlertCircle className="w-12 h-12 text-destructive opacity-50" />
        <h2 className="text-xl font-bold">Voucher não encontrado</h2>
        <Button onClick={() => router.push('/dashboard/ingressos')}>Voltar</Button>
      </div>
    )
  }

  if (user && registration.userId !== user.uid) {
    return (
       <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <h2 className="text-xl font-bold text-destructive">Acesso Negado</h2>
        <p className="text-muted-foreground">Este voucher não pertence à sua conta.</p>
        <Button onClick={() => router.push('/dashboard/ingressos')}>Meus Ingressos</Button>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-20 pt-6">
      <div className="flex items-center justify-between px-4">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-bold uppercase text-xs">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <div className="flex gap-2">
           <Button variant="outline" size="icon" className="rounded-full">
             <Share2 className="w-4 h-4" />
           </Button>
           <Button variant="outline" size="icon" className="rounded-full" onClick={() => window.print()}>
             <Download className="w-4 h-4" />
           </Button>
        </div>
      </div>

      <div className="relative px-4">
        <div className="absolute -top-4 -left-4 -right-4 h-32 bg-secondary/10 -z-10 blur-3xl rounded-full opacity-50" />
        
        <Card className="overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-white print:shadow-none">
          <div className="relative h-48 bg-muted">
            <Image 
              src={registration.eventImage || "https://picsum.photos/seed/event/800/600"} 
              alt={registration.eventTitle} 
              fill 
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-6 left-8 right-6">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-secondary text-white border-none text-[10px] font-black uppercase">
                  {registration.batchName || "Lote Único"}
                </Badge>
                {registration.checkedIn && (
                  <Badge className="bg-green-500 text-white border-none text-[10px] font-black uppercase flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Utilizado
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-tight line-clamp-2">
                {registration.eventTitle}
              </h1>
            </div>
          </div>

          <CardContent className="p-8 space-y-8 relative">
            <div className="absolute top-0 -left-4 w-8 h-8 bg-[#f8fafc] rounded-full -translate-y-1/2" />
            <div className="absolute top-0 -right-4 w-8 h-8 bg-[#f8fafc] rounded-full -translate-y-1/2" />
            
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Data</p>
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Calendar className="w-3.5 h-3.5 text-secondary" />
                  {formatDate(registration.eventDate)}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Horário</p>
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Clock className="w-3.5 h-3.5 text-secondary" />
                  {formatTime(registration.eventDate)}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Local</p>
              <div className="flex items-start gap-2 font-bold text-sm">
                <MapPin className="w-3.5 h-3.5 text-secondary shrink-0 mt-0.5" />
                <span className="line-clamp-1">{registration.eventCity || "Local a definir"}</span>
              </div>
            </div>

            <div className="pt-6 border-t border-dashed border-border/60 space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Participante</p>
                  <div className="flex items-center gap-2 font-black text-base italic uppercase text-primary">
                    <User className="w-4 h-4 text-secondary" />
                    {registration.userName}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Preço</p>
                  <p className="font-bold text-sm">
                    {registration.price === 0 ? "GRÁTIS" : `R$ ${parseFloat(registration.price).toFixed(2)}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-[2rem] gap-6">
                <div className="p-4 bg-white rounded-3xl shadow-inner">
                   <div className="w-48 h-48 relative flex items-center justify-center">
                      {registration.ticketCode ? (
                        <QRCodeSVG 
                          value={registration.ticketCode} 
                          size={192}
                          level="H"
                          includeMargin={false}
                        />
                      ) : (
                        <Ticket className="w-20 h-20 text-secondary opacity-20" />
                      )}
                   </div>
                </div>
                
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Ticket ID</p>
                  <p className="text-xl font-mono font-black tracking-tighter text-secondary">
                    {registration.ticketCode || "GERANDO-ID-TICKET"}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 text-center">
              <p className="text-[9px] text-muted-foreground font-medium max-w-[200px] mx-auto uppercase tracking-tighter">
                Apresente este voucher na entrada do evento para validação via app organizador.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="text-center">
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-40">Viby Club Platform</p>
      </div>
    </div>
  )
}