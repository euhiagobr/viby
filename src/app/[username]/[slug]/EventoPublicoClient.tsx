"use client"

import * as React from "react"
import { useDoc, useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where, getDoc } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Calendar, 
  MapPin, 
  Info,
  BadgeCheck,
  Loader2,
  Share2,
  ShieldAlert,
  Clock,
  Navigation
} from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn, safeParseDate } from "@/lib/utils"
import { BilheteriaPublic, EventSEO, EventCoOrganizers } from "@/components/events"
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
import { formatFullAddress } from "@/lib/location-utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const LocationMap = dynamic(() => import("@/components/events/LocationMap").then(mod => mod.LocationMap), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center text-[10px] font-black uppercase opacity-20">Carregando Mapa...</div>
})

interface EventoPublicoClientProps {
  id: string
  username: string
}

export default function EventoPublicoClient({ id, username }: EventoPublicoClientProps) {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  
  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false)
  const [isActionModalOpen, setIsActionModalOpen] = React.useState(false)
  const [selectedOccurrenceId, setSelectedOccurrenceId] = React.useState<string | null>(null)

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
    const today = startOfToday();
    // Consulta por start_date (Timestamp) para maior precisão
    return query(
      collection(db, "recurring_occurrences"),
      where("parentId", "==", id),
      where("status", "==", "active"),
      where("start_date", ">=", today)
    )
  }, [db, id, event?.isRecurring]);

  const { data: upcomingOccurrences, loading: occurrencesLoading } = useCollection<any>(occurrencesQuery);

  // Seleção reativa da sessão baseada no ID sem fetch redundante
  const selectedOccurrenceData = React.useMemo(() => {
    if (!upcomingOccurrences || upcomingOccurrences.length === 0) return null;
    return upcomingOccurrences.find(o => o.id === selectedOccurrenceId) || upcomingOccurrences[0];
  }, [upcomingOccurrences, selectedOccurrenceId]);

  // Auto-seleciona a primeira sessão disponível ao carregar
  React.useEffect(() => {
    if (event?.isRecurring && upcomingOccurrences && upcomingOccurrences.length > 0 && !selectedOccurrenceId && !occurrencesLoading) {
      const sorted = [...upcomingOccurrences].sort((a, b) => {
        const dA = safeParseDate(a.start_date)?.getTime() || 0;
        const dB = safeParseDate(b.start_date)?.getTime() || 0;
        return dA - dB;
      });
      setSelectedOccurrenceId(sorted[0].id);
    }
  }, [event?.isRecurring, upcomingOccurrences, selectedOccurrenceId, occurrencesLoading]);

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

  if (eventLoading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando Experiência...</p>
    </div>
  );

  if (!event) return (
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
  
  const displayDate = selectedOccurrenceData?.start_date || event.startDate || event.date;
  const displayEndDate = selectedOccurrenceData?.end_date || event.endDate;

  const start = { date: formatDate(displayDate), time: formatTime(displayDate) };
  const end = displayEndDate ? { date: formatDate(displayEndDate), time: formatTime(displayEndDate) } : null;

  const addressLines = formatFullAddress(event.address || { venueName: event.location, city: event.city, stateRegion: event.state });
  const locationQuery = encodeURIComponent(addressLines.join(' '));

  const lat = event.address?.latitude ?? event.latitude ?? -23.55052;
  const lng = event.address?.longitude ?? event.longitude ?? -46.633308;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white overflow-x-hidden w-full">
      <EventSEO event={event} username={username} />
      <PublicHeader showBack />

      <main className="flex-1 animate-in fade-in duration-700">
        <div className="relative h-[40vh] md:h-[60vh] w-full overflow-hidden">
          <Image 
            src={event.image || "/img/placeholder.png"} 
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
              </div>
              <h1 className="text-4xl md:text-7xl font-black text-primary uppercase italic tracking-tighter leading-[0.85]">{event.title}</h1>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12 max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-12">
            
            {event.isRecurring && upcomingOccurrences && upcomingOccurrences.length > 0 && (
               <section className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-secondary" /> Escolha sua Sessão
                  </h3>
                  <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden p-8">
                     <Select 
                      value={selectedOccurrenceId || upcomingOccurrences[0]?.id} 
                      onValueChange={setSelectedOccurrenceId} 
                      disabled={occurrencesLoading}
                     >
                        <SelectTrigger className="h-14 rounded-2xl border-dashed border-secondary/30 font-bold text-lg px-6 uppercase italic text-primary">
                           <SelectValue placeholder="Selecione a data e horário" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl max-h-[300px]">
                           {upcomingOccurrences?.sort((a, b) => {
                             const dA = safeParseDate(a.start_date)?.getTime() || 0;
                             const dB = safeParseDate(b.start_date)?.getTime() || 0;
                             return dA - dB;
                           }).map((occ) => (
                              <SelectItem key={occ.id} value={occ.id} className="cursor-pointer py-3 border-b last:border-0 border-dashed">
                                 <div className="flex items-center gap-4">
                                    <Calendar className="w-4 h-4 text-secondary" />
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm">
                                          {format(safeParseDate(occ.start_date) || new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                                          <span className="mx-2 opacity-30">|</span>
                                          {occ.startTime || format(safeParseDate(occ.start_date) || new Date(), "HH:mm")}
                                          {occ.endTime ? ` às ${occ.endTime}` : ""}
                                        </span>
                                    </div>
                                 </div>
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Card>
               </section>
            )}

            <section className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Sobre a Experiência</h3>
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
                          <p key={idx} className={cn("leading-tight uppercase", idx === 0 ? "font-black text-2xl italic tracking-tighter text-primary" : "text-xs font-medium text-muted-foreground")}>{line}</p>
                        ))}
                     </div>
                     <div className="flex flex-col sm:flex-row gap-3">
                        <Button variant="outline" className="rounded-xl h-12 px-6 gap-2 font-bold uppercase text-[10px] border-secondary text-secondary" asChild>
                           <a href={`https://www.google.com/maps/search/?api=1&query=${locationQuery}`} target="_blank" rel="noopener noreferrer"><MapPin className="w-4 h-4" /> Google Maps</a>
                        </Button>
                        <Button variant="outline" className="rounded-xl h-12 px-6 gap-2 font-bold uppercase text-[10px] border-secondary text-secondary" asChild>
                           <a href={`https://www.waze.com/ul?q=${locationQuery}&navigate=yes`} target="_blank" rel="noopener noreferrer"><Navigation className="w-4 h-4" /> Waze</a>
                        </Button>
                     </div>
                  </CardContent>
               </Card>
            </section>
            
            <EventCoOrganizers eventId={id} currentOrgId={event.organizationId} isPublic className="mt-12" />
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
          bannerUrl: event.image,
          type: 'event',
          organizationId: event.organizationId,
          eventId: id
        }}
      />

      <EventActionModal 
        isOpen={isActionModalOpen} 
        onOpenChange={setIsActionModalOpen} 
        event={event} 
      />
    </div>
  )
}
