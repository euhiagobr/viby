"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { doc, addDoc, collection, serverTimestamp, query, where, getDocs, updateDoc, increment } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Tag,
  Gift,
  ShieldAlert,
  Send,
  CreditCard,
  ChevronRight,
  Plus,
  History,
  Lock,
  Navigation,
  Map as MapIcon,
  Globe,
  Search
} from "lucide-react"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import Link from "next/link"
import { generateUniqueTicketCode } from "@/lib/ticket-utils"
import { cn } from "@/lib/utils"
import { calculateFinancialBreakdown, formatCurrency } from "@/lib/financial-utils"
import { createCheckoutSession } from "@/app/actions/stripe"
import { sendTicketEmail } from "@/app/actions/email"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import Footer from "@/components/layout/Footer"

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

function WazeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.14 11.23a3.52 3.52 0 0 0-3.52-3.52h-.08a3.52 3.52 0 0 0-3.52 3.52v.08a3.52 3.52 0 0 0 3.52 3.52h.08a3.52 3.52 0 0 0 3.52-3.52v-.08zM15.62 13a1.76 1.76 0 1 1 0-3.52 1.76 1.76 0 0 1 0 3.52zM11.23 11.23a3.52 3.52 0 0 0-3.52-3.52h-.08a3.52 3.52 0 0 0-3.52 3.52v.08a3.52 3.52 0 0 0 3.52 3.52h.08a3.52 3.52 0 0 0 3.52-3.52v-.08zm-3.52 1.77a1.76 1.76 0 1 1 0-3.52 1.76 1.76 0 0 1 0 3.52zM21.5 9.53a8.5 8.5 0 0 0-17 0 1 1 0 0 0 2 0 6.5 6.5 0 0 1 13 0 1 1 0 0 0 2 0zM12 2a9.97 9.97 0 0 0-10 10c0 1.94.54 3.75 1.5 5.3L2 22l4.7-.5A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-5.32-2.12l-.24-.2-.55.06-1.5.16.5-.54.2-.23-.1-.31A8 8 0 1 1 12 20z"/>
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

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  const siteName = settings?.siteName || "Viby"
  
  const eventRef = React.useMemo(() => db ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)
  
  const organizationRef = React.useMemo(() => 
    (db && event?.organizationId) ? doc(db, "organizations", event.organizationId) : null, 
    [db, event?.organizationId]
  )
  const { data: organizationProfile } = useDoc<any>(organizationRef)

  const ownerRef = React.useMemo(() => 
    (db && event?.organizerId) ? doc(db, "users", event.organizerId) : null, 
    [db, event?.organizerId]
  )
  const { data: ownerProfile } = useDoc<any>(ownerRef)

  const currentUserRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: currentUserProfile } = useDoc<any>(currentUserRef)

  // Consulta de disponibilidade: aberta a todos para calcular estoque real
  const availabilityQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(collection(db, "registrations"), where("eventId", "==", eventId))
  }, [db, eventId])
  const { data: allRegistrations } = useCollection<any>(availabilityQuery)

  const userRegistrationQuery = useMemoFirebase(() => {
    if (!db || !eventId || !user) return null
    return query(collection(db, "registrations"), where("eventId", "==", eventId), where("userId", "==", user.uid))
  }, [db, eventId, user])
  const { data: userRegistrations } = useCollection<any>(userRegistrationQuery)
  
  const [hasAtLeastOneRegistration, setHasAtLeastOneRegistration] = React.useState(false)
  const [registering, setRegistering] = React.useState(false)
  const [activeBatch, setActiveBatch] = React.useState<any>(null)
  const [saleStatus, setSaleStatus] = React.useState<'open' | 'pending' | 'ended' | 'soldout'>('pending')
  
  const [couponCode, setCouponCode] = React.useState("")
  const [appliedCoupon, setAppliedCoupon] = React.useState<any>(null)
  const [isVerifyingCoupon, setIsVerifyingCoupon] = React.useState(false)

  const [isReportDialogOpen, setIsReportDialogOpen] = React.useState(false)
  const [reportReason, setReportReason] = React.useState("")
  const [reportDescription, setReportDescription] = React.useState("")
  const [isSubmittingReport, setIsSubmittingReport] = React.useState(false)

  const [isCheckoutOpen, setIsCheckoutOpen] = React.useState(false)

  const [batchesStatus, setBatchesStatus] = React.useState<any[]>([])

  React.useEffect(() => {
    if (!event) return

    const checkAvailability = () => {
      const now = new Date()
      const batches = event.batches || []
      
      if (batches.length === 0) {
        setSaleStatus('ended')
        return
      }

      const salesPerBatch = (allRegistrations || []).reduce((acc: Record<string, number>, reg: any) => {
        if (reg.paymentStatus === 'Pago' || reg.paymentStatus === 'Disponível') {
          const bName = reg.batchName || "Lote Único"
          acc[bName] = (acc[bName] || 0) + 1
        }
        return acc
      }, {})

      let currentSaleStatus: 'open' | 'pending' | 'ended' | 'soldout' = 'ended'
      let foundActiveBatch = null
      let hasUpcoming = false
      let hasSoldOut = false
      let hasEnded = false

      const updatedBatches = batches.map((batch: any) => {
        const start = batch.startDate ? new Date(batch.startDate) : null
        const end = batch.endDate ? new Date(batch.endDate) : null
        const totalCapacity = parseInt(batch.available) || 0
        const currentSales = salesPerBatch[batch.name] || 0
        const remainingStock = totalCapacity - currentSales

        const isStarted = !start || now >= start
        const isNotEnded = !end || now <= end
        const hasStock = remainingStock > 0

        let status: 'upcoming' | 'open' | 'soldout' | 'ended' = 'upcoming'

        if (!isStarted) {
          status = 'upcoming'
          hasUpcoming = true
        } else if (!isNotEnded) {
          status = 'ended'
          hasEnded = true
        } else if (!hasStock) {
          status = 'soldout'
          hasSoldOut = true
        } else {
          status = 'open'
          if (!foundActiveBatch) {
            foundActiveBatch = { ...batch, remaining: Math.max(0, remainingStock) }
            currentSaleStatus = 'open'
          }
        }

        return { ...batch, remaining: Math.max(0, remainingStock), status, sales: currentSales }
      })

      setBatchesStatus(updatedBatches)
      setActiveBatch(foundActiveBatch)

      if (currentSaleStatus === 'open') {
        setSaleStatus('open')
      } else if (hasUpcoming) {
        setSaleStatus('pending')
      } else if (hasSoldOut) {
        setSaleStatus('soldout')
      } else {
        setSaleStatus('ended')
      }
    }

    checkAvailability()
    const timer = setInterval(checkAvailability, 15000)
    return () => clearInterval(timer)
  }, [event, allRegistrations])

  React.useEffect(() => {
    if (!user || !userRegistrations) return
    const userReg = userRegistrations.find((r: any) => r.paymentStatus === 'Pago' || r.paymentStatus === 'Disponível')
    setHasAtLeastOneRegistration(!!userReg)
  }, [user, userRegistrations])

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

  const handleApplyCoupon = async () => {
    if (!db || !couponCode || !eventId) return
    
    setIsVerifyingCoupon(true)
    try {
      const q = query(
        collection(db, "coupons"), 
        where("eventId", "==", eventId), 
        where("code", "==", couponCode.toUpperCase().trim()),
        where("status", "==", "Ativo")
      )
      const snap = await getDocs(q)

      if (snap.empty) {
        toast({ variant: "destructive", title: "Cupom inválido", description: "O código informado não existe ou expirou." })
        setAppliedCoupon(null)
      } else {
        const coupon = { ...snap.docs[0].data(), id: snap.docs[0].id }
        const now = new Date()
        
        const validFrom = coupon.validFrom ? new Date(coupon.validFrom) : null
        const validUntil = coupon.validUntil ? new Date(coupon.validUntil) : null
        
        if (validFrom && now < validFrom) {
          toast({ variant: "destructive", title: "Cupom ainda não ativo", description: "Este cupom começará a valer em breve." })
          return
        }
        if (validUntil && now > validUntil) {
          toast({ variant: "destructive", title: "Cupom expirado", description: "Este código não é mais válido." })
          return
        }
        if (coupon.maxUses > 0 && coupon.currentUses >= coupon.maxUses) {
          toast({ variant: "destructive", title: "Cupom esgotado", description: "O limite de usos deste cupom foi atingido." })
          return
        }

        setAppliedCoupon(coupon)
        toast({ title: "Cupom aplicado!", description: "O desconto foi calculado." })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível validar o cupom." })
    } finally {
      setIsVerifyingCoupon(false)
    }
  }

  const getTicketBasePrice = () => {
    let base = parseFloat(activeBatch?.price) || 0
    if (!appliedCoupon) return base

    if (appliedCoupon.discountType === 'percentage') {
      const discount = (base * appliedCoupon.discountValue) / 100
      return Math.max(0, base - discount)
    } else if (appliedCoupon.discountType === 'fixed') {
      return Math.max(0, base - appliedCoupon.discountValue)
    } else if (appliedCoupon.discountType === 'free_ticket') {
      return 0
    }
    return base
  }

  const breakdown = React.useMemo(() => {
    return calculateFinancialBreakdown(getTicketBasePrice(), ownerProfile?.plan || 'free');
  }, [activeBatch, appliedCoupon, ownerProfile?.plan]);

  const handleRegisterInterest = async () => {
    if (!auth || !user) {
      toast({ title: "Ação necessária", description: "Você precisa entrar para comprar ingressos." })
      router.push("/login")
      return
    }

    if (!db || !eventId || !event || saleStatus !== 'open') return

    setRegistering(true)
    
    try {
      const ticketCode = await generateUniqueTicketCode(db);
      const batchName = activeBatch?.name || (event.isFree ? "Gratuito" : "Lote Único");

      const userName = currentUserProfile?.name || user.displayName || user.email || "Usuário";

      const regData = {
        eventId,
        eventTitle: event.title,
        eventImage: event.image || "",
        eventDate: event.date,
        eventCity: event.city || "",
        userId: user.uid,
        userName: userName,
        userEmail: user.email,
        attendeeName: userName,
        attendeeCPF: "",
        userGender: currentUserProfile?.gender || "Não informado",
        userBirthDate: currentUserProfile?.birthDate || "",
        organizationId: event.organizationId,
        organizerId: event.organizerId,
        organizerUsername: usernameFromUrl,
        
        ticketBasePrice: breakdown.ticketBasePrice,
        price: breakdown.customerFinalPrice, 
        administrativeFeeAmount: breakdown.administrativeFeeAmount,
        producerFeeAmount: breakdown.producerFeeAmount,
        producerNetAmount: breakdown.producerNetAmount,
        financialBreakdown: breakdown,

        batchName: batchName,
        checkedIn: false,
        paymentStatus: breakdown.customerFinalPrice === 0 ? "Disponível" : "Pendente",
        ticketCode: ticketCode,
        status: "Ativo",
        visibility: "public",
        purchaseType: breakdown.customerFinalPrice === 0 ? "free" : "paid",
        couponCode: appliedCoupon?.code || null,
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp()
      }

      if (breakdown.customerFinalPrice > 0) {
        const docRef = await addDoc(collection(db, "registrations"), regData);

        const { url } = await createCheckoutSession({
          eventId,
          eventTitle: event.title,
          eventImage: event.image || "",
          userId: user.uid,
          userName: regData.userName,
          userEmail: user.email!,
          totalAmount: Math.round(breakdown.customerFinalPrice * 100),
          metadata: {
            registrationId: docRef.id,
            eventId,
            userId: user.uid,
            batchName: batchName,
            ticketCode: ticketCode,
            isCouponApplied: !!appliedCoupon,
            couponId: appliedCoupon?.id || ''
          }
        });

        if (url) {
          window.location.href = url;
          return;
        } else {
          throw new Error("Erro ao gerar link de pagamento.");
        }
      }

      const newDocRef = await addDoc(collection(db, "registrations"), {
        ...regData,
        paymentStatus: "Disponível"
      })
      
      const eventDateString = regData.eventDate?.toDate ? regData.eventDate.toDate().toLocaleString('pt-BR') : new Date(regData.eventDate).toLocaleString('pt-BR');
      await sendTicketEmail({
        to: regData.userEmail!,
        userName: regData.attendeeName || regData.userName,
        eventTitle: regData.eventTitle,
        ticketCode: regData.ticketCode,
        eventDate: eventDateString,
        eventCity: regData.eventCity || "Local Confirmado",
        voucherUrl: `https://viby.club/dashboard/ingressos/${newDocRef.id}/voucher`,
        eventUrl: `https://viby.club/${usernameFromUrl}/${eventId}`
      });

      if (appliedCoupon) {
        updateDoc(doc(db, "coupons", appliedCoupon.id), {
          currentUses: increment(1)
        })
      }

      setIsCheckoutOpen(false)
      toast({ title: "Confirmado!", description: "Sua presença foi registrada e seu ingresso enviado por e-mail." })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao processar", description: error.message })
    } finally {
      setRegistering(false)
    }
  }

  const handleSendReport = async () => {
    if (!auth || !user) {
      toast({ title: "Ação necessária", description: "Entre para denunciar o evento." })
      router.push("/login")
      return
    }

    if (!db || !eventId || !event || !reportReason) return

    setIsSubmittingReport(true)
    const reportData = {
      type: "event",
      targetId: eventId,
      targetName: event?.title || "Sem Título",
      reporterId: user.uid,
      reporterName: currentUserProfile?.name || user.displayName || "Denunciante",
      reason: reportReason,
      description: reportDescription,
      timestamp: serverTimestamp(),
      status: "Pendente"
    }

    addDoc(collection(db, "reports"), reportData)
      .then(() => {
        toast({ title: "Denúncia enviada", description: "Nossa equipe analisará o conteúdo em breve." })
        setIsReportDialogOpen(false)
        setReportReason("")
        setReportDescription("")
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: "reports",
          operation: "create",
          requestResourceData: reportData
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsSubmittingReport(false))
  }

  if (eventLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (!event || event.status === 'Bloqueado') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center p-6">
        <AlertTriangle className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-2xl font-bold tracking-tighter">Essa página não está disponível</h2>
        <p className="text-muted-foreground max-w-xs">O conteúdo que você procura foi removido por violar nossas diretrizes ou não existe.</p>
        <Button onClick={() => router.push('/dashboard')} className="rounded-full px-8">Voltar para Explorar</Button>
      </div>
    )
  }

  const start = formatDateTime(event.date);
  const end = formatDateTime(event.endDate);

  const orgName = organizationProfile?.name || event.organizer?.name || "Organizador";
  const orgAvatar = organizationProfile?.avatar || event.organizer?.avatar;
  const orgIsVerified = organizationProfile?.verified ?? event.organizer?.isVerified;
  const orgUsername = organizationProfile?.username || usernameFromUrl;

  const getButtonText = () => {
    if (saleStatus === 'pending') return "Vendas em Breve"
    if (saleStatus === 'soldout') return "Ingressos Esgotados"
    if (saleStatus === 'ended') return "Vendas Encerradas"
    return hasAtLeastOneRegistration ? "Comprar outro Ingresso" : "Garantir Ingresso"
  }

  const getFullAddress = () => {
    if (event.address) {
      const parts = [
        event.address.street,
        event.address.number,
        event.address.neighborhood,
        event.address.city,
        event.address.state
      ].filter(Boolean);
      return parts.join(", ");
    }
    return [event.location, event.city].filter(Boolean).join(", ");
  };

  const addressString = getFullAddress();
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressString)}`;
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(addressString)}&navigate=yes`;
  
  const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(addressString)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {settings?.logoUrl ? (
              <div className="w-10 h-10 relative flex items-center justify-center">
                <Image src={settings.logoUrl} alt={siteName} width={40} height={40} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">{siteName.charAt(0)}</span>
              </div>
            )}
            <span className="text-xl font-bold tracking-tight">{siteName}</span>
          </Link>

          <div className="hidden md:flex flex-1 max-w-sm mx-8 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar eventos..." 
              className="pl-10 bg-muted/50 border-none rounded-full h-9 focus-visible:ring-secondary"
            />
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild variant="ghost" className="font-semibold text-sm h-9">
                <Link href="/dashboard">Meu Painel</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="font-semibold text-sm h-9">
                  <Link href="/login">Entrar</Link>
                </Button>
                <Button asChild className="bg-secondary text-white hover:bg-secondary/90 font-bold px-4 rounded-full h-9 text-xs">
                  <Link href="/cadastro">Cadastrar-se</Link>
                </Button>
              </>
            )}
            <Separator orientation="vertical" className="h-6 mx-2 hidden sm:block" />
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-9 w-9">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="space-y-8 pb-20 max-w-6xl mx-auto px-4 pt-10 flex-1">
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
              onClick={() => setIsCheckoutOpen(true)}
              disabled={registering || saleStatus !== 'open'}
              className={cn(
                "font-bold px-6 rounded-full h-10 shadow-lg transition-all",
                saleStatus === 'open' ? "bg-secondary text-white hover:scale-105" : "bg-muted text-muted-foreground"
              )}
            >
              {hasAtLeastOneRegistration ? <Plus className="w-4 h-4 mr-2" /> : null}
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
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6 md:p-10 w-full">
            <div className="flex flex-col gap-4 max-w-4xl">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-secondary text-white border-none text-xs px-4 py-1 rounded-full uppercase font-black tracking-widest">
                  {event.categoryName || "Evento"}
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
                  {addressString}
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

            <Card className="border-none shadow-sm bg-card rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <MapIcon className="w-5 h-5 text-secondary" /> 
                  Localização & Mapa
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-muted/20 rounded-[1.5rem] border-2 border-dashed border-border">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Endereço do Evento</p>
                    <p className="font-bold text-lg">{addressString}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="rounded-xl font-bold gap-2 h-12" asChild>
                      <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                        <Navigation className="w-4 h-4 text-blue-500" />
                        Google Maps
                      </a>
                    </Button>
                    <Button variant="outline" className="rounded-xl font-bold gap-2 h-12" asChild>
                      <a href={wazeUrl} target="_blank" rel="noopener noreferrer">
                        <WazeIcon className="w-4 h-4 text-orange-500" />
                        Waze
                      </a>
                    </Button>
                  </div>
                </div>
                
                <div className="relative aspect-video rounded-[1.5rem] overflow-hidden bg-muted border border-border">
                   <iframe 
                     width="100%" 
                     height="100%" 
                     style={{ border: 0 }} 
                     loading="lazy" 
                     allowFullScreen 
                     referrerPolicy="no-referrer-when-downgrade"
                     src={embedUrl}
                     className="grayscale opacity-80 contrast-125"
                   ></iframe>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-center pt-4">
               <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                 <DialogTrigger asChild>
                   <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 font-bold gap-2 rounded-full uppercase text-[10px] tracking-widest">
                     <ShieldAlert className="w-4 h-4" /> Denunciar Evento
                   </Button>
                 </DialogTrigger>
                 <DialogContent className="rounded-[2rem]">
                   <DialogHeader>
                     <DialogTitle className="text-xl font-black italic uppercase tracking-tighter">Denunciar este evento?</DialogTitle>
                     <DialogDescription>Ajude-nos a manter o {siteName} seguro.</DialogDescription>
                   </DialogHeader>
                   <div className="space-y-4 py-4">
                     <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Motivo</Label>
                       <Select value={reportReason} onValueChange={setReportReason}>
                         <SelectTrigger className="rounded-xl border-dashed border-secondary/30 h-12">
                           <SelectValue placeholder="Selecione o motivo" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="Conteúdo Inadequado">Conteúdo Inadequado</SelectItem>
                           <SelectItem value="Fraude / Golpe">Fraude / Golpe</SelectItem>
                           <SelectItem value="Evento Inexistente">Evento Inexistente</SelectItem>
                           <SelectItem value="Propriedade Intelectual">Violação de Propriedade Intelectual</SelectItem>
                           <SelectItem value="Outro">Outro Motivo</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                     <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Descrição Detalhada</Label>
                       <Textarea 
                         placeholder="Descreva o que está errado..." 
                         value={reportDescription}
                         onChange={(e) => setReportDescription(e.target.value)}
                         className="rounded-xl border-dashed border-secondary/30 min-h-[100px]"
                       />
                     </div>
                   </div>
                   <DialogFooter>
                     <Button variant="ghost" onClick={() => setIsReportDialogOpen(false)} className="rounded-xl font-bold uppercase text-[10px] tracking-widest">Cancelar</Button>
                     <Button 
                       onClick={handleSendReport} 
                       disabled={isSubmittingReport || !reportReason} 
                       className="bg-destructive text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-12 px-6"
                     >
                       {isSubmittingReport ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                       Enviar Denúncia
                     </Button>
                   </DialogFooter>
                 </DialogContent>
               </Dialog>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card className={`border-none shadow-lg bg-card rounded-[2rem] border-t-8 ${saleStatus === 'open' ? 'border-secondary' : 'border-muted'} overflow-hidden`}>
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg font-bold"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {saleStatus === 'open' && activeBatch ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">Lote Atual</span>
                        <Badge variant="outline" className="text-[10px] font-bold border-secondary text-secondary uppercase">{activeBatch.name}</Badge>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className={cn(
                          "text-2xl font-black",
                          appliedCoupon ? "text-muted-foreground line-through text-sm" : "text-primary"
                        )}>
                          {parseFloat(activeBatch.price) === 0 ? "GRATUITO" : formatCurrency(parseFloat(activeBatch.price))}
                        </p>
                        {appliedCoupon && (
                          <p className="text-2xl font-black text-green-600">
                            {breakdown.ticketBasePrice === 0 ? "GRÁTIS" : formatCurrency(breakdown.ticketBasePrice)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-[10px] font-medium text-muted-foreground">Vendas terminam em: {new Date(activeBatch.endDate).toLocaleString('pt-BR')}</p>
                        {activeBatch.remaining < 20 && (
                          <Badge variant="destructive" className="text-[8px] h-4 font-black">SÓ RESTAM {activeBatch.remaining}</Badge>
                        )}
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground font-medium bg-muted/50 p-3 rounded-lg leading-tight">
                      * Uma taxa de serviço de 15% será aplicada ao valor final do ingresso no checkout.
                    </p>
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
                  onClick={() => setIsCheckoutOpen(true)} 
                  disabled={registering || saleStatus !== 'open'} 
                  className={cn(
                    "w-full font-black py-7 rounded-2xl text-lg shadow-xl text-white",
                    saleStatus === 'open' ? "bg-secondary hover:bg-secondary/90" : "bg-muted cursor-not-allowed"
                  )}
                >
                  {registering ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  {getButtonText()}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-card rounded-[2rem] overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-muted-foreground">
                  <History className="w-4 h-4" /> Todos os Lotes
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                 <div className="divide-y border-t">
                    {batchesStatus.map((batch, i) => (
                      <div key={i} className={cn(
                        "p-4 flex items-center justify-between transition-colors",
                        batch.status === 'open' ? "bg-secondary/5" : "bg-white"
                      )}>
                         <div className="space-y-1">
                            <div className="flex items-center gap-2">
                               <p className={cn("text-xs font-bold uppercase", batch.status === 'ended' ? "text-muted-foreground line-through" : "text-foreground")}>
                                 {batch.name}
                               </p>
                               {batch.status === 'open' && (
                                 <Badge className="bg-green-500 text-[8px] h-4 uppercase font-black">Ativo</Badge>
                               )}
                               {batch.status === 'soldout' && (
                                 <Badge variant="outline" className="text-orange-500 border-orange-200 text-[8px] h-4 uppercase font-black">Esgotado</Badge>
                               )}
                            </div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">
                              {parseFloat(batch.price) === 0 ? "Gratuito" : formatCurrency(parseFloat(batch.price))}
                            </p>
                         </div>
                         <div className="text-right">
                            {batch.status === 'upcoming' ? (
                              <div className="flex flex-col items-end">
                                 <Badge variant="outline" className="text-[8px] font-black uppercase opacity-60">Em Breve</Badge>
                                 <p className="text-[8px] text-muted-foreground mt-1">Início: {new Date(batch.startDate).toLocaleDateString('pt-BR')}</p>
                              </div>
                            ) : batch.status === 'open' ? (
                              <div className="flex flex-col items-end">
                                 <p className="text-[9px] font-black text-secondary uppercase">Disponível</p>
                                 <p className="text-[8px] text-muted-foreground mt-1">{batch.remaining} restantes</p>
                              </div>
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-muted-foreground/30" />
                            )}
                         </div>
                      </div>
                    ))}
                 </div>
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

        <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
          <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden bg-background">
            <div className="p-8 space-y-6">
               <DialogHeader className="text-left space-y-2">
                  <div className="flex items-center gap-3 text-secondary">
                     <CreditCard className="w-6 h-6" />
                     <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Finalizar Reserva</DialogTitle>
                  </div>
                  <DialogDescription className="font-medium text-muted-foreground">Confira os valores da sua participação.</DialogDescription>
               </DialogHeader>

               <div className="space-y-4">
                  <div className="p-5 bg-muted/30 rounded-[1.5rem] border-2 border-dashed border-border space-y-4">
                     <div className="flex justify-between items-center text-sm font-bold">
                        <span className="text-muted-foreground uppercase text-[10px] tracking-widest">Ingresso ({activeBatch?.name})</span>
                        <span>{formatCurrency(breakdown.ticketBasePrice)}</span>
                     </div>
                     
                      <div className="space-y-3 pt-2">
                        <div className="flex gap-2">
                          <Input 
                            placeholder="CUPOM" 
                            value={couponCode} 
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            className="rounded-xl border-dashed border-secondary/30 h-10 font-bold"
                          />
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={handleApplyCoupon} 
                            disabled={isVerifyingCoupon || !couponCode}
                            className="rounded-xl font-bold"
                          >
                            {isVerifyingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
                          </Button>
                        </div>
                        {appliedCoupon && (
                          <div className="flex items-center gap-2 text-[10px] font-bold text-green-600 uppercase bg-green-50 p-2 rounded-lg">
                            <CheckCircle2 className="w-3 h-3" />
                            {appliedCoupon.code}: {appliedCoupon.discountType === 'percentage' ? `${appliedCoupon.discountValue}% OFF` : 'Desconto Ativo'}
                            <Button variant="ghost" size="sm" onClick={() => {setAppliedCoupon(null); setCouponCode("");}} className="h-4 p-0 ml-auto text-destructive hover:bg-transparent">Remover</Button>
                          </div>
                        )}
                      </div>

                     <div className="flex justify-between items-center text-sm font-bold">
                        <div className="flex items-center gap-1.5 text-muted-foreground uppercase text-[10px] tracking-widest">
                           Taxa Administrativa
                           <Info className="w-3 h-3 opacity-40" />
                        </div>
                        <span className="text-secondary">{formatCurrency(breakdown.administrativeFeeAmount)}</span>
                     </div>

                     <Separator className="bg-border/60" />

                     <div className="flex justify-between items-center">
                        <span className="text-lg font-black uppercase italic tracking-tighter">Total a Pagar</span>
                        <span className="text-2xl font-black text-primary">{formatCurrency(breakdown.customerFinalPrice)}</span>
                     </div>
                  </div>

                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="terms" className="border-none">
                      <AccordionTrigger className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:no-underline py-2">
                        Políticas e Regras do Evento
                      </AccordionTrigger>
                      <AccordionContent className="text-[10px] text-muted-foreground leading-relaxed bg-muted/20 p-4 rounded-xl">
                        Ao clicar em confirmar, você aceita os termos de uso do {siteName} e as políticas de cancelamento do produtor. 
                        A taxa administrativa da plataforma não é reembolsável após o processamento.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
               </div>

               <Button 
                  onClick={handleRegisterInterest}
                  disabled={registering}
                  className="w-full h-16 bg-secondary text-white font-black text-xl rounded-2xl shadow-xl shadow-secondary/20 uppercase italic transition-all hover:scale-[1.02] active:scale-95"
               >
                  {registering ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <ChevronRight className="w-6 h-6 mr-1" />}
                  {breakdown.customerFinalPrice > 0 ? "Pagar e Confirmar" : "Confirmar e Gerar Voucher"}
               </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Footer />
    </div>
  )
}