'use client';

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
  BadgeCheck,
  Loader2,
  Share2,
  ShieldAlert,
  Clock,
  Navigation,
  Trophy,
  Zap,
  Ticket
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { cn, safeParseDate } from "@/lib/utils"
import { BilheteriaPublic, EventCoOrganizers } from "@/components/events"
import { FollowButton } from "@/components/organizer/FollowButton"
import Footer from "@/components/layout/Footer"
import { AgeRatingBadge } from "@/lib/age-rating"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { ShareModal } from "@/components/sharing/ShareModal"
import { RichText } from "@/components/ui/rich-text"
import dynamic from "next/dynamic"
import { format, startOfToday } from "date-fns"
import { ptBR } from "date-fns/locale"
import { EventActionModal } from "@/components/events/EventActionModal"
import { formatFullAddress, type Coordinates } from "@/lib/location-utils"
import { calculateDistanceMeters } from "@/lib/event-scoring-utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EventRelatedEvents } from "@/components/events/EventRelatedEvents"

const LocationMap = dynamic(() => import("@/components/events/LocationMap").then(mod => mod.LocationMap), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center text-[10px] font-black uppercase opacity-20">Carregando Mapa...</div>
})

interface EventoPublicoClientProps {
  id: string
  username: string
  initialData?: any
}

export default function EventoPublicoClient({ id, username, initialData }: EventoPublicoClientProps) {
  const db = useFirestore()
  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false)
  const [isActionModalOpen, setIsActionModalOpen] = React.useState(false)
  const [selectedOccurrenceId, setSelectedOccurrenceId] = React.useState<string | null>(null)
  const [userLocation, setUserLocation] = React.useState<Coordinates | null>(null)
  const [now, setNow] = React.useState<Date>(new Date())

  const eventRef = React.useMemo(() => (db && id) ? doc(db, "events", id) : null, [db, id])
  const { data: realTimeEvent, loading: eventLoading } = useDoc<any>(eventRef)
  const event = realTimeEvent || initialData;

  const feesRef = React.useMemo(() => (db ? doc(db, 'settings', 'fees') : null), [db]);
  const { data: globalFees } = useDoc<any>(feesRef);

  const promosRef = React.useMemo(() => (db ? doc(db, 'settings', 'promotions') : null), [db]);
  const { data: promotions } = useDoc<any>(promosRef);

  React.useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    import("@/lib/location-utils").then(mod => {
      mod.getCurrentLocation().then(loc => { if(loc) setUserLocation(loc); }).catch(() => {});
    });
    return () => clearInterval(timer);
  }, []);

  const distanceMeters = React.useMemo(() => {
    if (userLocation && (event?.latitude !== undefined || event?.address?.latitude !== undefined)) {
      const lat = event.address?.latitude ?? event.latitude;
      const lng = event.address?.longitude ?? event.longitude;
      if (lat !== undefined && lng !== undefined) {
        return calculateDistanceMeters(userLocation, { latitude: lat, longitude: lng });
      }
    }
    return null;
  }, [userLocation, event]);

  const organizationRef = React.useMemo(() => 
    (db && event?.organizationId) ? doc(db, "organizations", event.organizationId) : null, 
    [db, event?.organizationId]
  )
  const { data: org } = useDoc<any>(organizationRef)

  const occurrencesQuery = useMemoFirebase(() => {
    if (!db || !id || !event?.isRecurring) return null;
    const today = startOfToday();
    return query(
      collection(db, "recurring_occurrences"),
      where("parentId", "==", id),
      where("status", "==", "active"),
      where("date", ">=", format(today, 'yyyy-MM-dd'))
    )
  }, [db, id, event?.isRecurring]);

  const { data: upcomingOccurrences, loading: occurrencesLoading } = useCollection<any>(occurrencesQuery);

  const selectedOccurrenceData = React.useMemo(() => {
    if (!upcomingOccurrences || upcomingOccurrences.length === 0) return null;
    return upcomingOccurrences.find(o => o.id === selectedOccurrenceId) || upcomingOccurrences[0];
  }, [upcomingOccurrences, selectedOccurrenceId]);

  const formatDate = (dateValue: any) => {
    const d = safeParseDate(dateValue);
    if (!d) return "A definir";
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const formatTime = (dateValue: any) => {
    const d = safeParseDate(dateValue);
    if (!d) return "";
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  if (eventLoading && !initialData) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando...</p>
    </div>
  );

  if (!event) return (
    <div className="flex flex-col items-center justify-center py-32 gap-6 text-center px-6">
        <ShieldAlert className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Evento Indisponível</h2>
        <Button asChild className="rounded-xl h-12 px-8 font-black uppercase italic">
          <Link href="/dashboard">Explorar Outros</Link>
        </Button>
    </div>
  );
  
  const displayDate = selectedOccurrenceData?.start_date || event.startDate || event.date;
  const start = { date: formatDate(displayDate), time: formatTime(displayDate) };
  const addressLines = formatFullAddress(event.address || { venueName: event.location, city: event.city, stateRegion: event.state });

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      <PublicHeader showBack />

      <main className="flex-1">
        {/* EVENT HERO - BOLD & DYNAMIC */}
        <div className="relative h-[45vh] md:h-[65vh] w-full overflow-hidden bg-black">
          <Image 
            src={event.image || "/img/placeholder.png"} 
            alt={event.title} 
            fill 
            className="object-cover opacity-80"
            priority
            unoptimized 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f8fafc] via-transparent to-black/40" />
          
          <div className="absolute bottom-0 left-0 p-6 md:p-12 w-full z-10">
            <div className="container mx-auto max-w-6xl space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-secondary text-white border-none text-[10px] font-black uppercase px-4 py-1.5 rounded-full shadow-lg">
                  {event.categoryName || "Evento"}
                </Badge>
                {event.tags?.includes('copa') && (
                  <Badge className="bg-[#ffdf00] text-[#002776] border-none text-[10px] font-black uppercase px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                    <Trophy className="w-3 h-3 fill-current" /> Copa 2026
                  </Badge>
                )}
              </div>
              <h1 className="text-4xl md:text-8xl font-black text-white uppercase italic tracking-tighter leading-[0.8] drop-shadow-2xl">
                {event.title}
              </h1>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12 max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-12">
            
            {event.isRecurring && upcomingOccurrences && upcomingOccurrences.length > 0 && (
               <section className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-secondary" /> Escolha uma Data
                  </h3>
                  <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8">
                     <Select value={selectedOccurrenceId || upcomingOccurrences[0]?.id} onValueChange={setSelectedOccurrenceId}>
                        <SelectTrigger className="h-14 rounded-2xl border-dashed border-secondary/30 font-bold text-lg px-6 uppercase italic text-primary">
                           <SelectValue placeholder="Selecione a data e horário" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                           {upcomingOccurrences.map((occ) => (
                              <SelectItem key={occ.id} value={occ.id} className="py-3">
                                 <div className="flex items-center gap-4">
                                    <Calendar className="w-4 h-4 text-secondary" />
                                    <span className="font-bold text-sm">
                                      {format(safeParseDate(occ.start_date) || new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })} | {occ.startTime}
                                    </span>
                                 </div>
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Card>
               </section>
            )}

            <section className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Informações Gerais</h3>
               <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                  <CardContent className="p-8 md:p-10">
                    <RichText content={event.description} className="prose prose-slate max-w-none text-lg md:text-xl font-medium text-foreground/80 leading-relaxed" />
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
                  <div><p className="text-[9px] font-black uppercase text-muted-foreground">Horário</p><p className="font-bold text-sm text-primary uppercase">{start.time}</p></div>
               </Card>
            </div>

            <section className="space-y-6">
               <div className="flex items-center justify-between px-2">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Localização</h3>
                  {distanceMeters !== null && (
                    <Badge className="bg-secondary/10 text-secondary border-none px-3 py-1 text-[10px] font-black uppercase">
                       {distanceMeters < 1000 ? `${distanceMeters} m` : `${(distanceMeters/1000).toFixed(1)} km`} de você
                    </Badge>
                  )}
               </div>
               <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                  <div className="h-64 w-full"><LocationMap latitude={event.latitude} longitude={event.longitude} interactive={false} onChange={() => {}} /></div>
                  <CardContent className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                     <div className="space-y-1">
                        {addressLines.map((line, idx) => (
                          <p key={idx} className={cn("leading-tight uppercase", idx === 0 ? "font-black text-2xl italic tracking-tighter text-primary" : "text-xs font-medium text-muted-foreground")}>{line}</p>
                        ))}
                     </div>
                     <div className="flex gap-2">
                        <Button variant="outline" className="rounded-xl h-11 px-6 font-bold uppercase text-[10px] border-secondary text-secondary" asChild>
                           <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLines.join(' '))}`} target="_blank"><Navigation className="w-4 h-4 mr-2" /> Abrir no Mapa</a>
                        </Button>
                     </div>
                  </CardContent>
               </Card>
            </section>
            
            <EventCoOrganizers eventId={id} currentOrgId={event.organizationId} isPublic />
          </div>

          <aside className="lg:col-span-4 space-y-8">
            <section className="sticky top-24 space-y-8">
               <AgeRatingBadge code={event.ageRating?.code || "free"} showLabel className="px-2" />
               
               <BilheteriaPublic 
                 event={event}
                 occurrence={selectedOccurrenceData}
                 occurrenceLoading={occurrencesLoading}
                 globalFees={globalFees} 
                 promotions={promotions} 
                 orgSettings={org} 
               />

               <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
                  <div className="flex items-center gap-4">
                     <Avatar className="h-14 w-14 border-2 border-secondary/10 p-0.5">
                        <AvatarImage src={org?.avatar} className="rounded-full object-cover" />
                        <AvatarFallback className="font-bold">{org?.name?.charAt(0)}</AvatarFallback>
                     </Avatar>
                     <div className="flex-1">
                        <div className="flex items-center gap-1.5"><h4 className="font-bold text-sm leading-none">{org?.name}</h4>{(org?.verified || org?.isVerified) && <BadgeCheck className="w-4 h-4 text-blue-500" />}</div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">@{org?.username}</p>
                     </div>
                  </div>
                  <div className="flex gap-2">
                     <FollowButton organizationId={event.organizationId} username={org?.username} className="flex-1" />
                     <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-2" onClick={() => setIsShareModalOpen(true)}><Share2 className="w-5 h-5" /></Button>
                  </div>
               </Card>
               
               <EventRelatedEvents currentEventId={id} currentTags={event.tags || []} />

               <div className="flex items-center justify-center">
                  <Button variant="link" className="text-[9px] font-black uppercase text-muted-foreground opacity-30 hover:opacity-100" onClick={() => setIsActionModalOpen(true)}>Problemas com este evento?</Button>
               </div>
            </section>
          </aside>
        </div>
      </main>

      <Footer />

      <ShareModal 
        isOpen={isShareModalOpen} 
        onOpenChange={setIsShareModalOpen} 
        data={{
          title: event.title,
          username: username,
          url: `/${username}/${event.slug || id}`,
          logoUrl: event.image,
          type: 'event',
          organizationId: event.organizationId,
          eventId: id
        }}
      />

      <EventActionModal isOpen={isActionModalOpen} onOpenChange={setIsActionModalOpen} event={event} />
    </div>
  )
}
