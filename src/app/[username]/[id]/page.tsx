
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { doc, addDoc, collection, serverTimestamp, query, where } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
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
  AlertTriangle,
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  Layers
} from "lucide-react"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { generateUniqueTicketCode } from "@/lib/ticket-utils"
import { cn } from "@/lib/utils"
import { calculateFinancialBreakdown, formatCurrency } from "@/lib/financial-utils"
import { createCheckoutSession } from "@/app/actions/stripe"
import { sendTicketEmail } from "@/app/actions/email"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Footer from "@/components/layout/Footer"

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
  
  const organizationRef = React.useMemo(() => (db && event?.organizationId) ? doc(db, "organizations", event.organizationId) : null, [db, event?.organizationId])
  const { data: organizationProfile } = useDoc<any>(organizationRef)

  const ownerRef = React.useMemo(() => (db && event?.organizerId) ? doc(db, "users", event.organizerId) : null, [db, event?.organizerId])
  const { data: ownerProfile } = useDoc<any>(ownerRef)

  const currentUserRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: currentUserProfile } = useDoc<any>(currentUserRef)

  const availabilityQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(collection(db, "registrations"), where("eventId", "==", eventId))
  }, [db, eventId])
  const { data: allRegistrations } = useCollection<any>(availabilityQuery)

  const [registering, setRegistering] = React.useState(false)
  const [activeBatch, setActiveBatch] = React.useState<any>(null)
  const [selectedTicketType, setSelectedTicketType] = React.useState<any>(null)
  const [saleStatus, setSaleStatus] = React.useState<'open' | 'pending' | 'ended' | 'soldout'>('pending')
  const [isCheckoutOpen, setIsCheckoutOpen] = React.useState(false)

  React.useEffect(() => {
    if (!event) return

    const checkAvailability = () => {
      const now = new Date()
      const batches = event.batches || []
      
      const salesPerType = (allRegistrations || []).reduce((acc: any, reg: any) => {
        if (['Pago', 'Disponível'].includes(reg.paymentStatus)) {
          const tKey = `${reg.batchId}_${reg.ticketTypeId}`
          acc.types[tKey] = (acc.types[tKey] || 0) + 1
          
          if (reg.poolId) {
            const pKey = `${reg.batchId}_${reg.poolId}`
            acc.pools[pKey] = (acc.pools[pKey] || 0) + 1
          }
        }
        return acc
      }, { types: {}, pools: {} })

      let foundActiveBatch = null
      let status: 'open' | 'pending' | 'ended' | 'soldout' = 'ended'
      let hasUpcoming = false

      for (const batch of batches) {
        const start = batch.startDate ? new Date(batch.startDate) : null
        const end = batch.endDate ? new Date(batch.endDate) : null
        const isStarted = !start || now >= start
        const isNotEnded = !end || now <= end

        if (!isStarted) {
          hasUpcoming = true
          continue
        }

        if (isStarted && isNotEnded) {
          const typesWithStock = batch.ticketTypes.map((t: any) => {
            const sold = t.poolId ? (salesPerType.pools[`${batch.id}_${t.poolId}`] || 0) : (salesPerType.types[`${batch.id}_${t.id}`] || 0)
            const remaining = Math.max(0, (t.quantity || 0) - sold)
            return { ...t, remaining }
          }).filter((t: any) => t.remaining > 0)

          if (typesWithStock.length > 0) {
            foundActiveBatch = { ...batch, ticketTypes: typesWithStock }
            status = 'open'
            break
          } else {
            status = 'soldout'
            continue
          }
        }
      }

      setActiveBatch(foundActiveBatch)
      setSaleStatus(status === 'ended' && hasUpcoming ? 'pending' : status)
    }

    checkAvailability()
  }, [event, allRegistrations])

  const breakdown = React.useMemo(() => {
    return calculateFinancialBreakdown(selectedTicketType?.price || 0, ownerProfile?.plan || 'free');
  }, [selectedTicketType, ownerProfile?.plan]);

  const handleRegisterInterest = async () => {
    if (!user) return router.push("/login")
    if (!db || !eventId || !event || !selectedTicketType) return

    setRegistering(true)
    try {
      const ticketCode = await generateUniqueTicketCode(db);
      const userName = currentUserProfile?.name || user.displayName || user.email || "Usuário";
      const regData = {
        eventId, eventTitle: event.title, eventImage: event.image || "", eventDate: event.date, eventCity: event.city || "",
        userId: user.uid, userName, userEmail: user.email, attendeeName: userName, attendeeCPF: "",
        userGender: currentUserProfile?.gender || "Não informado", userBirthDate: currentUserProfile?.birthDate || "",
        organizationId: event.organizationId, organizerId: event.organizerId, organizerUsername: usernameFromUrl,
        ticketBasePrice: breakdown.ticketBasePrice, price: breakdown.customerFinalPrice, 
        administrativeFeeAmount: breakdown.administrativeFeeAmount, producerFeeAmount: breakdown.producerFeeAmount, producerNetAmount: breakdown.producerNetAmount,
        financialBreakdown: breakdown, batchId: activeBatch.id, batchName: activeBatch.name,
        ticketTypeId: selectedTicketType.id, ticketTypeName: selectedTicketType.name,
        poolId: selectedTicketType.poolId || null, poolName: selectedTicketType.poolName || null,
        checkedIn: false, paymentStatus: breakdown.customerFinalPrice === 0 ? "Disponível" : "Pendente",
        ticketCode, status: "Ativo", purchaseType: breakdown.customerFinalPrice === 0 ? "free" : "paid",
        createdAt: serverTimestamp(), timestamp: serverTimestamp()
      }

      if (breakdown.customerFinalPrice > 0) {
        const docRef = await addDoc(collection(db, "registrations"), regData);
        const { url } = await createCheckoutSession({
          eventId, eventTitle: event.title, eventImage: event.image || "",
          userId: user.uid, userName: regData.userName, userEmail: user.email!,
          totalAmount: Math.round(breakdown.customerFinalPrice * 100),
          metadata: { registrationId: docRef.id, eventId, userId: user.uid, ticketCode, ticketTypeName: regData.ticketTypeName }
        });
        if (url) window.location.href = url;
      } else {
        const newDocRef = await addDoc(collection(db, "registrations"), { ...regData, paymentStatus: "Disponível" })
        await sendTicketEmail({
          to: regData.userEmail!, userName: regData.attendeeName, eventTitle: regData.eventTitle, ticketCode: regData.ticketCode,
          eventDate: new Date(regData.eventDate).toLocaleString('pt-BR'), eventCity: regData.eventCity,
          voucherUrl: `https://viby.club/dashboard/ingressos/${newDocRef.id}/voucher`, eventUrl: `https://viby.club/${usernameFromUrl}/${eventId}`
        });
        setIsCheckoutOpen(false); toast({ title: "Reserva confirmada!" });
      }
    } catch (e: any) { toast({ variant: "destructive", title: "Erro", description: e.message }) }
    finally { setRegistering(false) }
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  if (!event) return <div className="flex flex-col items-center py-20"><h2 className="text-2xl font-bold">Evento não encontrado</h2></div>

  const orgName = organizationProfile?.name || event.organizer?.name || "Organizador";
  const orgAvatar = organizationProfile?.avatar || event.organizer?.avatar;
  const isVerified = organizationProfile?.verified ?? event.organizer?.isVerified;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <div className="max-w-6xl mx-auto px-4 pt-10 space-y-8 flex-1 w-full">
        <div className="flex items-center justify-between">
           <Button variant="ghost" onClick={() => router.back()} className="rounded-full font-bold text-xs uppercase gap-2">
              <ArrowLeft className="w-4 h-4" /> Voltar
           </Button>
           <div className="flex gap-2">
              <Button variant="outline" size="icon" className="rounded-full h-10 w-10"><Share2 className="w-4 h-4" /></Button>
           </div>
        </div>

        <div className="relative h-[300px] md:h-[450px] w-full rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white">
          <Image src={event.image || "https://picsum.photos/seed/event/1200/800"} alt={event.title} fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          <div className="absolute bottom-10 left-10 text-white space-y-4 pr-10">
             <div className="flex flex-wrap gap-2">
                <Badge className="bg-secondary px-4 py-1 rounded-full uppercase font-black tracking-widest">{event.categoryName || "Geral"}</Badge>
             </div>
             <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-[0.9]">{event.title}</h1>
             <div className="flex flex-wrap items-center gap-6 text-sm font-bold opacity-80">
                <span className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full"><MapPin className="w-4 h-4 text-secondary" /> {event.city}</span>
                <span className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full"><Calendar className="w-4 h-4 text-secondary" /> {new Date(event.date).toLocaleDateString('pt-BR')}</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           <div className="lg:col-span-8 space-y-8">
              <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
                 <CardHeader className="bg-muted/30 pb-4"><CardTitle className="flex items-center gap-2 text-xl font-bold"><Info className="w-5 h-5 text-secondary" /> Sobre o Evento</CardTitle></CardHeader>
                 <CardContent className="pt-6"><p className="text-muted-foreground leading-relaxed whitespace-pre-line text-lg font-medium">{event.description}</p></CardContent>
              </Card>
           </div>
           
           <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-xl rounded-[2rem] border-t-8 border-secondary overflow-hidden bg-white">
                 <CardHeader><CardTitle className="flex items-center gap-2 font-black italic uppercase tracking-tighter"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria</CardTitle></CardHeader>
                 <CardContent className="space-y-6">
                    {saleStatus === 'open' && activeBatch ? (
                       <div className="space-y-6">
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase opacity-60">Escolha o seu Ingresso ({activeBatch.name})</Label>
                             <div className="space-y-3">
                                {activeBatch.ticketTypes.map((type: any) => (
                                  <div 
                                    key={type.id} 
                                    onClick={() => setSelectedTicketType(type)}
                                    className={cn(
                                      "p-4 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center",
                                      selectedTicketType?.id === type.id ? "border-secondary bg-secondary/5 shadow-inner" : "border-muted hover:border-secondary/20"
                                    )}
                                  >
                                     <div className="space-y-1">
                                        <p className="font-bold text-sm uppercase">{type.name}</p>
                                        <div className="flex flex-wrap gap-2">
                                          {type.poolName && <Badge variant="outline" className="text-[7px] h-4 font-black uppercase border-secondary/20 text-secondary gap-1"><Layers className="w-2 h-2" /> {type.poolName}</Badge>}
                                          {type.remaining <= 10 && <span className="text-[8px] font-black text-red-500 uppercase">Restam {type.remaining}</span>}
                                          {type.requiresProof && <Badge variant="outline" className="text-[7px] h-4 font-black uppercase border-orange-200 text-orange-600">Doc. Obrigatório</Badge>}
                                        </div>
                                     </div>
                                     <p className="font-black text-primary">{type.price === 0 ? 'GRÁTIS' : formatCurrency(type.price)}</p>
                                  </div>
                                ))}
                             </div>
                          </div>
                          <Button 
                            disabled={!selectedTicketType} 
                            onClick={() => setIsCheckoutOpen(true)}
                            className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform"
                          >
                             Garantir Ingresso
                          </Button>
                       </div>
                    ) : (
                      <div className="p-10 text-center space-y-2 bg-muted/20 rounded-2xl">
                         <AlertTriangle className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                         <p className="font-black uppercase italic">{saleStatus === 'soldout' ? 'Esgotado' : saleStatus === 'pending' ? 'Vendas em Breve' : 'Vendas Encerradas'}</p>
                      </div>
                    )}
                 </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white rounded-[2rem]">
                 <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-black text-muted-foreground tracking-widest">Organizador</CardTitle></CardHeader>
                 <CardContent className="space-y-6">
                    <div className="flex items-center gap-4">
                       <Avatar className="h-14 w-14 border-2 border-secondary/20 p-0.5">
                          <AvatarImage src={orgAvatar} className="rounded-full object-cover" />
                          <AvatarFallback className="font-bold">{orgName.charAt(0)}</AvatarFallback>
                       </Avatar>
                       <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                             <h4 className="font-bold text-base leading-none">{orgName}</h4>
                             {isVerified && <ShieldCheck className="w-4 h-4 text-secondary" />}
                          </div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Promotor de Eventos</p>
                       </div>
                    </div>
                    <Button variant="outline" className="w-full rounded-xl text-xs font-bold gap-2 h-11" asChild>
                       <Link href={`/${usernameFromUrl}`}>Ver Perfil Completo <ExternalLink className="w-3.5 h-3.5" /></Link>
                    </Button>
                 </CardContent>
              </Card>
           </div>
        </div>
      </div>
      <Footer />

      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
         <DialogContent className="rounded-[2.5rem] max-w-md p-0 overflow-hidden">
            <div className="p-8 space-y-6">
               <DialogHeader><DialogTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3"><CreditCard className="w-6 h-6 text-secondary" /> Finalizar Reserva</DialogTitle></DialogHeader>
               
               <div className="p-6 bg-muted/20 rounded-[2rem] border-2 border-dashed border-border space-y-4">
                  <div className="flex justify-between text-xs font-bold uppercase"><span className="opacity-60">{selectedTicketType?.name}</span><span>{formatCurrency(breakdown.ticketBasePrice)}</span></div>
                  <div className="flex justify-between text-xs font-bold uppercase"><span className="opacity-60">Taxa Administrativa (15%)</span><span className="text-secondary">{formatCurrency(breakdown.administrativeFeeAmount)}</span></div>
                  <Separator />
                  <div className="flex justify-between items-center"><span className="text-lg font-black uppercase italic tracking-tighter">Total</span><span className="text-2xl font-black text-primary">{formatCurrency(breakdown.customerFinalPrice)}</span></div>
               </div>

               {selectedTicketType?.requiresProof && (
                 <div className="p-4 rounded-xl bg-orange-50 border border-orange-100 flex gap-3 items-start">
                    <ShieldAlert className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-orange-800 font-bold uppercase leading-relaxed">
                       Atenção: Este ingresso exige comprovação obrigatória na entrada do evento.
                    </p>
                 </div>
               )}

               <Button onClick={handleRegisterInterest} disabled={registering} className="w-full h-16 bg-secondary text-white font-black text-xl rounded-2xl shadow-xl uppercase italic">
                  {registering ? <Loader2 className="animate-spin mr-2" /> : "Confirmar e Pagar"}
               </Button>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  )
}
