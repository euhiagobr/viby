"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser } from "@/firebase"
import { doc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { hasEventEnded } from "@/lib/ticket-expiry"
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
  ShieldCheck,
  ShieldAlert,
  Info,
  Lock as LockIcon
} from "lucide-react"
import Image from "next/image"
import { QRCodeSVG } from "qrcode.react"
import { cn, safeParseDate } from "@/lib/utils"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"
import { RichText } from "@/components/ui/rich-text"
import { Separator } from "@/components/ui/separator"
import { requestBuyerRefundRequest, getBuyerRefundRequestState } from "@/app/actions/cdc-refund"
import { toast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

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
  const [showRefundDialog, setShowRefundDialog] = React.useState(false)
  const [submittingRefundRequest, setSubmittingRefundRequest] = React.useState(false)
  const [refundStateLoading, setRefundStateLoading] = React.useState(true)
  const [refundRequestState, setRefundRequestState] = React.useState<{ eligible: boolean; hasRequest: boolean; status: string | null; message: string | null }>({ eligible: false, hasRequest: false, status: null, message: null })

  const eventRef = React.useMemo(() => {
    if (!db || !registration?.eventId) return null;
    const coll = registration.productType === 'experience' ? 'experiences' : 'events';
    return doc(db, coll, registration.eventId);
  }, [db, registration?.eventId, registration?.productType]);

  const { data: eventDetails } = useDoc<any>(eventRef);

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

  const isCancelled = registration?.status === 'cancelled' || registration?.status === 'refunded' || registration?.status === 'Cancelado' || registration?.paymentStatus === 'Estornado';
  const isUsed = registration?.status === 'used' || registration?.checkedIn === true;
  const eventEndDate = registration?.eventEndDate || registration?.eventDate;
  const eventEndTime = registration?.eventEndTime;
  const isExpired = (() => {
    if (isUsed) return false;
    return eventEndDate ? hasEventEnded(eventEndDate, eventEndTime) : false;
  })();

  React.useEffect(() => {
    if (!regId) return;

    const loadState = async () => {
      setRefundStateLoading(true);
      const state = await getBuyerRefundRequestState(regId, user?.uid);
      setRefundRequestState({
        eligible: state.eligible,
        hasRequest: state.hasRequest,
        status: state.status,
        message: state.message
      });
      setRefundStateLoading(false);
    };

    loadState();
  }, [regId, user?.uid, registration?.id]);

  const hasRefundRequest = refundRequestState.hasRequest;
  const isPaidTicket = React.useMemo(() => {
    const amount = Number(registration?.price || 0);
    const paymentStatus = String(registration?.paymentStatus || '').toLowerCase();
    return amount > 0 || paymentStatus === 'pago' || paymentStatus === 'paid' || paymentStatus === 'succeeded' || paymentStatus === 'completed' || Boolean(registration?.stripeSessionId);
  }, [registration?.price, registration?.paymentStatus, registration?.stripeSessionId]);
  const showRefundActionArea = React.useMemo(() => {
    if (!registration || isCancelled || isUsed || isExpired || !registration.userId || registration.userId !== user?.uid) return false;
    return isPaidTicket;
  }, [registration, isCancelled, isUsed, isExpired, user?.uid, isPaidTicket]);
  const canRequestRefund = React.useMemo(() => {
    if (!registration || !isPaidTicket || hasRefundRequest || isCancelled || isUsed || isExpired) return false;
    return refundRequestState.eligible;
  }, [registration, isPaidTicket, hasRefundRequest, isCancelled, isUsed, isExpired, refundRequestState.eligible]);

  if (regLoading) return <div className="flex justify-center items-center h-[70vh]"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>

  if (!registration) return (
    <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
      <AlertCircle className="w-12 h-12 text-destructive opacity-50" />
      <h2 className="text-xl font-bold">Voucher não encontrado</h2>
      <Button onClick={() => router.push('/dashboard/ingressos')}>Voltar</Button>
    </div>
  )

  const canShowQR = registration.userId === user?.uid && !isCancelled && !isExpired && !isUsed;

  const handleRefundRequest = async () => {
    if (!regId || !user?.uid) return;

    setSubmittingRefundRequest(true);

    try {
      const result = await requestBuyerRefundRequest(regId, user.uid, 'Solicitação de reembolso feita pelo comprador.');

      if (result.success) {
        toast({
          title: 'Solicitação enviada',
          description: result.message
        });
        const state = await getBuyerRefundRequestState(regId, user.uid);
        setRefundRequestState({
          eligible: state.eligible,
          hasRequest: state.hasRequest,
          status: state.status,
          message: state.message
        });
        setRefundStateLoading(false);
        setShowRefundDialog(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Não foi possível concluir',
          description: result.message
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro inesperado',
        description: 'Tente novamente em alguns instantes.'
      });
    } finally {
      setSubmittingRefundRequest(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 pt-6 px-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LADO ESQUERDO: VOUCHER */}
        <div className="lg:col-span-6">
          <Card className="overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-white print:shadow-none">
            <div className="relative h-48 bg-muted">
              <Image src={registration.eventImage || "https://picsum.photos/seed/event/800/600"} alt={registration.eventTitle} fill className="object-cover" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-6 left-8">
                <Badge className={cn("text-[10px] font-black uppercase px-3 h-5 border-none shadow-lg", isExpired ? "bg-slate-400 text-white" : isCancelled ? "bg-destructive text-white" : isUsed ? "bg-primary text-white" : "bg-secondary text-white")}>
                  {isExpired ? "Expirado" : isCancelled ? "Cancelado" : isUsed ? "Utilizado" : (registration.batchName || "Ativo")}
                </Badge>
                <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter mt-2 line-clamp-2">{registration.eventTitle}</h1>
              </div>
            </div>

            <CardContent className="p-8 space-y-8">
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
                          {isCancelled ? <XCircle className="w-16 h-16" /> : <LockIcon className="w-16 h-16" />}
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

        {/* LADO DIREITO: REGRAS E INFO */}
        <div className="lg:col-span-6 space-y-8">
           <div className="space-y-6">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground px-2 flex items-center gap-2">
                 <ShieldAlert className="w-4 h-4 text-secondary" /> Regras e Políticas
              </h2>
              <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8">
                 {eventDetails?.usagePolicy ? (
                   <RichText content={eventDetails.usagePolicy} className="text-sm font-medium text-muted-foreground leading-relaxed" />
                 ) : (
                   <div className="text-center py-6 opacity-30 italic text-xs uppercase font-bold">Nenhuma regra específica informada.</div>
                 )}
              </Card>
           </div>

           <div className="space-y-6">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground px-2 flex items-center gap-2">
                 <Info className="w-4 h-4 text-secondary" /> Informações Úteis
              </h2>
              <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8">
                 {eventDetails?.additionalInfo ? (
                   <RichText content={eventDetails.additionalInfo} className="text-sm font-medium text-muted-foreground leading-relaxed" />
                 ) : (
                   <div className="text-center py-6 opacity-30 italic text-xs uppercase font-bold">Nenhuma informação adicional.</div>
                 )}
              </Card>
           </div>

           {(showRefundActionArea || hasRefundRequest) && (
             <div className="p-6 bg-orange-50 rounded-3xl border border-orange-200 flex items-start gap-4">
               <AlertCircle className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
               <div className="space-y-3 flex-1">
                 <div>
                   <h4 className="font-black uppercase text-[10px] tracking-widest text-orange-700 italic">
                     {hasRefundRequest ? 'Solicitação de reembolso enviada' : refundStateLoading ? 'Verificando reembolso' : canRequestRefund ? 'Reembolso' : 'Reembolso indisponível'}
                   </h4>
                   <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase mt-1">
                     {hasRefundRequest
                      ? 'O pedido já foi registrado e está aguardando análise do organizador.'
                      : refundStateLoading
                        ? 'Estamos verificando se este ingresso ainda está elegível para reembolso.'
                        : canRequestRefund
                          ? 'Você pode solicitar o reembolso para este ingresso. A solicitação será enviada ao organizador para análise e ainda não executa um estorno automático nesta etapa.'
                          : refundRequestState.message || 'Não é possível solicitar reembolso para este ingresso neste momento.'}
                   </p>
                 </div>
                 {!refundStateLoading && !hasRefundRequest && canRequestRefund && (
                   <Button onClick={() => setShowRefundDialog(true)} className="rounded-full bg-secondary hover:bg-secondary/90 text-white font-black uppercase text-[10px] h-10">
                     Solicitar reembolso
                   </Button>
                 )}
               </div>
             </div>
           )}

           {hasRefundRequest && (
             <div className="p-6 bg-amber-50 rounded-3xl border border-amber-200 flex items-start gap-4">
               <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
               <div className="space-y-1">
                 <h4 className="font-black uppercase text-[10px] tracking-widest text-amber-700 italic">Solicitação de reembolso enviada</h4>
                 <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase">
                   O pedido já foi registrado e está aguardando análise do organizador.
                 </p>
               </div>
             </div>
           )}

           <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
              <ShieldCheck className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary italic">Ingresso Digital Viby</h4>
                 <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase">
                    Este é um documento oficial de acesso. Ele é pessoal e intransferível após a validação. Mantenha o QR Code em segurança e não o compartilhe com terceiros.
                 </p>
              </div>
           </div>
        </div>
      </div>

      <AlertDialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-orange-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl font-black uppercase italic tracking-tighter text-primary">
              Solicitar reembolso
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center font-medium">
              Esta solicitação será registrada para análise do organizador. Não será feito um estorno automático agora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-3">
            <AlertDialogCancel disabled={submittingRefundRequest} className="rounded-xl font-bold uppercase text-[10px] h-12 mt-0">
              Cancelar
            </AlertDialogCancel>
            <Button onClick={handleRefundRequest} disabled={submittingRefundRequest} className="rounded-xl font-black uppercase text-[10px] h-12 bg-secondary">
              {submittingRefundRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
