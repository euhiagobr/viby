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
  Share2,
  Map as MapIcon,
  Navigation,
  Globe,
  ExternalLink,
  Copy,
  Tag,
  Users
} from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { BilheteriaPublic, EventInterest, EventSEO, EventCoOrganizers, EventStats } from "@/components/events"
import Footer from "@/components/layout/Footer"
import { AgeRatingBadge, AgeRatingWarning } from "@/lib/age-rating"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"
import { UserNav } from "@/components/layout/UserNav"
import { ShareModal } from "@/components/sharing/ShareModal"
import { RichText } from "@/components/ui/rich-text"
import { LocationMap } from "@/components/events/LocationMap"
import { toast } from "@/hooks/use-toast"

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
  const { data: promotions } = useDoc<any>( promosRef)

  const siteName = settings?.siteName || "Viby"

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copiado!", description: "Compartilhe com sua rede." });
    }
  }

  if (eventLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (!event) return null;

  const dateValue = event.date || event.startDate;
  const dStart = dateValue ? (dateValue.toDate ? dateValue.toDate() : new Date(dateValue)) : new Date();
  const dEnd = event.endDate ? (event.endDate.toDate ? event.endDate.toDate() : new Date(event.endDate)) : null;
  
  const isEnded = dEnd ? (dEnd < new Date()) : false;
  const isVibyCurated = event.curationType === 'curadoria';
  const isExternalSale = event.type === 'externo' && event.externalUrl;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      <EventSEO event={event} username={username} />
      
      {/* HEADER GLOBAL */}
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
                  <span className="text-xl font-black tracking-tight italic uppercase text-primary ml-1">{siteName}</span>
                )}
             </Link>
          </div>
          <div className="flex items-center gap-4">
             <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hidden sm:flex"
                onClick={() => setIsShareModalOpen(true)}
             >
                <Share2 className="w-5 h-5" />
             </Button>
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

      {/* HERO SECTION (100% LARGURA) */}
      <section className="relative h-[500px] md:h-[700px] w-full overflow-hidden bg-primary shrink-0">
         <Image 
           src={event.image || "https://picsum.photos/seed/event/1920/1080"} 
           alt={event.title} 
           fill 
           className={cn("object-cover", isEnded && "grayscale")}
           priority
           unoptimized 
         />
         <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
         <div className="absolute bottom-0 left-0 w-full p-8 md:p-20">
            <div className="container mx-auto max-w-6xl">
              <div className="max-w-4xl space-y-6">
                 <div className="flex flex-wrap gap-3">
                    <Badge className="bg-secondary text-white border-none px-5 h-8 rounded-full font-black uppercase italic text-[10px] tracking-widest shadow-lg">
                       {event.categoryName || "Experiência"}
                    </Badge>
                    {isEnded && <Badge className="bg-red-500 text-white border-none px-5 h-8 rounded-full font-black uppercase text-[10px] tracking-widest">Encerrado</Badge>}
                    <AgeRatingBadge code={event.ageRating?.code || "free"} className="bg-white/95 p-1 rounded-xl shadow-lg h-8" showLabel />
                 </div>
                 <h1 className="text-5xl md:text-8xl font-black text-white uppercase italic tracking-tighter leading-[0.85]">{event.title}</h1>
                 <div className="flex flex-wrap gap-4 text-white/90 text-sm font-bold uppercase tracking-tight">
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white/10">
                       <MapPin className="w-4 h-4 text-secondary" /> {event.address?.venueName || event.location}, {event.city}
                    </div>
                 </div>
              </div>
            </div>
         </div>
      </section>

      {/* BARRA DE AÇÕES RÁPIDAS */}
      <div className="bg-white border-b border-border/60 sticky top-16 z-40 shadow-sm">
         <div className="container mx-auto px-4 max-w-6xl py-4 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-10">
               <EventInterest event={event} showButton={true} className="gap-6" />
               <div className="hidden md:flex flex-col">
                  <span className="text-xl font-black text-primary leading-none">{(event.sharesCount || 0).toLocaleString()}</span>
                  <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Compartilhados</span>
               </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
               <Button 
                 onClick={handleCopyLink}
                 variant="outline" 
                 className="flex-1 sm:flex-none h-12 rounded-2xl border-2 gap-2 font-black uppercase italic text-xs px-6"
               >
                  <Copy className="w-4 h-4" /> Copiar Link
               </Button>
               <Button 
                 onClick={() => setIsShareModalOpen(true)}
                 variant="outline" 
                 className="flex-1 sm:flex-none h-12 rounded-2xl border-2 gap-2 font-black uppercase italic text-xs px-6"
               >
                  <Share2 className="w-4 h-4" /> Material
               </Button>
               {isExternalSale ? (
                 <Button asChild className="flex-1 sm:flex-none h-12 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-xs px-8 hover:scale-105 transition-transform">
                   <a href={event.externalUrl} target="_blank" rel="noopener noreferrer">Comprar no Site Oficial <ExternalLink className="ml-2 w-4 h-4" /></a>
                 </Button>
               ) : (
                 <Button asChild className="flex-1 sm:flex-none h-12 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-xs px-8 hover:scale-105 transition-transform">
                   <Link href="#bilheteria">Garantir Ingresso <ArrowRight className="ml-2 w-4 h-4" /></Link>
                 </Button>
               )}
            </div>
         </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-12 md:py-20 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
           
           <div className="lg:col-span-8 space-y-20">
              
              {/* BLOCO DE DATA E HORA FUNDAMENTAL */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-10 flex items-center gap-6 group hover:shadow-md transition-all border border-border/50">
                    <div className="p-5 bg-secondary/5 rounded-3xl text-secondary group-hover:bg-secondary group-hover:text-white transition-colors">
                       <Calendar className="w-10 h-10" />
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] mb-1.5">Início</p>
                       <p className="text-xl font-black text-primary uppercase italic leading-none">
                         {dStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                       </p>
                       <p className="text-sm font-bold text-secondary mt-1">{dStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}h</p>
                    </div>
                 </Card>
                 <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-10 flex items-center gap-6 group hover:shadow-md transition-all border border-border/50">
                    <div className="p-5 bg-primary/5 rounded-3xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                       <Clock className="w-10 h-10" />
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] mb-1.5">Encerramento</p>
                       {dEnd ? (
                         <>
                           <p className="text-xl font-black text-primary uppercase italic leading-none">
                             {dEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                           </p>
                           <p className="text-sm font-bold text-secondary mt-1">{dEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}h</p>
                         </>
                       ) : (
                         <p className="text-sm font-bold text-muted-foreground italic uppercase">Conforme programação</p>
                       )}
                    </div>
                 </Card>
              </section>

              {/* DESCRIÇÃO EDITORIAL */}
              <section className="space-y-8">
                 <div className="flex items-center gap-3 px-2">
                    <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><Info className="w-5 h-5" /></div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Sobre a Experiência</h2>
                 </div>
                 <Card className="border-none shadow-sm rounded-[3rem] bg-white overflow-hidden p-10 md:p-16 relative border border-border/50">
                    <RichText 
                      content={event.description} 
                      className="text-lg md:text-xl font-medium text-foreground/80 leading-relaxed max-w-3xl" 
                    />
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                       <Globe className="w-48 h-48" />
                    </div>
                 </Card>
              </section>

              {/* BILHETERIA */}
              {event.ticketMode !== 'none' && !isExternalSale && (
                <div id="bilheteria" className="scroll-mt-32">
                   <BilheteriaPublic 
                    event={event} 
                    globalFees={globalFees} 
                    promotions={promotions} 
                    orgSettings={org} 
                   />
                </div>
              )}

              {/* LOCALIZAÇÃO E MAPA */}
              <section className="space-y-8">
                 <div className="flex items-center gap-3 px-2">
                    <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><MapIcon className="w-5 h-5" /></div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Localização</h2>
                 </div>
                 <Card className="border-none shadow-sm rounded-[3rem] bg-white overflow-hidden p-0 relative group border border-border/50">
                    <div className="h-[400px] w-full">
                       <LocationMap 
                         latitude={event.latitude || -23.55052} 
                         longitude={event.longitude || -46.633308} 
                         interactive={false} 
                         onChange={() => {}} 
                       />
                    </div>
                    <CardContent className="p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                       <div className="space-y-2 text-center md:text-left">
                          <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">{event.address?.venueName || event.location}</h3>
                          <p className="text-sm font-medium text-muted-foreground leading-relaxed max-w-md">
                            {event.address?.formattedAddress || `${event.address?.addressLine1}, ${event.address?.city} - ${event.address?.stateRegion}`}
                          </p>
                       </div>
                       <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                          <Button asChild variant="outline" className="rounded-2xl h-14 px-8 font-black uppercase italic text-xs gap-3 border-secondary/20 text-secondary hover:bg-secondary/5 transition-all">
                             <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address?.formattedAddress || event.location)}`} target="_blank">
                                <Navigation className="w-4 h-4" /> Google Maps
                             </a>
                          </Button>
                          <Button asChild variant="outline" className="rounded-2xl h-14 px-8 font-black uppercase italic text-xs gap-3 border-primary/10 text-primary hover:bg-muted transition-all">
                             <a href={`https://www.waze.com/ul?q=${encodeURIComponent(event.address?.formattedAddress || event.location)}&navigate=yes`} target="_blank">
                                <MapIcon className="w-4 h-4" /> Abrir no Waze
                             </a>
                          </Button>
                       </div>
                    </CardContent>
                 </Card>
              </section>

              <EventCoOrganizers isPublic eventId={id} currentOrgId={event.organizationId} className="pt-10 border-t border-dashed" />
           </div>

           {/* SIDEBAR CLEAN (BRANCA) */}
           <aside className="lg:col-span-4 space-y-8">
              <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden sticky top-40 border border-border/50">
                 <div className="p-10 space-y-10 relative">
                    <div className="space-y-6">
                       <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 text-primary">Responsável</p>
                       <Link href={`/${org?.username || username}`} className="flex items-center gap-5 group">
                          <Avatar className="h-20 w-20 border-4 border-muted/30 p-0.5 group-hover:scale-105 transition-transform rounded-[1.8rem] overflow-hidden">
                             <AvatarImage src={org?.avatar} className="object-cover" />
                             <AvatarFallback className="font-black bg-muted text-2xl">{org?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                             <div className="flex items-center gap-2">
                                <h4 className="font-black text-xl uppercase italic leading-tight tracking-tighter text-primary">{org?.name || "Organizador"}</h4>
                                {(org?.verified || org?.isVerified) && <BadgeCheck className="w-5 h-5 fill-secondary text-white" />}
                             </div>
                             <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-secondary">@{org?.username || username}</span>
                                {isVibyCurated && <Badge variant="secondary" className="w-fit h-4 px-1.5 text-[7px] font-black uppercase mt-1">Curadoria Viby</Badge>}
                             </div>
                          </div>
                       </Link>
                    </div>

                    <Separator className="bg-muted" />

                    <div className="space-y-8">
                       <div className="flex items-center justify-between">
                          <div className="space-y-1">
                             <p className="text-[8px] font-black uppercase opacity-40 tracking-widest text-primary">Seguidores</p>
                             <p className="text-xl font-black italic tracking-tighter text-primary">{(org?.followersCount || 0).toLocaleString()}</p>
                          </div>
                          <Button asChild variant="outline" className="h-9 px-4 rounded-xl border-secondary/20 text-secondary font-black uppercase italic text-[9px] hover:bg-secondary/5 transition-all">
                             <Link href={`/${org?.username || username}`}>Seguir Marca</Link>
                          </Button>
                       </div>
                       <AgeRatingWarning code={event.ageRating?.code || "free"} />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                       {isExternalSale ? (
                         <Button asChild className="w-full h-16 bg-primary text-white font-black rounded-3xl shadow-2xl uppercase italic text-base hover:scale-105 transition-transform">
                            <a href={event.externalUrl} target="_blank" rel="noopener noreferrer">Comprar no Site Oficial <ArrowRight className="ml-2 w-5 h-5" /></a>
                         </Button>
                       ) : (
                         <Button asChild className="w-full h-16 bg-secondary text-white font-black rounded-3xl shadow-2xl uppercase italic text-base hover:scale-105 transition-transform shadow-secondary/20">
                            <Link href="#bilheteria">Garantir Meu Lugar <ArrowRight className="ml-2 w-5 h-5" /></Link>
                         </Button>
                       )}
                    </div>
                 </div>
              </Card>

              {/* CONTEXTO SOCIAL RESUMIDO */}
              <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-10 space-y-8 border border-border/50">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-secondary/5 rounded-2xl text-secondary"><Users className="w-6 h-6" /></div>
                    <h3 className="text-sm font-black uppercase italic text-primary tracking-tighter leading-tight">Comunidade Vibrante</h3>
                 </div>
                 <p className="text-xs text-muted-foreground leading-relaxed font-medium uppercase">
                    {(event.interestedCount || 0).toLocaleString()} pessoas marcaram interesse nesta experiência. Faça parte do momento.
                 </p>
                 <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Transação Segura</span>
                 </div>
              </Card>
           </aside>
        </div>
      </main>

      {/* SHARE MODAL INTEGRADO */}
      {org && (
        <ShareModal 
          isOpen={isShareModalOpen} 
          onOpenChange={setIsShareModalOpen} 
          data={{
            title: event.title,
            username: username,
            url: `/${username}/${event.slug || event.id}`,
            logoUrl: event.image,
            bannerUrl: event.image,
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
