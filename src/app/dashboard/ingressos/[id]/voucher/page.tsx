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
  Download,
  Share2,
  AlertCircle,
  XCircle,
  ShieldCheck
} from "lucide-react"
import Image from "next/image"
import { QRCodeSVG } from "qrcode.react"
import { cn } from "@/lib/utils"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"

export default function VoucherPage() {
  const params = useParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { formatPriceWithOriginal } = useCurrency()
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
        d = new Date(dateValue.includes('T') ? dateValue : `${dateValue}T12:00:00`);
      } else {
        d = new Date(dateValue);
      }
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) { return "Data Inválida"; }
  }

  const formatTime = (dateValue: any) => {
    if (!dateValue) return "---";
    try {
      let d: Date = (typeof dateValue === 'object' && 'seconds' in dateValue) 
        ? new Date(dateValue.seconds * 1000) 
        : new Date(dateValue);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ""; }
  }

  if (regLoading) return <div className="flex justify-center items-center h-[70vh]"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  if (!registration) return (
    <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
      <AlertCircle className="w-12 h-12 text-destructive opacity-50" />
      <h2 className="text-xl font-bold">Voucher não encontrado</h2>
      <Button onClick={() => router.push('/dashboard/ingressos')}>Voltar</Button>
    </div>
  )

  const isCancelled = registration.status === 'cancelled' || registration.status === 'refunded' || registration.status === 'Cancelado';
  const isUsed = registration.status === 'used' || registration.checkedIn === true;
  const canShowQR = registration.userId === user?.uid && !isCancelled;

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-20 pt-6 px-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-bold uppercase text-xs">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <div className="flex gap-2">
           <Button variant="outline" size="icon" className="rounded-full h-10 w-10">
              <Share2 className="w-4 h-4" />
           </Button>
           {canShowQR && !isUsed && (
             <Button variant="outline" size="icon" className="rounded-full" onClick={() => window.print()}>
                <Download className="w-4 h-4" />
             </Button>
           )}
        </div>
      </div>

      <Card className="overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-white print:shadow-none">
        <div className="relative h-48 bg-muted">
          <Image src={registration.eventImage || "https://picsum.photos/seed/event/800/600"} alt={registration.eventTitle} fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-6 left-8">
            <Badge className={cn("text-[10px] font-black uppercase px-3 h-5 border-none shadow-lg", isCancelled ? "bg-destructive text-white" : isUsed ? "bg-primary text-white" : "bg-secondary text-white")}>
              {isCancelled ? "Cancelado" : isUsed ? "Utilizado" : (registration.batchName || "Ativo")}
            </Badge>
            <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter mt-2 line-clamp-2">{registration.eventTitle}</h1>
          </div>
        </div>

        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Data</p>
              <div className="flex items-center gap-2 font-bold text-xs text-primary"><Calendar className="w-3.5 h-3.5 text-secondary" /> {formatDate(registration.eventDate)}</div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Horário</p>
              <div className="flex items-center gap-2 font-bold text-xs text-primary"><Clock className="w-3.5 h-3.5 text-secondary" /> {formatTime(registration.eventDate)}</div>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Local</p>
            <div className="flex items-start gap-2 font-bold text-sm text-primary"><MapPin className="w-3.5 h-3.5 text-secondary shrink-0 mt-0.5" /> <span className="line-clamp-1">{registration.eventCity}</span></div>
          </div>

          <div className="pt-6 border-t border-dashed border-border/60 space-y-6">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Titular do Ingresso</p>
                <div className="flex items-center gap-2 font-black text-base italic uppercase text-primary"><User className="w-4 h-4 text-secondary" /> {registration.userName}</div>
              </div>
              <div className="text-right">
                <p className="font-black text-[10px] text-muted-foreground uppercase opacity-60 mb-1">{registration.ticketTypeName || 'Acesso'}</p>
                {formatPriceWithOriginal(registration.price || 0, (registration.currency || 'BRL') as CurrencyCode)}
              </div>
            </div>

            <div className={cn(
              "flex flex-col items-center justify-center p-10 rounded-[3rem] gap-6 transition-all",
              canShowQR && !isUsed ? "bg-muted/30" : "bg-orange-50 border-2 border-dashed border-orange-200"
            )}>
              <div className="p-5 bg-white rounded-[2rem] shadow-xl relative overflow-hidden">
                <div className="w-48 h-48 flex items-center justify-center">
                  {canShowQR && !isUsed ? (
                    <QRCodeSVG 
                      value={registration.ticketCode} 
                      size={192}
                      level="H"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-center opacity-40">
                      {isCancelled ? <XCircle className="w-16 h-16" /> : <Lock className="w-16 h-16" />}
                      <p className="text-[9px] font-black uppercase">Voucher Inválido</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="text-center space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">CÓDIGO DE ACESSO</p>
                <p className={cn("text-2xl font-mono font-black tracking-tighter", canShowQR ? "text-primary" : "text-muted-foreground/30")}>
                  {canShowQR ? registration.ticketCode : "****-****-****-****"}
                </p>
              </div>
            </div>

            {isUsed && (
               <div className="flex items-center justify-center gap-2 p-4 bg-green-50 rounded-2xl border border-green-100 text-green-600 animate-in fade-in">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Check-in realizado com sucesso</span>
               </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
