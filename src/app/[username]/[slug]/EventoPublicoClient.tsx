"use client"

import * as React from "react"
import { useDoc, useFirestore, useAuth, useUser } from "@/firebase"
import { doc } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { 
  Calendar, 
  MapPin, 
  ArrowLeft, 
  Info,
  BadgeCheck,
  Loader2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ArrowRight,
  Share2
} from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { BilheteriaPublic, EventInterest, EventSEO, EventCoOrganizers } from "@/components/events"
import Footer from "@/components/layout/Footer"
import { AgeRatingBadge, AgeRatingWarning } from "@/lib/age-rating"
import { useCurrency } from "@/contexts/CurrencyContext"
import { UserNav } from "@/components/layout/UserNav"
import { ShareModal } from "@/components/sharing/ShareModal"
import { RichText } from "@/components/ui/rich-text"

interface EventoPublicoClientProps {
  id: string
  username: string
}

export default function EventoPublicoClient({ id, username }: EventoPublicoClientProps) {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { formatPriceWithOriginal } = useCurrency()
  
  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false)

  const eventRef = React.useMemo(() => (db && id) ? doc(db, "events", id) : null, [db, id])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const organizationRef = React.useMemo(() => 
    (db && event?.organizationId) ? doc(db, "organizations", event.organizationId) : null, 
    [db, event?.organizationId]
  )
  const { data: org } = useDoc<any>(organizationRef)

  const settingsRef = React.useMemo(() => (db ? doc(db, "settings", "site") : null), [db])
  const { data: settings } = useDoc<any>(settingsRef)
  
  const feesRef = React.useMemo(() => (db ? doc(db, 'settings', 'fees') : null), [db])
  const { data: globalFees } = useDoc<any>(feesRef)

  const promosRef = React.useMemo(() => (db ? doc(db, 'settings', 'promotions') : null), [db])
  const { data: promotions } = useDoc<any>(promosRef)

  const siteName = settings?.siteName || "Viby"

  React.useEffect(() => {
    if (id) {
       fetch('/api/events/track-view', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ eventId: id })
       }).catch(() => {});
    }
  }, [id])

  if (eventLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (!event) return null;

  const dateValue = event.date || event.startDate;
  const d = dateValue ? (dateValue.toDate ? dateValue.toDate() : new Date(dateValue)) : new Date();
  const endDateVal = event.endDate ? (event.endDate.toDate ? event.endDate.toDate() : new Date(event.endDate)) : new Date(d.getTime() + 4 * 60 * 60 * 1000);
  
  const isEnded = endDateVal < new Date();

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      <EventSEO event={event} username={username} />
      
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
             </Button>
             <Link href="/" className="flex items-center gap-2 group">
                {settings?.logoUrl ? (
                  <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-10 w-auto object-contain" priority unoptimized />
                ) : (
                  <span className="text-xl font-bold tracking-tight italic uppercase">{siteName}</span>
                )}
             </Link>
          </div>
          <div className="flex items-center gap-4">
             {user ? <UserNav /> : (
                <>
                  <Button variant="ghost" asChild className="font-bold uppercase text-[10px] tracking-widest">
                    <Link href="/login">Entrar</Link>
                  </Button>
                  <Button asChild className="bg-secondary text-white font-black uppercase italic text-[10px] tracking-widest rounded-full px-6 shadow-lg shadow-secondary/20">
                    <Link href="/cadastro">Criar Conta</Link>
                  </Button>
                </>
             )}
          </div>
        </div>
      </nav>

      {/* BANNER DE CAPA 100% LARGURA */}
      <section className="relative h-[400px] md:h-[600px] w-full overflow-hidden bg-primary">
         <Image 
           src={event.image || "https://picsum.photos/seed/event/1920/1080"} 
           alt={event.title} 
           fill 
           className={cn("object-cover", isEnded && "grayscale")}
           priority
           unoptimized 
         />
         <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
         <div className="absolute bottom-0 left-0 w-full p-8 md:p-20">
            <div className="container mx-auto max-w-6xl">
              <div className="max-w-4xl space-y-6">
                 <div className="flex flex-wrap gap-3">
                    <Badge className="bg-secondary text-white border-none px-5 h-7 rounded-full font-black uppercase italic text-[10px] tracking-widest shadow-lg">
                       {event.categoryName || "Experiência"}
                    </Badge>
                    {isEnded && <Badge className="bg-red-500 text-white border-none px-5 h-7 rounded-full font-black uppercase text-[10px] tracking-widest">Encerrado</Badge>}
                    <AgeRatingBadge code={event.ageRating?.code || "free"} className="bg-white/95 p-1 rounded-xl shadow-lg h-7" showLabel />
                 </div>
                 <h1 className="text-4xl md:text-8xl font-black text-white uppercase italic tracking-tighter leading-[0.85]">{event.title}</h1>
                 <div className="flex flex-wrap gap-4 text-white/90 text-sm font-bold uppercase tracking-tight">
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                       <MapPin className="w-4 h-4 text-secondary" /> {event.address?.venueName || event.location}, {event.city}
                    </div>
                 </div>
              </div>
            </div>
         </div>
      </section>

      <main className="flex-1 container mx-auto px-4 py-12 md:py-20 max-w-6xl space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
           <div className="lg:col-span-8 space-y-16">
              <section className="space-y-6">
                 <div className="flex items-center gap-3 px-2">
                    <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><Info className="w-5 h-5" /></div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Sobre a Experiência</h2>
                 </div>
                 <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden p-8 md:p-12">
                    <RichText 
                      content={event.description} 
                      className="text-lg md:text-xl font-medium text-foreground/80 leading-relaxed" 
                    />
                 </Card>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Card className="border-none shadow-sm rounded-3xl bg-white p-8 flex items-center gap-6">
                    <div className="p-4 bg-muted rounded-2xl text-secondary"><Calendar className="w-8 h-8" /></div>
                    <div>
                       <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Data do Evento</p>
                       <p className="text-lg font-bold text-primary">{d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    </div>
                 </Card>
                 <Card className="border-none shadow-sm rounded-3xl bg-white p-8 flex items-center gap-6">
                    <div className="p-4 bg-muted rounded-2xl text-secondary"><Clock className="w-8 h-8" /></div>
                    <div>
                       <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Horário de Início</p>
                       <p className="text-lg font-bold text-primary">{d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                 </Card>
              </div>

              <BilheteriaPublic 
                event={event} 
                globalFees={globalFees} 
                promotions={promotions} 
                orgSettings={org} 
              />
              
              <EventCoOrganizers isPublic eventId={id} currentOrgId={event.organizationId} />
           </div>

           <aside className="lg:col-span-4 space-y-8">
              <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary text-white overflow-hidden sticky top-24">
                 <div className="p-8 space-y-8 relative">
                    <div className="space-y-4">
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Organizado por</p>
                       <Link href={`/${org?.username || username}`} className="flex items-center gap-4 group">
                          <Avatar className="h-16 w-16 border-2 border-white/20 p-0.5 group-hover:scale-105 transition-transform">
                             <AvatarImage src={org?.avatar} className="object-cover rounded-full" />
                             <AvatarFallback className="font-black bg-white/10">{org?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                             <div className="flex items-center gap-1.5">
                                <h4 className="font-black text-lg uppercase italic leading-none">{org?.name || "Organizador"}</h4>
                                {(org?.verified || org?.isVerified) && <BadgeCheck className="w-4 h-4 fill-secondary text-primary" />}
                             </div>
                             <p className="text-[10px] font-bold uppercase opacity-60">@{org?.username || username}</p>
                          </div>
                       </Link>
                    </div>

                    <Separator className="bg-white/10" />

                    <div className="space-y-6">
                       <EventInterest event={event} showButton={true} className="justify-between" />
                       <AgeRatingWarning code={event.ageRating?.code || "free"} />
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                       <Button asChild className="w-full h-14 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-sm hover:scale-105 transition-transform">
                          <Link href="#bilheteria">Garantir Ingresso <ArrowRight className="ml-2 w-5 h-5" /></Link>
                       </Button>
                       <Button 
                         variant="outline"
                         onClick={() => setIsShareModalOpen(true)}
                         className="w-full h-12 rounded-2xl border-white/20 text-white hover:bg-white/10 font-black uppercase italic text-[10px] gap-2"
                       >
                          <Share2 className="w-4 h-4" /> Compartilhar Experiência
                       </Button>
                    </div>
                 </div>
                 <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
              </Card>

              <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-secondary/5 rounded-lg text-secondary"><ShieldCheck className="w-5 h-5" /></div>
                    <h3 className="text-sm font-black uppercase italic text-primary">Compra Segura</h3>
                 </div>
                 <p className="text-xs text-muted-foreground leading-relaxed font-medium uppercase">
                    Seus ingressos são nominais e protegidos por criptografia. O acesso ao evento é validado via QR Code exclusivo através do app Viby.
                 </p>
                 <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary">Operação Verificada</span>
                 </div>
              </Card>
           </aside>
        </div>
      </main>

      {org && (
        <ShareModal 
          isOpen={isShareModalOpen} 
          onOpenChange={setIsShareModalOpen} 
          data={{
            title: event.title,
            username: username,
            url: `/${username}/${event.slug || event.id}`,
            logoUrl: event.image,
            type: 'event',
            organizationId: event.organizationId,
            eventId: id,
            verified: org.verified || org.isVerified
          }}
        />
      )}

      <Footer />
    </div>
  )
}
