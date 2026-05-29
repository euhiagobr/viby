"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc, updateDoc, or, serverTimestamp, arrayUnion } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { 
  Loader2, 
  Ticket, 
  Calendar, 
  MapPin, 
  Clock, 
  QrCode, 
  User as UserIcon,
  CheckCircle2,
  Share2,
  History,
  XCircle,
  ArrowRight,
  Info,
  Mail,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  Send
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency, calculateRetainedGatewayFee, calculateRefundAmount } from "@/lib/financial-utils"
import { sendTicketEmail } from "@/app/actions/email"

export default function MeusIngressosPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  const registrationsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(
      collection(db, "registrations"), 
      or(
        where("userId", "==", user.uid),
        where("sharedWithUid", "==", user.uid)
      )
    )
  }, [db, user])

  const { data: registrations, loading: regLoading } = useCollection<any>(registrationsQuery)

  if (regLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  // Função auxiliar para comparar datas de compra (timestamp)
  const sortByPurchaseDate = (a: any, b: any) => {
    const timeA = a.timestamp?.seconds || a.createdAt?.seconds || 0;
    const timeB = b.timestamp?.seconds || b.createdAt?.seconds || 0;
    return timeB - timeA;
  };

  const pendingIncoming = (registrations || [])
    .filter(r => r.sharedWithUid === user?.uid && r.transferStatus === 'pending')
    .sort(sortByPurchaseDate);

  const myOwned = (registrations || [])
    .filter(r => 
      (r.userId === user?.uid && !r.sharedWithUid) || 
      (r.sharedWithUid === user?.uid && r.transferStatus === 'accepted')
    )
    .sort(sortByPurchaseDate);

  const myHistorical = (registrations || [])
    .filter(r => 
      r.userId === user?.uid && 
      r.sharedWithUid && 
      r.sharedWithUid !== user?.uid
    )
    .sort(sortByPurchaseDate);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Meus Ingressos</h1>
        <p className="text-muted-foreground font-medium">Sua coleção de experiências e o rastro de suas participações.</p>
      </div>

      {pendingIncoming.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-black uppercase tracking-widest text-secondary flex items-center gap-2">
               <CheckCircle2 className="w-4 h-4" /> Convites Recebidos ({pendingIncoming.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pendingIncoming.map((reg) => (
              <TicketListItem key={reg.id} registration={reg} isIncoming />
            ))}
          </div>
        </div>
      )}

      {(!registrations || registrations.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-border gap-6 shadow-sm">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
            <Ticket className="w-10 h-10 text-muted-foreground opacity-30" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-bold">Nenhum ingresso por aqui ainda.</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Explore os eventos e garanta sua presença.</p>
          </div>
          <Button asChild className="bg-secondary text-white font-black px-10 h-12 rounded-full shadow-lg">
            <Link href="/dashboard">Explorar Eventos</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-12">
           {myOwned.length > 0 && (
             <div className="space-y-4">
               <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Ticket className="w-4 h-4" /> Seus Ingressos Ativos
               </h2>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {myOwned.map((reg) => (
                   <TicketListItem key={reg.id} registration={reg} />
                 ))}
               </div>
             </div>
           )}

           {myHistorical.length > 0 && (
             <div className="space-y-4">
               <div className="flex flex-col gap-1">
                 <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <History className="w-4 h-4" /> Rastro de Transferências ({myHistorical.length})
                 </h2>
                 <p className="text-[10px] text-muted-foreground font-medium uppercase">Ingressos que você comprou e agora estão com outros participantes.</p>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {myHistorical.map((reg) => (
                   <TicketListItem key={reg.id} registration={reg} isHistorical />
                 ))}
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  )
}

function TicketListItem({ registration, isIncoming = false, isHistorical = false }: { registration: any, isIncoming?: boolean, isHistorical?: boolean }) {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isSendingEmail, setIsSendingEmail] = React.useState(false)
  const [isRefundDialogOpen, setIsRefundDialogOpen] = React.useState(false)

  const isCancelled = registration.status === 'cancelled' || registration.paymentStatus === 'refunded_wallet';
  const isPendingRefund = registration.refundStatus === 'requested';
  
  const totalPaid = registration.price || 0;
  const refundValue = registration.ticketBasePrice || 0;
  const adminFeeNotRefunded = (registration.price || 0) - (registration.ticketBasePrice || 0);

  const eventDate = registration.eventDate?.toDate ? registration.eventDate.toDate() : new Date(registration.eventDate);
  const isPastEvent = eventDate < new Date();

  const handleRequestRefund = async () => {
    if (!db || !registration.id) return;
    setIsSaving(true);
    try {
      const regRef = doc(db, "registrations", registration.id);
      await updateDoc(regRef, {
        refundStatus: 'requested',
        refundRequestedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast({ title: "Solicitação enviada!", description: "O organizador foi notificado e analisará seu pedido." });
      setIsRefundDialogOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao solicitar" });
    } finally {
      setIsSaving(false);
    }
  }

  const handleResendEmail = async () => {
    if (!registration || !user?.email) return
    setIsSendingEmail(true)
    try {
      const d = registration.eventDate?.toDate ? registration.eventDate.toDate() : new Date(registration.eventDate);
      const result = await sendTicketEmail({
        to: user.email,
        userName: registration.attendeeName || registration.userName || "Participante",
        eventTitle: registration.eventTitle,
        ticketCode: registration.ticketCode,
        eventDate: d.toLocaleString('pt-BR'),
        eventCity: registration.eventCity || "Local Confirmado",
        voucherUrl: `https://viby.club/dashboard/ingressos/${registration.id}/voucher`,
        eventUrl: `https://viby.club/${registration.organizerUsername || 'evento'}/${registration.eventId}`
      });
      if (result.success) toast({ title: "E-mail enviado!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro no envio" });
    } finally {
      setIsSendingEmail(false)
    }
  }

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "---";
    try {
      let d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return "---"; }
  }

  const getStatusBadge = () => {
    if (isCancelled) return <Badge className="bg-destructive text-white uppercase text-[9px] font-black h-5 px-2">Estornado</Badge>;
    if (isPendingRefund) return <Badge className="bg-orange-500 text-white uppercase text-[9px] font-black h-5 px-2">Estorno Solicitado</Badge>;
    if (isIncoming) return <Badge className="bg-secondary animate-pulse text-white uppercase text-[9px] font-black h-5 px-2">Aguardando Você</Badge>;
    if (isHistorical) return <Badge variant="outline" className="uppercase text-[9px] font-black h-5 px-2 text-blue-500 border-blue-200">Transferido</Badge>;
    return <Badge className="bg-green-500 text-white border-none text-[10px] font-black uppercase px-3">Ativo</Badge>;
  }

  return (
    <Card className={cn(
      "overflow-hidden border-none shadow-sm hover:shadow-md transition-all rounded-[1.5rem] bg-white flex flex-col sm:flex-row group",
      isCancelled && "opacity-60 grayscale"
    )}>
      <div className="relative w-full sm:w-44 h-40 sm:h-auto bg-muted">
        <Image src={registration.eventImage || "https://picsum.photos/seed/event/600/400"} alt="Evento" fill className="object-cover" unoptimized />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3">{getStatusBadge()}</div>
      </div>
      
      <CardContent className="p-6 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <h3 className="font-black text-lg leading-tight uppercase italic tracking-tighter group-hover:text-secondary transition-colors">
            {registration.eventTitle}
          </h3>
          <div className="space-y-1.5 text-[10px] font-black uppercase text-muted-foreground tracking-tight">
            <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-secondary" /> {formatDate(registration.eventDate)}</div>
            <div className="flex items-center gap-2 font-bold text-primary"><UserIcon className="w-3 h-3 text-muted-foreground" /> {registration.attendeeName || registration.userName}</div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-dashed border-border/60">
          <span className="text-sm font-black text-primary">{formatCurrency(registration.price || 0)}</span>
          
          <div className="flex gap-2">
            {!isCancelled && !isHistorical && !isIncoming && (
              <>
                <Button size="sm" variant="outline" onClick={handleResendEmail} title="Reenviar Voucher" disabled={isSendingEmail} className="h-9 px-3 text-[10px] font-black uppercase rounded-xl border-secondary text-secondary">
                  {isSendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                </Button>

                {!isPastEvent && !registration.checkedIn && !isPendingRefund && (
                  <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-9 px-3 text-[10px] font-black uppercase rounded-xl text-destructive hover:bg-red-50">
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Solicitar Estorno
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[2.5rem] max-w-sm">
                      <DialogHeader>
                        <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-500">
                            <Send className="w-8 h-8" />
                        </div>
                        <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center">Solicitar Reembolso</DialogTitle>
                        <DialogDescription className="text-center font-medium">O organizador do evento analisará seu pedido conforme a política do evento.</DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-4">
                        <div className="p-4 bg-muted/30 rounded-2xl space-y-2">
                            <div className="flex justify-between text-xs font-bold uppercase opacity-60"><span>Valor Pago</span> <span>{formatCurrency(totalPaid)}</span></div>
                            <div className="flex justify-between text-xs font-black text-red-500"><span>Taxa de Serviço</span> <span>-{formatCurrency(adminFeeNotRefunded)}</span></div>
                            <Separator className="border-dashed" />
                            <div className="flex justify-between items-center"><span className="text-sm font-black uppercase italic text-primary">Previsão de Estorno</span> <span className="text-xl font-black text-green-600">{formatCurrency(refundValue)}</span></div>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-xl flex gap-2">
                            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-[9px] text-blue-800 font-bold uppercase leading-tight">O estorno não é automático. Caso aprovado, o saldo cairá na sua carteira Viby.</p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleRequestRefund} disabled={isSaving} className="w-full bg-primary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Enviar Solicitação"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                <Button size="sm" className="h-9 px-4 text-[10px] font-black uppercase rounded-xl bg-primary text-white" asChild>
                  <Link href={`/dashboard/ingressos/${registration.id}/voucher`}><QrCode className="w-3.5 h-3.5 mr-1.5" /> Voucher</Link>
                </Button>
              </>
            )}
            
            {isPendingRefund && (
              <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-600 rounded-xl border border-orange-100">
                <Clock className="w-3 h-3 animate-pulse" />
                <span className="text-[9px] font-black uppercase">Em análise</span>
              </div>
            )}

            {isPastEvent && !isCancelled && (
              <Badge variant="secondary" className="h-9 rounded-xl px-4 font-black uppercase text-[9px] opacity-40">Evento Passado</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
