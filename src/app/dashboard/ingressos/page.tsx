"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, orderBy } from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Loader2, 
  Ticket, 
  Calendar, 
  CheckCircle2, 
  QrCode, 
  Mail, 
  XCircle,
  RotateCcw,
  Clock,
  Star
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { hasEventEnded } from "@/lib/ticket-expiry"
import { resendTicketAction } from "@/app/actions/tickets"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"
import { ReviewModal } from "@/components/experiences/ReviewModal"
import { TransferTicketModal } from "@/components/tickets/TransferTicketModal"
import { TicketTransferCard } from "@/components/tickets/TicketTransferCard"
import { Send } from "lucide-react"

export default function MeusIngressosPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user, profile } = useUser(auth)
  const [transferModalOpen, setTransferModalOpen] = React.useState(false)
  const [selectedRegistration, setSelectedRegistration] = React.useState<any>(null)
  const [refreshKey, setRefreshKey] = React.useState(0)

  const registrationsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(
      collection(db, "registrations"), 
      where("userId", "==", user.uid)
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

  const isAdmin = profile?.role === 'admin';

  const myOwned = (registrations || []).sort((a, b) => {
    const timeA = a.timestamp?.seconds || a.createdAt?.seconds || 0;
    const timeB = b.timestamp?.seconds || b.createdAt?.seconds || 0;
    return timeB - timeA;
  });

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Meus Ingressos</h1>
        <p className="text-muted-foreground font-medium">Sua coleção de experiências e histórico de acessos.</p>
      </div>

      {/* Seção de Transferências Pendentes */}
      {user && <TransfersPendingSection userId={user.uid} refreshKey={refreshKey} />}

      {myOwned.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-border gap-6 shadow-sm">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
            <Ticket className="w-10 h-10 text-muted-foreground opacity-30" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-bold">Nenhum ingresso encontrado.</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Suas experiências e vouchers aparecerão aqui após a reserva.</p>
          </div>
          <Button asChild className="bg-secondary text-white font-black px-10 h-12 rounded-full shadow-lg">
            <Link href="/dashboard">Explorar Eventos</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {myOwned.map((reg) => (
            <TicketListItem 
              key={reg.id} 
              registration={reg} 
              isAdmin={isAdmin}
              onTransferClick={() => {
                setSelectedRegistration(reg)
                setTransferModalOpen(true)
              }}
            />
          ))}
        </div>
      )}

      {/* Transfer Modal */}
      {selectedRegistration && user && (
        <TransferTicketModal
          isOpen={transferModalOpen}
          onOpenChange={setTransferModalOpen}
          registrationId={selectedRegistration.id}
          userId={user.uid}
          eventTitle={selectedRegistration.eventTitle}
          userCountry={profile?.country || 'BR'}
          onSuccess={() => {
            setTransferModalOpen(false)
            setSelectedRegistration(null)
            setRefreshKey(prev => prev + 1)
          }}
        />
      )}
    </div>
  )
}

function TransfersPendingSection({ userId, refreshKey }: { userId: string, refreshKey: number }) {
  const db = useFirestore()

  const transfersQuery = useMemoFirebase(() => {
    if (!db || !userId) return null
    return query(
      collection(db, "ticket_transfers"),
      where("status", "==", "pending")
    )
  }, [db, userId, refreshKey])

  const { data: allTransfers, loading: transfersLoading } = useCollection<any>(transfersQuery)

  if (transfersLoading) return null
  if (!allTransfers || allTransfers.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-black uppercase italic text-primary">Transferências Recebidas</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {allTransfers.map((transfer) => (
          <TicketTransferCard
            key={transfer.id}
            transfer={transfer}
            userId={userId}
            onActionSuccess={() => {
              // Refresh happens through Firestore subscription
            }}
          />
        ))}
      </div>
    </div>
  )
}

function TicketListItem({ registration, isAdmin, onTransferClick }: { registration: any, isAdmin: boolean, onTransferClick?: () => void }) {
  const { formatPriceWithOriginal } = useCurrency()
  const [isSendingEmail, setIsSendingEmail] = React.useState(false)
  const [isReviewOpen, setIsReviewOpen] = React.useState(false)

  const isRefunded = registration.status === 'refunded' || registration.paymentStatus === 'Estornado' || registration.paymentStatus === 'refunded_wallet';
  const isCancelled = registration.status === 'cancelled' || registration.paymentStatus === 'Cancelado';
  const isCheckedIn = registration.checkedIn === true;
  const isPending = registration.paymentStatus === 'Pendente';
  
  // Validar se evento já terminou (mas NUNCA se já foi utilizado)
  const eventEndDate = registration.eventEndDate || registration.eventDate;
  const eventEndTime = registration.eventEndTime;
  const isExpired = React.useMemo(() => {
    // PRIORIDADE: Se foi utilizado, nunca é expirado
    if (isCheckedIn) return false;
    return eventEndDate ? hasEventEnded(eventEndDate, eventEndTime) : false;
  }, [eventEndDate, eventEndTime, isCheckedIn]);

  const canReview = React.useMemo(() => {
    if (isRefunded || isCancelled || isExpired || registration.ratingSubmitted) return false;
    if (registration.productType !== 'experience') return false;
    
    // MODO TESTE: Administradores podem avaliar a qualquer momento
    if (isAdmin) return true;

    if (!isCheckedIn) return false;

    // Regra das 24h para usuários comuns
    const checkinDate = registration.checkedInAt?.toDate ? registration.checkedInAt.toDate() : new Date(registration.checkedInAt);
    const now = new Date();
    const diff = now.getTime() - checkinDate.getTime();
    return diff >= 24 * 60 * 60 * 1000;
  }, [isCheckedIn, isRefunded, isCancelled, isExpired, registration, isAdmin]);

  const handleResend = async () => {
    if (isRefunded || isCancelled || isExpired || isSendingEmail) return;
    setIsSendingEmail(true);
    try {
      const result = await resendTicketAction(registration.id);
      if (result.success) {
        toast({ title: "Voucher reenviado!", description: "Verifique sua caixa de entrada." });
      } else throw new Error(result.error);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro no envio" });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const dateValue = registration.eventDate?.seconds * 1000 || registration.eventDate;
  const eventDateObj = new Date(dateValue);

  return (
    <Card className={cn(
      "overflow-hidden border-none shadow-sm transition-all rounded-[1.5rem] bg-white flex flex-col sm:flex-row group",
      (isRefunded || isCancelled || isExpired) && "opacity-60 grayscale-[0.5] bg-muted/20"
    )}>
      <div className="relative w-full sm:w-44 h-40 sm:h-auto bg-muted">
        <Image 
          src={registration.eventImage || "https://picsum.photos/seed/event/600/400"} 
          alt="Evento" 
          fill 
          className="object-cover transition-transform group-hover:scale-105" 
          unoptimized 
        />
        <div className="absolute bottom-3 left-3">
           <Badge className={cn(
             "border-none text-[10px] font-black uppercase px-3 shadow-md",
             isExpired ? "bg-slate-400 text-white" :
             isRefunded ? "bg-red-500 text-white" : 
             isCancelled ? "bg-slate-600 text-white" :
             isCheckedIn ? "bg-primary text-white" :
             isPending ? "bg-orange-50 text-orange-600" :
             "bg-green-600 text-white"
           )}>
             {isExpired ? "Expirado" : isRefunded ? "Estornado" : isCancelled ? "Cancelado" : isCheckedIn ? "Utilizado" : isPending ? "Pendente" : "Confirmado"}
           </Badge>
        </div>
      </div>
      
      <CardContent className="p-6 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <h3 className={cn(
              "font-black text-lg leading-tight uppercase italic text-primary leading-tight line-clamp-2",
              !(isRefunded || isCancelled || isExpired) && "group-hover:text-secondary"
            )}>
              {registration.eventTitle}
            </h3>
            {registration.ratingSubmitted && (
               <div className="flex items-center gap-1 text-orange-400">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span className="text-[10px] font-black">{registration.ratingValue}.0</span>
               </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] font-black uppercase text-muted-foreground tracking-tight">
             <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-secondary" />
                {eventDateObj.toLocaleDateString('pt-BR')}
             </div>
             <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-secondary" />
                {eventDateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
             </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-dashed border-border/60">
          <div className="text-sm">
            {(isRefunded || isCancelled) ? (
              <span className="text-muted-foreground font-bold uppercase text-[10px]">Reserva Invalida</span>
            ) : (
              formatPriceWithOriginal(registration.price || 0, (registration.currency || 'BRL') as CurrencyCode)
            )}
          </div>
          <div className="flex gap-2">
            {canReview && (
              <Button size="sm" onClick={() => setIsReviewOpen(true)} className="h-9 px-4 bg-orange-500 text-white font-black uppercase italic text-[9px] rounded-xl shadow-lg">
                <Star className="w-3 h-3 mr-1.5 fill-current" /> Avaliar Experiência
              </Button>
            )}
            {!(isRefunded || isCancelled || isExpired) && !isPending && (
              <>
                <Button size="sm" onClick={onTransferClick} className="h-9 px-3 text-[10px] font-black uppercase rounded-xl bg-secondary text-white hover:bg-secondary/90">
                  <Send className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={handleResend} disabled={isSendingEmail} className="h-9 px-3 text-[10px] font-black uppercase rounded-xl border-secondary text-secondary">
                  {isSendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                </Button>
              </>
            )}
            <Button size="sm" className={cn(
              "h-9 px-4 text-[10px] font-black uppercase rounded-xl",
              (isRefunded || isCancelled || isExpired) ? "bg-muted text-muted-foreground" : "bg-primary text-white"
            )} asChild={!(isRefunded || isCancelled || isExpired)}>
              {(isRefunded || isCancelled || isExpired) ? (
                <span className="flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Inválido</span>
              ) : (
                <Link href={`/dashboard/ingressos/${registration.id}/voucher`}>
                  <QrCode className="w-3.5 h-3.5 mr-1.5" /> Voucher
                </Link>
              )}
            </Button>
          </div>
        </div>
      </CardContent>

      <ReviewModal 
        isOpen={isReviewOpen} 
        onOpenChange={setIsReviewOpen} 
        registration={registration} 
      />
    </Card>
  )
}