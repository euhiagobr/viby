
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
  CheckCircle2,
  Lock,
  History,
  Armchair,
  Layers
} from "lucide-react"
import Image from "next/image"
import { QRCodeSVG } from "qrcode.react"
import { formatCurrency } from "@/lib/financial-utils"
import { cn } from "@/lib/utils"

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
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) { return "---"; }
  }

  const formatTime = (dateValue: any) => {
    if (!dateValue) return "";
    try {
      let d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
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

  const isAcceptedHolder = registration.sharedWithUid === user?.uid && registration.transferStatus === 'accepted';
  const isOriginalActiveOwner = registration.userId === user?.uid && !registration.sharedWithUid;
  const isCurrentActivePossessor = isAcceptedHolder || isOriginalActiveOwner;

  const isPaid = registration.paymentStatus === "Pago" || registration.paymentStatus === "Disponível" || (registration.price || 0) === 0;

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
           {isCurrentActivePossessor && isPaid && (
             <Button variant="outline" size="icon" className="rounded-full" onClick={() => window.print()}>
               <Download className="w-4 h-4" />
             </Button>
           )}
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
                {registration.seatCode && (
                   <Badge className="bg-white text-primary border-none text-[10px] font-black uppercase flex items-center gap-1">
                      <Armchair className="w-3 h-3" /> {registration.seatCode}
                   </Badge>
                )}
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
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Início</p>
                  <div className="flex items-center gap-2 font-bold text-xs text-primary">
                    <Calendar className="w-3 h-3 text-secondary" />
                    {formatDate(registration.eventDate)}
                  </div>
                  <div className="flex items-center gap-2 font-bold text-xs text-primary pl-5">
                    <Clock className="w-3 h-3 text-secondary" />
                    {formatTime(registration.eventDate)}
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Acomodação</p>
                  <div className="flex items-center gap-2 font-bold text-xs text-primary">
                    <Layers className="w-3 h-3 text-secondary" />
                    {registration.batchName || "Geral"}
                  </div>
                  {registration.seatCode && (
                    <div className="flex items-center gap-2 font-black text-sm text-secondary pl-5">
                       Lugar: {registration.seatCode}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Local</p>
              <div className="flex items-start gap-2 font-bold text-sm text-primary">
                <MapPin className="w-3.5 h-3.5 text-secondary shrink-0 mt-0.5" />
                <span className="line-clamp-1">{registration.eventCity || "Local Confirmado"}</span>
              </div>
            </div>

            <div className="pt-6 border-t border-dashed border-border/60 space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Titular do Ingresso</p>
                  <div className="flex items-center gap-2 font-black text-base italic uppercase text-primary">
                    <User className="w-4 h-4 text-secondary" />
                    {registration.attendeeName || registration.userName}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Preço</p>
                  <p className="font-black text-sm text-primary">
                    {formatCurrency(registration.price || 0)}
                  </p>
                </div>
              </div>

              <div className={cn(
                "flex flex-col items-center justify-center p-8 rounded-[2rem] gap-6 transition-all",
                isCurrentActivePossessor ? "bg-muted/30" : "bg-orange-50 border-2 border-dashed border-orange-200"
              )}>
                <div className="p-4 bg-white rounded-3xl shadow-inner relative overflow-hidden">
                   <div className="w-48 h-48 relative flex items-center justify-center">
                      {isCurrentActivePossessor && isPaid ? (
                        <QRCodeSVG 
                          value={JSON.stringify({
                             ev: registration.eventId,
                             reg: registration.id,
                             seat: registration.seatCode || null,
                             code: registration.ticketCode
                          })} 
                          size={192}
                          level="H"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-4 text-orange-500 text-center">
                          <Lock className="w-16 h-16 opacity-30" />
                          <p className="text-[10px] font-black uppercase leading-tight">
                            QR Code Indisponível<br/>
                            {!isCurrentActivePossessor ? "Ingresso Transferido" : "Aguardando Pagamento"}
                          </p>
                        </div>
                      )}
                   </div>
                </div>
                
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Voucher ID</p>
                  <p className={cn(
                    "text-xl font-mono font-black tracking-tighter",
                    isCurrentActivePossessor ? "text-secondary" : "text-muted-foreground/30"
                  )}>
                    {isCurrentActivePossessor ? (registration.ticketCode || "GERANDO...") : "****-****-****-****"}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 text-center">
              {!isCurrentActivePossessor && registration.userId === user?.uid ? (
                <div className="space-y-2">
                   <p className="text-[10px] font-black text-orange-600 uppercase italic">Este ingresso foi transferido por você.</p>
                   <p className="text-[9px] text-muted-foreground font-medium max-w-[200px] mx-auto uppercase">
                     Você ainda pode acompanhar o rastro de posse no seu painel de ingressos.
                   </p>
                </div>
              ) : (
                <p className="text-[9px] text-muted-foreground font-medium max-w-[200px] mx-auto uppercase tracking-tighter">
                  Apresente este voucher na entrada do evento para validação.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
