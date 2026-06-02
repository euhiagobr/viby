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
  Armchair,
  Layers,
  XCircle,
  RefreshCw,
  ShieldCheck
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
      let d: Date;
      if (typeof dateValue === 'object' && 'seconds' in dateValue) {
        d = new Date(dateValue.seconds * 1000);
      } else if (typeof dateValue === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          d = new Date(`${dateValue}T12:00:00`);
        } else {
          d = new Date(dateValue);
        }
      } else {
        d = new Date(dateValue);
      }
      if (isNaN(d.getTime())) return "Data Inválida";
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) { return "Erro na data"; }
  }

  const formatTime = (dateValue: any) => {
    if (registration?.horarioOcorrencia) return registration.horarioOcorrencia;
    if (!dateValue) return "---";
    try {
      let d: Date;
      if (typeof dateValue === 'object' && 'seconds' in dateValue) {
        d = new Date(dateValue.seconds * 1000);
      } else {
        d = new Date(dateValue);
      }
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ""; }
  }

  if (regLoading) {
    return <div className="flex justify-center items-center h-[70vh]"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
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

  const isCurrentActivePossessor = registration.userId === user?.uid;
  const isCancelled = registration.status === 'cancelled' || registration.status === 'refunded' || registration.paymentStatus === 'refunded_wallet' || registration.status === 'Cancelado';
  const isPaid = registration.paymentStatus === "Pago" || registration.paymentStatus === "Disponível" || (registration.price || 0) === 0;

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-20 pt-6">
      <div className="flex items-center justify-between px-4">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-bold uppercase text-xs">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <div className="flex gap-2">
           <Button variant="outline" size="icon" className="rounded-full"><Share2 className="w-4 h-4" /></Button>
           {isCurrentActivePossessor && isPaid && !isCancelled && (
             <Button variant="outline" size="icon" className="rounded-full" onClick={() => window.print()}><Download className="w-4 h-4" /></Button>
           )}
        </div>
      </div>

      <div className="relative px-4">
        <Card className="overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-white print:shadow-none">
          <div className="relative h-48 bg-muted">
            <Image src={registration.eventImage || "https://picsum.photos/seed/event/800/600"} alt={registration.eventTitle} fill className="object-cover" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-6 left-8 right-6">
              <Badge className={cn("border-none text-[10px] font-black uppercase h-5", isCancelled ? "bg-destructive text-white" : "bg-secondary text-white")}>
                {isCancelled ? "Ingresso Inválido" : (registration.batchName || "Lote Único")}
              </Badge>
              <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-tight line-clamp-2 mt-2">
                {registration.eventTitle}
              </h1>
            </div>
          </div>

          <CardContent className="p-8 space-y-8 relative">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Data</p>
                <div className="flex items-center gap-2 font-bold text-xs text-primary">
                  <Calendar className="w-3.5 h-3.5 text-secondary" />
                  {formatDate(registration.eventDate)}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Horário</p>
                <div className="flex items-center gap-2 font-bold text-xs text-primary">
                  <Clock className="w-3.5 h-3.5 text-secondary" />
                  {formatTime(registration.eventDate)}
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
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Titular</p>
                  <div className="flex items-center gap-2 font-black text-base italic uppercase text-primary">
                    <User className="w-4 h-4 text-secondary" />
                    {registration.userName}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Categoria</p>
                  <p className="font-black text-sm text-primary uppercase">{registration.ticketTypeName || 'Acesso'}</p>
                </div>
              </div>

              <div className={cn(
                "flex flex-col items-center justify-center p-8 rounded-[2rem] gap-6 transition-all",
                isCurrentActivePossessor && !isCancelled ? "bg-muted/30" : "bg-orange-50 border-2 border-dashed border-orange-200"
              )}>
                <div className="p-4 bg-white rounded-3xl shadow-inner relative overflow-hidden">
                   <div className="w-48 h-48 relative flex items-center justify-center">
                      {isCurrentActivePossessor && isPaid && !isCancelled ? (
                        <QRCodeSVG 
                          value={JSON.stringify({
                             v: "3.0",
                             ev: registration.eventId,
                             reg: registration.id,
                             code: registration.ticketCode,
                             user: registration.userName
                          })} 
                          size={192}
                          level="H"
                        />
                      ) : (
                        <div className={cn("flex flex-col items-center gap-4 text-center", isCancelled ? "text-red-500" : "text-orange-500")}>
                          {isCancelled ? <XCircle className="w-16 h-16 opacity-30" /> : <Lock className="w-16 h-16 opacity-30" />}
                          <p className="text-[10px] font-black uppercase leading-tight">QR Code Indisponível</p>
                        </div>
                      )}
                   </div>
                </div>
                
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Código de Validação</p>
                  <p className={cn("text-xl font-mono font-black tracking-tighter", isCurrentActivePossessor && !isCancelled ? "text-secondary" : "text-muted-foreground/30")}>
                    {isCurrentActivePossessor && !isCancelled ? (registration.ticketCode || "---") : "****-****-****-****"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
