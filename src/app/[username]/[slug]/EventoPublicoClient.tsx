
"use client"

import * as React from "react"
import { useDoc, useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where, orderBy } from "firebase/firestore"
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
  Users,
  ShieldAlert,
  InfoIcon,
  RefreshCw,
  ChevronRight
} from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { BilheteriaPublic, EventInterest, EventSEO, EventCoOrganizers } from "@/components/events"
import { FollowButton } from "@/components/organizer/FollowButton"
import Footer from "@/components/layout/Footer"
import { AgeRatingBadge, AgeRatingWarning } from "@/lib/age-rating"
import { useCurrency } from "@/contexts/CurrencyContext"
import { UserNav } from "@/components/layout/UserNav"
import { ShareModal } from "@/components/sharing/ShareModal"
import { RichText } from "@/components/ui/rich-text"
import { toast } from "@/hooks/use-toast"
import dynamic from "next/dynamic"
import { format, startOfToday } from "date-fns"
import { ptBR } from "date-fns/locale"

// Carregamento Client-Only para o Mapa para evitar ReferenceError: document is not defined
const LocationMap = dynamic(() => import("@/components/events/LocationMap").then(mod => mod.LocationMap), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center text-[10px] font-black uppercase opacity-20">Carregando Mapa...</div>
})

interface EventoPublicoClientProps {
  id: string
  username: string
}

export default function EventoPublicoClient({ id, username }: EventoPublicoClientProps) {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  
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

  // Consulta de Ocorrências (Sessões)
  const occurrencesQuery = useMemoFirebase(() => {
    if (!db || !id || !event?.isRecurring) return null;
    return query(
      collection(db, "recurring_occurrences"),
      where("parentId", "==", id),
      where("status", "==", "active"),
      orderBy("date", "asc")
    )
  }, [db, id, event?.isRecurring]);

  const { data: rawOccurrences, loading: loadingOccurrences } = useCollection<any>(occurrencesQuery);

  const upcomingOccurrences = React.useMemo(() => {
    if (!rawOccurrences) return [];
    const todayStr = format(startOfToday(), 'yyyy-MM-dd');
    return rawOccurrences.filter((occ: any) => occ.date >= todayStr);
  }, [rawOccurrences]);

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
  
  // Lógica de Venda
  const isExternalSale = event.type === 'externo' && event.externalUrl;
  const isVibySale = event.type === 'interno' && event.ticketMode !== 'none';
  const isDivulgacao = event.type === 'divulgacao' || (!isExternalSale && !isVibySale);

  const isRecurringHub = event.isRecurring === true;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white overflow-x-hidden w-full">
      <EventSEO event={event} username={username} />
      
      {/* HEADER GLOBAL */}
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
             <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shrink-0">
                <ArrowLeft className="w-5 h-5" />
             </Button>
             <Link href="/" className="flex items-center gap-2 group overflow-hidden">
                {settings?.logoUrl ? (
                  <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-8 sm:h-10 w-auto object-contain" priority unoptimized />
                ) : (
                  <span className="text-lg sm:text-xl font-black tracking-tight italic uppercase text-primary truncate">{siteName}</span>
                )}
             </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
             <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hidden sm:flex"
                onClick={() => setIsShareModalOpen(true)}
             >
                <Share2 className="w-5 h-5" />
             </Button>
             {user ? <UserNav /> : (
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button variant="ghost" asChild className="font-bold uppercase text-[9px] sm:text-[10px] tracking-widest px-2 sm:px-4">
                    <Link href="/login">Entrar</Link>
                  </Button>
                  <Button asChild className="bg-secondary text-white font-black uppercase italic text-[9px] sm:text-[10px] tracking-widest rounded-full px-4 sm:px-6 shadow-lg">
                    <Link href="/cadastro">Criar Conta</Link>
                  </Button>
                </div>
             )}
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative h-[400px] sm:h-[500px] md:h-[700px] w-full overflow-hidden bg-primary shrink-0">
         <Image 
           src={event.image || "https://picsum.photos/seed/event/1920/1080"} 
           alt={event.title} 
           fill 
           className={cn("object-cover", isEnded && "grayscale")}
           priority
           unoptimized 
         />
         <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
         <div className="absolute bottom-0 left-0 w-full p-6 sm:p-10 md:p-20">
            <div className="container mx-auto max-w-6xl">
              <div className="max-w-4xl space-y-4 sm:space-y-6">
                 <div className="flex flex-wrap gap-2 sm:gap-3">
                    <Badge className="bg-secondary text-white border-none px-4 sm:px-5 h-7 sm:h-8 rounded-full font-black uppercase italic text-[9px] sm:text-[10px] tracking-widest shadow-lg">
                       {event.categoryName || "Experiência"}
                    </Badge>
                    {isRecurringHub && (
                      <Badge className="bg-primary text-white border-none px-4 sm:px-5 h-7 sm:h-8 rounded-full font-black uppercase text-[9px] sm:text-[10px] tracking-widest flex items-center gap-2">
                        <RefreshCw className="w-3 h-3 animate-spin-slow" /> Evento Recorrente
                      </Badge>
                    )}
                    {isEnded && <Badge className="bg-red-500 text-white border-none px-4 sm:px-5 h-7 sm:h-8 rounded-full font-black uppercase text-[9px] sm:text-[10px] tracking-widest">Encerrado</Badge>}
                    <AgeRatingBadge code={event.ageRating?.code || "free"} className="bg-white/95 p-1 rounded-xl shadow-lg h-7 sm:h-8" showLabel />
                 </div>
                 <h1 className="text-3xl sm:text-5xl md:text-8xl font-black text-white uppercase italic tracking-tighter leading-[0.9] break-words">{event.title}</h1>
                 <div className="flex flex-wrap gap-3 sm:gap-4 text-white/90 text-[11px] sm:text-sm font-bold uppercase tracking-tight">
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl border border-white/10 max-w-full">
                       <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-secondary shrink-0" /> <span className="truncate">{event.address?.venueName || event.location}, {event.city}</span>
                    </div>
                 </div>
              </div>
            </div>
         </div>
      </section>

      {/* BARRA DE AÇÕES RÁPIDAS */}
      <div className="bg-white border-b border-border/60 sticky top-16 z-40 shadow-sm w-full overflow-hidden">
         <div className="container mx-auto px-4 max-w-6xl py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-center gap-6 sm:gap-10 w-full sm:w-auto overflow-x-auto scrollbar-hide pb-1 sm:pb-0">
               <EventInterest event={event} showButton={true} className="gap-4 sm:gap-6 shrink-0" />
               <div className="hidden md:flex flex-col shrink-0">
                  <span className="text-xl font-black text-primary leading-none">{(event.sharesCount || 0).toLocaleString()}</span>
                  <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Compartilhados</span>
               </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
               <Button 
                 onClick={handleCopyLink}
                 variant="outline" 
                 className="flex-1 sm:flex-none h-11 sm:h-12 rounded-2xl border-2 gap-2 font-black uppercase italic text-[10px] sm:text-xs px-4 sm:px-6"
               >
                  <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Copiar
               </Button>
               <Button 
                 onClick={() => setIsShareModalOpen(true)}
                 variant="outline" 
                 className="flex-1 sm:flex-none h-11 sm:h-12 rounded-2xl border-2 gap-2 font-black uppercase italic text-[10px] sm:text-xs px-4 sm:px-6"
               >
                  <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Material
               </Button>
               
               {isExternalSale && (
                 <Button asChild className="w-full sm:w-auto h-11 sm:h-12 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-[10px] sm:text-xs px-6 sm:px-8 hover:scale-105 transition-transform">
                   <a href={event.externalUrl} target="_blank" rel="noopener noreferrer">Comprar no Site Oficial <ExternalLink className="ml-2 w-3.5 h-3.5 sm:w-4 sm:h-4" /></a>
                 </Button>
               )}

               {isVibySale && !isRecurringHub && (
                 <Button asChild className="w-full sm:w-auto h-11 sm:h-12 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-[10px] sm:text-xs px-6 sm:px-8 hover:scale-105 transition-transform shadow-secondary/20">
                   <Link href="#bilheteria">Garantir Ingresso <ArrowRight className="ml-2 w-3.5 h-3.5 sm:w-4 sm:h-4" /></Link>
                 </Button>
               )}
            </div>
         </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-8 sm:py-12 md:py-20 max-w-6xl w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-16">
           
           <div className="lg:col-span-8 space-y-12 sm:space-y-20">
              
              {/* BLOCO DE DATA E HORA (Apenas se não for hub de recorrente) */}
              {!isRecurringHub && (
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <Card className="border-none shadow-sm rounded-[2rem] sm:rounded-[2.5rem] bg-white p-6 sm:p-8 md:p-10 flex items-center gap-4 sm:gap-6 group hover:shadow-md transition-all border border-border/50">
                      <div className="p-4 sm:p-5 bg-secondary/5 rounded-2xl sm:rounded-3xl text-secondary group-hover:bg-secondary group-hover:text-white transition-colors shrink-0">
                        <Calendar className="w-8 h-8 sm:w-10 sm:h-10" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] sm:tracking-[0.3em] mb-1">Início</p>
                        <p className="text-lg sm:text-xl font-black text-primary uppercase italic leading-none truncate">
                          {dStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                        </p>
                        <p className="text-xs sm:text-sm font-bold text-secondary mt-1">{dStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}h</p>
                      </div>
                  </Card>
                  <Card className="border-none shadow-sm rounded-[2rem] sm:rounded-[2.5rem] bg-white p-6 sm:p-8 md:p-10 flex items-center gap-4 sm:gap-6 group hover:shadow-md transition-all border border-border/50">
                      <div className="p-4 sm:p-5 bg-primary/5 rounded-2xl sm:rounded-3xl text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                        <Clock className="w-8 h-8 sm:w-10 sm:h-10" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] sm:tracking-[0.3em] mb-1">Encerramento</p>
                        {dEnd ? (
                          <>
                            <p className="text-lg sm:text-xl font-black text-primary uppercase italic leading-none truncate">
                              {dEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                            </p>
                            <p className="text-xs sm:text-sm font-bold text-secondary mt-1">{dEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}h</p>
                          </>
                        ) : (
                          <p className="text-xs sm:text-sm font-bold text-muted-foreground italic uppercase">Conforme agenda</p>
                        )}
                      </div>
                  </Card>
                </section>
              )}

              {/* PRÓXIMAS SESSÕES (EVENTOS RECORRENTES) */}
              {isRecurringHub && (
                <section className="space-y-6 sm:space-y-8 animate-in fade-in duration-700">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tighter text-primary">Próximas Sessões</h2>
                    </div>
                    {loadingOccurrences && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  </div>

                  {upcomingOccurrences.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {upcomingOccurrences.slice(0, 10).map((occ: any) => (
                        <Link key={occ.id} href={`/recorrente/${occ.id}`}>
                          <Card className="border-none shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all rounded-[2rem] bg-white group cursor-pointer overflow-hidden border border-border/50">
                            <CardContent className="p-6 sm:p-8 flex items-center justify-between">
                               <div className="flex items-center gap-6">
                                  <div className="flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-3xl group-hover:bg-secondary/10 transition-colors">
                                     <span className="text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground">{new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}</span>
                                     <span className="text-2xl sm:text-3xl font-black text-primary">{occ.date.split('-')[2]}</span>
                                  </div>
                                  <div className="space-y-1">
                                     <p className="font-black text-lg sm:text-xl uppercase italic text-primary leading-tight">
                                       {new Date(occ.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}
                                     </p>
                                     <div className="flex items-center gap-3 text-[10px] sm:text-xs font-bold text-muted-foreground uppercase">
                                        <span className="flex items-center gap-1.5">
                                          <Clock className="w-3 h-3 text-secondary" /> {occ.startTime} às {occ.endTime}
                                        </span>
                                     </div>
                                  </div>
                               </div>
                               <div className="flex items-center gap-4">
                                  <Badge variant="outline" className="hidden sm:flex text-[8px] font-black uppercase border-dashed">Disponível</Badge>
                                  <div className="p-2 bg-primary text-white rounded-full opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1">
                                     <ChevronRight className="w-4 h-4" />
                                  </div>
                               </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    !loadingOccurrences && (
                      <Card className="border-none shadow-sm rounded-[2rem] bg-white p-12 text-center border border-dashed border-border/60">
                        <Calendar className="w-10 h-10 text-muted-foreground opacity-10 mx-auto mb-4" />
                        <p className="text-sm font-bold text-muted-foreground uppercase">Nenhuma sessão agendada no momento.</p>
                      </Card>
                    )
                  )}
                </section>
              )}

              {/* DESCRIÇÃO EDITORIAL */}
              <section className="space-y-6 sm:space-y-8">
                 <div className="flex items-center gap-3 px-2">
                    <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><Info className="w-5 h-5" /></div>
                    <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tighter text-primary">Sobre a Experiência</h2>
                 </div>
                 <Card className="border-none shadow-sm rounded-[2.5rem] sm:rounded-[3rem] bg-white overflow-hidden p-8 sm:p-10 md:p-16 relative border border-border/50">
                    <RichText 
                      content={event.description} 
                      className="text-base sm:text-lg md:text-xl font-medium text-foreground/80 leading-relaxed max-w-3xl break-words" 
                    />
                    <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-5 pointer-events-none">
                       <Globe className="w-32 h-32 sm:w-48 sm:h-48" />
                    </div>
                 </Card>
              </section>

              {/* BILHETERIA (Apenas se não for hub de recorrente) */}
              {isVibySale && !isRecurringHub && (
                <div id="bilheteria" className="scroll-mt-32 w-full overflow-hidden">
                   <BilheteriaPublic 
                    event={event} 
                    globalFees={globalFees} 
                    promotions={promotions} 
                    orgSettings={org} 
                   />
                </div>
              )}

              {/* LOCALIZAÇÃO E MAPA */}
              <section className="space-y-6 sm:space-y-8">
                 <div className="flex items-center gap-3 px-2">
                    <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><MapIcon className="w-5 h-5" /></div>
                    <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary">Localização</h2>
                 </div>
                 <Card className="border-none shadow-sm rounded-[2.5rem] sm:rounded-[3rem] bg-white overflow-hidden p-0 relative group border border-border/50">
                    <div className="h-[300px] sm:h-[400px] w-full">
                       <LocationMap 
                         latitude={event.latitude || -23.55052} 
                         longitude={event.longitude || -46.633308} 
                         interactive={false} 
                         onChange={() => {}} 
                       />
                    </div>
                    <CardContent className="p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8">
                       <div className="space-y-2 text-center md:text-left min-w-0 flex-1">
                          <h3 className="text-lg sm:text-xl font-black uppercase italic tracking-tighter text-primary break-words">{event.address?.venueName || event.location}</h3>
                          <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-relaxed max-w-md break-words">
                            {event.address?.formattedAddress || `${event.address?.addressLine1}, ${event.address?.city} - ${event.address?.stateRegion}`}
                          </p>
                       </div>
                       <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
                          <Button asChild variant="outline" className="flex-1 sm:flex-none rounded-2xl h-12 px-6 sm:px-8 font-black uppercase italic text-[10px] sm:text-xs gap-2 sm:gap-3 border-secondary/20 text-secondary hover:bg-secondary/5 transition-all">
                             <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address?.formattedAddress || event.location)}`} target="_blank" rel="noopener noreferrer">
                                <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Google Maps
                             </a>
                          </Button>
                          <Button asChild variant="outline" className="flex-1 sm:flex-none rounded-2xl h-12 px-6 sm:px-8 font-black uppercase italic text-[10px] sm:text-xs gap-2 sm:gap-3 border-primary/10 text-primary hover:bg-muted transition-all">
                             <a href={`https://www.waze.com/ul?q=${encodeURIComponent(event.address?.formattedAddress || event.location)}&navigate=yes`} target="_blank" rel="noopener noreferrer">
                                <MapIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Waze
                             </a>
                          </Button>
                       </div>
                    </CardContent>
                 </Card>
              </section>

              <EventCoOrganizers isPublic eventId={id} currentOrgId={event.organizationId} className="pt-10 border-t border-dashed" />
           </div>

           {/* SIDEBAR */}
           <aside className="lg:col-span-4 space-y-6 sm:space-y-8">
              <Card className="border-none shadow-sm rounded-[2rem] sm:rounded-[2.5rem] bg-white overflow-hidden sticky top-24 sm:top-40 border border-border/50">
                 <div className="p-6 sm:p-8 md:p-10 space-y-8 sm:space-y-10 relative">
                    <div className="space-y-6">
                       <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] opacity-40 text-primary">Responsável</p>
                       <Link href={`/${org?.username || username}`} className="flex items-center gap-4 sm:gap-5 group">
                          <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-4 border-muted/30 p-0.5 group-hover:scale-105 transition-transform rounded-[1.5rem] sm:rounded-[1.8rem] overflow-hidden shrink-0">
                             <AvatarImage src={org?.avatar} className="object-cover" />
                             <AvatarFallback className="font-black bg-muted text-xl sm:text-2xl">{org?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="space-y-0.5 min-w-0">
                             <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-black text-lg sm:text-xl uppercase italic leading-tight tracking-tighter text-primary truncate">{org?.name || "Organizador"}</h4>
                                {(org?.verified || org?.isVerified) && <BadgeCheck className="w-4 h-4 sm:w-5 sm:h-5 fill-blue-500 text-white shrink-0" />}
                             </div>
                             <div className="flex flex-col">
                                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-secondary truncate">@{org?.username || username}</span>
                                {isVibyCurated && <Badge variant="secondary" className="w-fit h-4 px-1.5 text-[7px] font-black uppercase mt-1">Curadoria Viby</Badge>}
                             </div>
                          </div>
                       </Link>
                    </div>

                    <Separator className="bg-muted" />

                    <div className="space-y-6 sm:space-y-8">
                       <div className="flex items-center justify-between gap-4">
                          <div className="space-y-0.5 shrink-0">
                             <p className="text-[8px] font-black uppercase opacity-40 tracking-widest text-primary">Seguidores</p>
                             <p className="text-lg sm:text-xl font-black italic tracking-tighter text-primary">{(org?.followersCount || 0).toLocaleString()}</p>
                          </div>
                          <FollowButton 
                            organizationId={event.organizationId} 
                            username={org?.username || username} 
                            className="flex-1 h-9 sm:h-10 px-4 text-[8px] sm:text-[9px]"
                          />
                       </div>
                       <AgeRatingWarning code={event.ageRating?.code || "free"} />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                       {isExternalSale && !isRecurringHub && (
                         <Button asChild className="w-full h-14 sm:h-16 bg-primary text-white font-black rounded-[1.5rem] sm:rounded-3xl shadow-2xl uppercase italic text-sm sm:text-base hover:scale-105 transition-transform">
                            <a href={event.externalUrl} target="_blank" rel="noopener noreferrer">Comprar no Site Oficial <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" /></a>
                         </Button>
                       )}
                       {isVibySale && !isRecurringHub && (
                         <Button asChild className="w-full h-14 sm:h-16 bg-secondary text-white font-black rounded-[1.5rem] sm:rounded-3xl shadow-2xl uppercase italic text-sm sm:text-base hover:scale-105 transition-transform shadow-secondary/20">
                            <Link href="#bilheteria">Garantir Meu Lugar <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" /></Link>
                         </Button>
                       )}
                       {isRecurringHub && (
                         <Button asChild className="w-full h-14 sm:h-16 bg-secondary text-white font-black rounded-[1.5rem] sm:rounded-3xl shadow-2xl uppercase italic text-sm sm:text-base hover:scale-105 transition-transform shadow-secondary/20">
                            <Link href="#sessões">Escolher Sessão <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" /></Link>
                         </Button>
                       )}
                    </div>
                 </div>
              </Card>

              <Card className="border-none shadow-sm rounded-[2rem] sm:rounded-[2.5rem] bg-white p-6 sm:p-8 md:p-10 space-y-6 sm:space-y-8 border border-border/50">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-secondary/5 rounded-2xl text-secondary shrink-0"><Users className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                    <h3 className="text-xs sm:text-sm font-black uppercase italic text-primary tracking-tighter leading-tight">Comunidade Vibrante</h3>
                 </div>
                 <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed font-medium uppercase">
                    {(event.interestedCount || 0).toLocaleString()} pessoas marcaram interesse nesta experiência. Faça parte do momento.
                 </p>
                 
                 {!isDivulgacao && (
                   <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl">
                    {isExternalSale ? (
                       <>
                          <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 shrink-0" />
                          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary truncate">Link Oficial</span>
                       </>
                    ) : (
                       <>
                          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 shrink-0" />
                          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary truncate">Transação Segura</span>
                       </>
                    )}
                   </div>
                 )}
                 {isDivulgacao && (
                   <div className="flex items-center gap-3 p-4 bg-secondary/5 rounded-2xl border border-secondary/10">
                      <InfoIcon className="w-4 h-4 sm:w-5 sm:h-5 text-secondary shrink-0" />
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary truncate">Informações Oficiais</span>
                   </div>
                 )}
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
