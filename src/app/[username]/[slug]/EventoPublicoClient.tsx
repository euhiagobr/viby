"use client"

import * as React from "react"
import { useDoc, useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Calendar, 
  MapPin, 
  ArrowLeft, 
  Info,
  BadgeCheck,
  Loader2,
  Share2,
  Tag,
  Users,
  ShieldAlert,
  Clock,
  Navigation
} from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { BilheteriaPublic, EventSEO, EventCoOrganizers } from "@/components/events"
import { FollowButton } from "@/components/organizer/FollowButton"
import Footer from "@/components/layout/Footer"
import { AgeRatingBadge, AgeRatingWarning } from "@/lib/age-rating"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { ShareModal } from "@/components/sharing/ShareModal"
import { RichText } from "@/components/ui/rich-text"
import { toast } from "@/hooks/use-toast"
import dynamic from "next/dynamic"
import { format, startOfToday, addDays } from "date-fns"
import { EventActionModal } from "@/components/events/EventActionModal"
import { formatFullAddress } from "@/lib/location-utils"

const VIBY_OFFICIAL_UID = "dd9665af-ad6d-405c-a51d-08220fecf96f";

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
  const [isActionModalOpen, setIsActionModalOpen] = React.useState(false)
  const [now, setNow] = React.useState<Date | null>(null)

  // Atualiza o relógio a cada minuto para manter sincronia de visibilidade
  React.useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const eventRef = React.useMemo(() => (db && id) ? doc(db, "events", id) : null, [db, id])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const organizationRef = React.useMemo(() => 
    (db && event?.organizationId) ? doc(db, "organizations", event.organizationId) : null, 
    [db, event?.organizationId]
  )
  const { data: org } = useDoc<any>(organizationRef)

  const feesRef = React.useMemo(() => (db ? doc(db, 'settings', 'fees') : null), [db])
  const { data: globalFees } = useDoc<any>(feesRef)

  const promosRef = React.useMemo(() => (db ? doc(db, 'settings', 'promotions') : null), [db])
  const { data: promotions } = useDoc<any>(promosRef)

  const occurrencesQuery = useMemoFirebase(() => {
    if (!db || !id || !event?.isRecurring) return null;
    const yesterdayStr = format(addDays(startOfToday(), -1), 'yyyy-MM-dd')
    return query(
      collection(db, "recurring_occurrences"),
      where("parentId", "==", id),
      where("status", "==", "active"),
      where("date", ">=", yesterdayStr)
    )
  }, [db, id, event?.isRecurring]);

  const { data: rawOccurrences } = useCollection<any>(occurrencesQuery);

  const upcomingOccurrences = React.useMemo(() => {
    if (!rawOccurrences || !now) return [];
    
    return rawOccurrences
      .map(o => ({ ...o, _dt: new Date(o.date + 'T' + (o.startTime || '00:00') + ':00') }))
      .filter(o => {
        const endThreshold = new Date(o._dt.getTime() + 6 * 60 * 60 * 1000);
        return now < endThreshold;
      })
      .sort((a: any, b: any) => a._dt.getTime() - b._dt.getTime());
  }, [rawOccurrences, now]);

  const effectiveEventData = React.useMemo(() => {
    if (!event) return null;
    if (!event.isRecurring || upcomingOccurrences.length === 0) return event;

    const nextOcc = upcomingOccurrences[0];
    const nextDateStr = nextOcc.date + 'T' + (nextOcc.startTime || '19:00') + ':00';
    
    return {
      ...event,
      date: nextDateStr,
      _isAutoUpdated: true
    };
  }, [event, upcomingOccurrences]);

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "A definir";
    try {
      let d: Date;
      if (dateValue.toDate) d = dateValue.toDate();
      else d = new Date(dateValue);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) { return "---"; }
  };

  const formatTime = (dateValue: any) => {
    if (!dateValue) return "";
    try {
      let d: Date;
      if (dateValue.toDate) d = dateValue.toDate();
      else d = new Date(dateValue);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ""; }
  };

  // UI Components
  const content = React.useMemo(() => {
    if (eventLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-secondary" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando Experiência...</p>
        </div>
      );
    }

    if (!event || !effectiveEventData) {
      return (
        <div className="flex flex-col items-center justify-center py-32 gap-6 text-center px-6">
           <ShieldAlert className="w-16 h-16 text-muted-foreground opacity-20" />
           <div className="space-y-2">
              <h2 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Evento Indisponível</h2>
              <p className="text-muted-foreground font-medium max-w-sm mx-auto uppercase text-xs leading-relaxed">
                 O projeto que você procura não foi localizado ou não está mais ativo na rede Viby.
              </p>
           </div>
           <Button asChild className="rounded-xl h-12 px-8 font-black uppercase italic">
              <Link href="/dashboard">Ver Outros Eventos</Link>
           </Button>
        </div>
      );
    }

    const start = { date: formatDate(effectiveEventData.date), time: formatTime(effectiveEventData.date) };
    const end = effectiveEventData.endDate ? { date: formatDate(effectiveEventData.endDate), time: formatTime(effectiveEventData.endDate) } : null;

    const isCuradoria = event.curationType === 'curadoria' || 
                        event.curatorProfile === 'viby' || 
                        (event.organizationId === VIBY_OFFICIAL_UID && (event.type === 'divulgacao' || event.type === 'externo'));

    const addressLines = formatFullAddress(event.address || {
      venueName: event.location,
      city: event.city,
      stateRegion: event.state
    });

    const locationQuery = encodeURIComponent(addressLines.join(' '));

    // CORREÇÃO: Resolução consistente de coordenadas para o mapa
    const lat = event.latitude !== undefined && event.latitude !== null ? event.latitude : (event.address?.latitude !== undefined ? event.address.latitude : -23.55052);
    const lng = event.longitude !== undefined && event.longitude !== null ? event.longitude : (event.address?.longitude !== undefined ? event.address.longitude : -46.633308);

    console.log("[Viby-Audit] Renderizando Mapa Público:", { id: event.id, lat, lng });

    return (
      <div className="animate-in fade-in duration-700">
        <div className="relative h-[40vh] md:h-[60vh] w-full overflow-hidden">
          <Image 
            src={event.image || "https://picsum.photos/seed/vibyeventos/1200/800"} 
            alt={event.title} 
            fill 
            className="object-cover"
            priority
            unoptimized 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/30 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6 md:p-12 w-full">
            <div className="container mx-auto max-w-6xl space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-secondary text-white border-none text-[10px] font-black uppercase px-4 py-1.5 rounded-full shadow-lg">
                  {event.categoryName || "Evento"}
                </Badge>
                {isCuradoria && <Badge className="bg-[#ffdf00] text-primary border-none text-[10px] font-black uppercase px-4 py-1.5 rounded-full shadow-lg">Curadoria Oficial</Badge>}
              </div>
              <h1 className="text-4xl md:text-7xl font-black text-primary uppercase italic tracking-tighter leading-[0.85]">{event.title}</h1>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12 max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-12">
            <section className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Sobre a Experiência</h3>
               <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                  <CardContent className="p-8 md:p-10">
                    <div className="prose prose-slate max-w-none">
                      <RichText content={event.description} className="text-lg md:text-xl font-medium text-foreground/80 leading-relaxed" />
                    </div>
                  </CardContent>
               </Card>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Card className="border-none shadow-sm rounded-3xl bg-white p-6 flex items-center gap-4">
                  <div className="p-3 bg-secondary/5 rounded-2xl text-secondary"><Calendar className="w-6 h-6" /></div>
                  <div><p className="text-[9px] font-black uppercase text-muted-foreground">Data</p><p className="font-bold text-sm text-primary uppercase">{start.date}</p></div>
               </Card>
               <Card className="border-none shadow-sm rounded-3xl bg-white p-6 flex items-center gap-4">
                  <div className="p-3 bg-secondary/5 rounded-2xl text-secondary"><Clock className="w-6 h-6" /></div>
                  <div><p className="text-[9px] font-black uppercase text-muted-foreground">Horário</p><p className="font-bold text-sm text-primary uppercase">{start.time} {end && `às ${end.time}`}</p></div>
               </Card>
            </div>

            <section className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Localização</h3>
               <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                  <div className="h-64 w-full"><LocationMap latitude={lat} longitude={lng} interactive={false} onChange={() => {}} /></div>
                  <CardContent className="p-8 flex flex-col md:flex-row justify-between items-center gap-6">
                     <div className="space-y-1 text-center md:text-left">
                        {addressLines.map((line, idx) => (
                          <p key={idx} className={cn(
                            "leading-tight uppercase",
                            idx === 0 ? "font-black text-2xl italic tracking-tighter text-primary" : "text-xs font-medium text-muted-foreground"
                          )}>
                            {line}
                          </p>
                        ))}
                     </div>
                     <div className="flex flex-col sm:flex-row gap-3">
                        <Button variant="outline" className="rounded-xl h-12 px-6 gap-2 font-bold uppercase text-[10px] border-secondary text-secondary" asChild>
                           <a href={`https://www.google.com/maps/search/?api=1&query=${locationQuery}`} target="_blank">
                              <MapPin className="w-4 h-4" /> Google Maps
                           </a>
                        </Button>
                        <Button variant="outline" className="rounded-xl h-12 px-6 gap-2 font-bold uppercase text-[10px] border-secondary text-secondary" asChild>
                           <a href={`https://www.waze.com/ul?q=${locationQuery}&navigate=yes`} target="_blank">
                              <Navigation className="w-4 h-4" /> Waze
                           </a>
                        </Button>
                     </div>
                  </CardContent>
               </Card>
            </section>
            
            <EventCoOrganizers eventId={id} currentOrgId={event.organizationId} isPublic className="mt-12" />
          </div>

          <aside className="lg:col-span-4 space-y-8">
            <section className="sticky top-24 space-y-8">
               <AgeRatingBadge code={event.ageRatingCode || "free"} showLabel className="px-2" />
               
               <BilheteriaPublic 
                 event={effectiveEventData} 
                 globalFees={globalFees} 
                 promotions={promotions} 
                 orgSettings={org} 
               />

               <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
                  <div className="flex items-center gap-4">
                     <Avatar className="h-16 w-16 border-2 border-secondary/10 p-0.5">
                        <AvatarImage src={org?.avatar} className="rounded-full object-cover" />
                        <AvatarFallback className="font-bold text-xl uppercase">{org?.name?.charAt(0)}</AvatarFallback>
                     </Avatar>
                     <div className="flex-1">
                        <div className="flex items-center gap-1.5"><h4 className="font-bold text-base leading-none">{org?.name}</h4>{(org?.verified || org?.isVerified) && <BadgeCheck className="w-4 h-4 text-blue-500" />}</div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">@{org?.username}</p>
                     </div>
                  </div>
                  <div className="flex gap-2">
                     <FollowButton organizationId={event.organizationId} username={org?.username} className="flex-1" />
                     <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-2" onClick={() => setIsShareModalOpen(true)}><Share2 className="w-5 h-5" /></Button>
                  </div>
               </Card>

               <div className="flex items-center justify-center">
                  <Button variant="link" className="text-[9px] font-black uppercase text-muted-foreground opacity-30 hover:opacity-100" onClick={() => setIsActionModalOpen(true)}>Problemas com este evento?</Button>
               </div>
            </section>
          </aside>
        </div>
      </div>
    );
  }, [event, eventLoading, effectiveEventData, org, globalFees, promotions, id, username, isShareModalOpen, isActionModalOpen]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white overflow-x-hidden w-full">
      <EventSEO event={effectiveEventData} username={username} />
      <PublicHeader showBack />

      <main className="flex-1">
        {content}
      </main>

      <Footer />

      {effectiveEventData && (
        <ShareModal 
          isOpen={isShareModalOpen} 
          onOpenChange={setIsShareModalOpen} 
          data={{
            title: effectiveEventData.title,
            username: username,
            url: `/${username}/${effectiveEventData.slug || id}`,
            logoUrl: effectiveEventData.image,
            bannerUrl: effectiveEventData.image,
            type: 'event',
            organizationId: effectiveEventData.organizationId,
            eventId: id
          }}
        />
      )}

      <EventActionModal 
        isOpen={isActionModalOpen} 
        onOpenChange={setIsActionModalOpen} 
        event={effectiveEventData} 
      />
    </div>
  )
}
