"use client"

import * as React from "react"
import { useCollection, useFirestore } from "@/firebase"
import { collection, query, where, limit, getDocs, startAfter, DocumentSnapshot } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  MapPin, 
  Search, 
  Loader2, 
  FilterX, 
  Clock,
  Coins,
  Inbox,
  Calendar as CalendarIcon,
  Beer,
  Ghost,
  Flame,
  Gift,
  Sparkles,
  Music,
  Users
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { format, startOfToday, addDays, endOfWeek, isSameDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn, normalizeText, safeParseDate } from "@/lib/utils"
import { getCurrentLocation, type Coordinates } from "@/lib/location-utils"
import { isEventVisible, calculateDistanceMeters } from "@/lib/event-scoring-utils"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"
import { ThematicConfig } from "@/lib/thematic-configs"
import { PublicHeader } from "@/components/layout/PublicHeader"
import Footer from "@/components/layout/Footer"

const ICON_MAP = {
  beer: Beer,
  ghost: Ghost,
  flame: Flame,
  gift: Gift,
  sparkles: Sparkles,
  music: Music,
};

export default function ThematicPageClient({ 
  initialEvents = [], 
  config 
}: { 
  initialEvents: any[], 
  config: ThematicConfig 
}) {
  const db = useFirestore()
  
  const [search, setSearch] = React.useState("")
  const [searchCity, setSearchCity] = React.useState("")
  const [priceFilter, setPriceFilter] = React.useState("all")
  const [dateFilter, setDateFilter] = React.useState<"all" | "today" | "tomorrow" | "week" | "custom">("all")
  const [customDate, setCustomDate] = React.useState<Date | undefined>(undefined)
  
  const [userLocation, setUserLocation] = React.useState<Coordinates | null>(null)
  const [now, setNow] = React.useState<Date | null>(null)

  const [rawEvents, setRawEvents] = React.useState<any[]>(initialEvents)
  const [lastVisible, setLastVisible] = React.useState<DocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = React.useState(initialEvents.length >= 12)
  const [isFetching, setIsFetching] = React.useState(false)

  const IconComponent = ICON_MAP[config.iconName] || Sparkles;
  const isOktoberfest = config.slug === 'oktoberfest';

  // Ocorrências para eventos recorrentes
  const occurrencesQuery = useMemoFirebase(() => {
    if (!db) return null
    const yesterdayStr = format(addDays(startOfToday(), -1), 'yyyy-MM-dd')
    return query(collection(db, "recurring_occurrences"), where("status", "==", "active"), where("date", ">=", yesterdayStr))
  }, [db])
  const { data: allOccurrences } = useCollection<any>(occurrencesQuery)

  const fetchEvents = React.useCallback(async (isInitial = false) => {
    if (!db || isFetching) return
    setIsFetching(true)
    try {
      let q;
      const queryTags = config.tags.map(t => t.toLowerCase().trim());
      
      if (isInitial) {
        q = query(
          collection(db, "events"),
          where("status", "==", "Ativo"),
          where("tags", "array-contains-any", queryTags),
          limit(30)
        );
      } else {
        const cursor = lastVisible;
        q = query(
          collection(db, "events"),
          where("status", "==", "Ativo"),
          where("tags", "array-contains-any", queryTags),
          ...(cursor ? [startAfter(cursor)] : []),
          limit(12)
        );
      }

      const snap = await getDocs(q)
      const newDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      
      if (isInitial) {
        setRawEvents(newDocs);
      } else {
        setRawEvents(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const filtered = newDocs.filter(f => !existingIds.has(f.id));
          return [...prev, ...filtered];
        });
      }

      setLastVisible(snap.docs[snap.docs.length - 1] || null)
      setHasMore(snap.docs.length >= 12)
    } catch (e) {
      console.error("[Thematic Search Error]", e)
    } finally {
      setIsFetching(false)
    }
  }, [db, isFetching, lastVisible, config.tags]);

  React.useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 60000)
    getCurrentLocation().then(loc => { if (loc) setUserLocation(loc); }).catch(() => {});
    if (initialEvents.length === 0) fetchEvents(true);
    return () => clearInterval(timer)
  }, [initialEvents.length, fetchEvents]);

  const processedEvents = React.useMemo(() => {
    const cityNorm = normalizeText(searchCity);
    const searchNorm = normalizeText(search);
    const refTime = now || new Date();
    const today = startOfToday();

    const normalizedThematicTags = config.tags.map(t => normalizeText(t).replace(/\s|-/g, ""));

    return rawEvents.map(e => {
      let effectiveDate = e.date;
      if (e.isRecurring && allOccurrences && allOccurrences.length > 0) {
        const myOccs = allOccurrences.filter((o: any) => o.parentId === e.id) || [];
        if (myOccs.length > 0) {
          const sorted = [...myOccs]
            .map(o => ({ ...o, _dt: new Date(`${o.date}T${o.startTime || '19:00'}:00`) }))
            .sort((a, b) => a._dt.getTime() - b._dt.getTime());
          
          const nextValid = sorted.find(o => {
            const endThreshold = new Date(o._dt.getTime() + 6 * 60 * 60 * 1000);
            return refTime < endThreshold;
          });

          if (nextValid) {
            effectiveDate = `${nextValid.date}T${nextValid.startTime || '19:00'}:00`;
          }
        }
      }
      return { ...e, date: effectiveDate };
    }).filter(e => {
      if (!isEventVisible(e, refTime)) return false;
      
      const titleMatch = !search || normalizeText(e.title || "").includes(searchNorm);
      const cityMatch = !searchCity || normalizeText(e.city || "").includes(cityNorm);

      if (!titleMatch || !cityMatch) return false;

      const hasThematicTag = e.tags?.some((et: string) => {
        const net = normalizeText(et).replace(/\s|-/g, "");
        const singular = net.endsWith('s') ? net.slice(0, -1) : net;
        return normalizedThematicTags.includes(net) || normalizedThematicTags.includes(singular);
      });
      if (!hasThematicTag) return false;

      if (priceFilter !== 'all') {
        const minPrice = e.startingPrice ?? 0;
        if (priceFilter === 'free' && minPrice > 0) return false;
        if (priceFilter === '20' && minPrice > 20) return false;
        if (priceFilter === '50' && minPrice > 50) return false;
        if (priceFilter === '100' && minPrice > 100) return false;
      }

      if (dateFilter !== 'all') {
        const eventDate = safeParseDate(e.date);
        if (!eventDate) return false;

        if (dateFilter === 'today') {
          if (!isSameDay(eventDate, today)) return false;
        } else if (dateFilter === 'tomorrow') {
          if (!isSameDay(eventDate, addDays(today, 1))) return false;
        } else if (dateFilter === 'week') {
          const endWeek = endOfWeek(today);
          if (eventDate < today || eventDate > endWeek) return false;
        } else if (dateFilter === 'custom' && customDate) {
          if (!isSameDay(eventDate, customDate)) return false;
        }
      }

      return true;
    }).map(e => {
      let dist = Infinity;
      if (userLocation && e.latitude && e.longitude) {
        dist = calculateDistanceMeters(userLocation, { latitude: e.latitude, longitude: e.longitude });
      }
      const eventDate = safeParseDate(e.date) || new Date();
      return { ...e, _distanceMeters: dist, _startDateTime: eventDate };
    }).sort((a, b) => {
      if (a.isSponsored !== b.isSponsored) return a.isSponsored ? -1 : 1;
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;

      const timeDiff = a._startDateTime.getTime() - b._startDateTime.getTime();
      if (timeDiff !== 0) return timeDiff;
      return a._distanceMeters - b._distanceMeters;
    });
  }, [rawEvents, allOccurrences, search, searchCity, priceFilter, dateFilter, customDate, userLocation, now, config.tags]);

  const clearFilters = () => {
    setSearch("");
    setSearchCity("");
    setPriceFilter("all");
    setDateFilter("all");
    setCustomDate(undefined);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc]">
      <PublicHeader showBack />

      {/* HERO */}
      <section className={cn(
        "relative min-h-[65vh] flex items-center justify-center overflow-hidden text-white transition-all duration-700",
        isOktoberfest ? "bg-[#1c0d02]" : config.themeColor
      )}>
        {/* LUZES OKTOBERFEST */}
        {isOktoberfest && (
          <div className="absolute inset-0 z-20 pointer-events-none">
             <div className="absolute top-10 left-1/4 w-3 h-3 bg-yellow-400 rounded-full blur-[2px] animate-twinkle" />
             <div className="absolute top-24 left-1/2 w-4 h-4 bg-yellow-200 rounded-full blur-[3px] animate-twinkle [animation-delay:1s]" />
             <div className="absolute top-16 right-1/3 w-3 h-3 bg-yellow-400 rounded-full blur-[2px] animate-twinkle [animation-delay:2s]" />
          </div>
        )}

        <div className="absolute inset-0 opacity-50 pointer-events-none">
           <div 
             className="absolute inset-0 bg-cover bg-center" 
             style={{ backgroundImage: `url(${config.heroBg})` }}
             data-ai-hint={config.heroHint}
           />
           <div className={cn(
             "absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90",
             isOktoberfest && "from-black/60 via-transparent to-[#1c0d02]"
           )} />
        </div>

        <div className="container mx-auto px-4 relative z-10 py-20 text-center">
          <div className="max-w-4xl mx-auto space-y-8 flex flex-col items-center">
            <Badge className={cn(
              "backdrop-blur-md border-none px-6 py-2 rounded-full font-black uppercase text-xs tracking-widest flex items-center gap-2",
              isOktoberfest ? "bg-[#facc15] text-[#1c0d02] shadow-[#facc15]/20 shadow-xl" : "bg-white/20 text-white"
            )}>
              <IconComponent className="w-4 h-4 fill-current" /> Viby Temático
            </Badge>

            <div className="relative group">
              {isOktoberfest && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-20 opacity-20 group-hover:opacity-40 transition-opacity">
                   <Beer className="w-16 h-16 rotate-12" />
                   <Beer className="w-16 h-16 -rotate-12" />
                </div>
              )}
              <h1 className={cn(
                "text-6xl md:text-[10rem] font-black uppercase italic tracking-tighter leading-[0.8] drop-shadow-2xl",
                isOktoberfest ? "text-[#facc15]" : "text-white"
              )}>
                {config.title}
              </h1>
            </div>

            <p className="text-xl md:text-3xl font-medium opacity-95 max-w-2xl mx-auto leading-relaxed uppercase tracking-wide italic">
              {config.intro}
            </p>

            {isOktoberfest && (
              <div className="flex gap-4 items-center">
                 <div className="w-10 h-1 bg-[#000000]" />
                 <div className="w-10 h-1 bg-[#DD0000]" />
                 <div className="w-10 h-1 bg-[#FFCC00]" />
              </div>
            )}
          </div>
        </div>

        {/* BANDEIRINHAS BÁVARAS */}
        {isOktoberfest && (
          <div className="absolute bottom-0 left-0 w-full h-8 bg-bavarian opacity-40 z-10" />
        )}
      </section>

      {/* SECTION: VIVA A TRADIÇÃO ALEMÃ (OKTOBERFEST ONLY) */}
      {isOktoberfest && (
        <section className="py-32 bg-white relative overflow-hidden">
           <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
              <Beer className="w-64 h-64 text-[#facc15]" />
           </div>
           <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
              <div className="space-y-10">
                 <div className="space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#DD0000]">Cultura & Celebração</span>
                    <h2 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter text-primary leading-none">
                      VIVA A <span className="text-[#FFCC00]">TRADIÇÃO</span> ALEMÃ
                    </h2>
                 </div>
                 <div className="space-y-6 text-lg md:text-xl text-muted-foreground font-medium leading-relaxed">
                    <p>A Oktoberfest é muito mais que um festival; é a celebração da amizade (Gemütlichkeit), da gastronomia típica e do folclore que une gerações.</p>
                    <p>Brinde com canecos de chope, saboreie o autêntico pretzel e dance ao som das bandas folclóricas em uma atmosfera vibrante e inesquecível.</p>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="p-6 bg-[#fdf6e3] rounded-[2rem] border border-[#facc15]/30 text-center shadow-sm hover:shadow-md transition-all">
                       <Beer className="w-10 h-10 text-[#facc15] mx-auto mb-3" />
                       <p className="text-[10px] font-black uppercase tracking-tight text-[#78350f]">Chope Gelado</p>
                    </div>
                    <div className="p-6 bg-[#fdf6e3] rounded-[2rem] border border-[#facc15]/30 text-center shadow-sm hover:shadow-md transition-all">
                       <Music className="w-10 h-10 text-[#DD0000] mx-auto mb-3" />
                       <p className="text-[10px] font-black uppercase tracking-tight text-[#DD0000]">Bandas Típicas</p>
                    </div>
                    <div className="p-6 bg-[#fdf6e3] rounded-[2rem] border border-[#facc15]/30 text-center shadow-sm hover:shadow-md transition-all">
                       <Users className="w-10 h-10 text-primary mx-auto mb-3" />
                       <p className="text-[10px] font-black uppercase tracking-tight text-primary">Confraternização</p>
                    </div>
                 </div>
              </div>
              <div className="relative group">
                 <div className="absolute -inset-4 bg-[#facc15]/10 rounded-[4rem] blur-2xl group-hover:bg-[#DD0000]/10 transition-colors" />
                 <div className="relative grid grid-cols-2 gap-4">
                    <img src="https://picsum.photos/seed/pretzel/500/700" className="rounded-[3rem] shadow-2xl rotate-2" alt="Gastronomia" />
                    <img src="https://picsum.photos/seed/beer-mug/500/700" className="rounded-[3rem] shadow-2xl -rotate-3 mt-12" alt="Canecos" />
                 </div>
              </div>
           </div>
        </section>
      )}

      {/* FEED */}
      <section id="thematic-feed" className="py-24 container mx-auto px-4 flex-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div className="flex items-center gap-3 flex-wrap">
             <div className="relative w-full sm:w-80">
                <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4", isOktoberfest ? "text-[#FFCC00]" : "opacity-40")} />
                <Input 
                  placeholder="Qual evento você busca?" 
                  className={cn(
                    "h-14 pl-12 rounded-2xl shadow-sm border-none text-sm font-bold uppercase",
                    isOktoberfest ? "bg-[#fdf6e3] text-primary placeholder:text-primary/40" : "bg-white"
                  )}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
             </div>
             <div className="relative w-full sm:w-56">
                <MapPin className={cn("absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4", isOktoberfest ? "text-[#DD0000]" : "opacity-40")} />
                <Input 
                  placeholder="Cidade" 
                  className={cn(
                    "h-14 pl-12 rounded-2xl shadow-sm border-none text-sm font-bold uppercase",
                    isOktoberfest ? "bg-[#fdf6e3] text-primary placeholder:text-primary/40" : "bg-white"
                  )}
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                />
             </div>
             
             <Select value={priceFilter} onValueChange={setPriceFilter}>
                <SelectTrigger className={cn("w-44 rounded-2xl h-14 border-none shadow-sm font-bold uppercase text-[10px]", isOktoberfest ? "bg-[#fdf6e3] text-primary" : "bg-white")}>
                   <Coins className={cn("w-4 h-4 mr-2", isOktoberfest ? "text-[#facc15]" : "")} />
                   <SelectValue placeholder="Preço" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                   <SelectItem value="all">Preço</SelectItem>
                   <SelectItem value="free">Gratuito</SelectItem>
                   <SelectItem value="20">Até R$ 20</SelectItem>
                   <SelectItem value="50">Até R$ 50</SelectItem>
                   <SelectItem value="100">Até R$ 100</SelectItem>
                </SelectContent>
             </Select>

             <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("rounded-2xl h-14 border-none shadow-sm gap-2 font-black text-[10px] uppercase transition-all px-8", isOktoberfest ? "bg-[#fdf6e3] text-primary" : "bg-white", dateFilter !== 'all' && "bg-primary text-white")}>
                    <CalendarIcon className="h-4 w-4" />
                    {dateFilter === 'today' ? 'Hoje' :
                     dateFilter === 'tomorrow' ? 'Amanhã' :
                     dateFilter === 'week' ? 'Semana' :
                     dateFilter === 'custom' && customDate ? format(customDate, "dd/MM", { locale: ptBR }) :
                     'Quando?'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-[2rem] border-none shadow-2xl" align="end">
                  <div className="p-3 border-b grid grid-cols-3 gap-2">
                      <Button variant="ghost" size="sm" className={cn("text-[9px] font-black uppercase rounded-lg", dateFilter === 'today' && "bg-primary text-white")} onClick={() => { setDateFilter('today'); setCustomDate(undefined); }}>Hoje</Button>
                      <Button variant="ghost" size="sm" className={cn("text-[9px] font-black uppercase rounded-lg", dateFilter === 'tomorrow' && "bg-primary text-white")} onClick={() => { setDateFilter('tomorrow'); setCustomDate(undefined); }}>Amanhã</Button>
                      <Button variant="ghost" size="sm" className={cn("text-[9px] font-black uppercase rounded-lg", dateFilter === 'week' && "bg-primary text-white")} onClick={() => { setDateFilter('week'); setCustomDate(undefined); }}>Semana</Button>
                  </div>
                  <Calendar
                    mode="single"
                    selected={customDate}
                    onSelect={(d) => { if(d) { setCustomDate(d); setDateFilter('custom'); } }}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
             </Popover>

             {(search || searchCity || dateFilter !== 'all') && (
               <Button variant="ghost" size="icon" className="h-14 w-14 rounded-2xl text-destructive hover:bg-destructive/5" onClick={clearFilters}>
                 <FilterX className="w-5 h-5" />
               </Button>
             )}
          </div>
          
          <div className="text-right flex flex-col items-end gap-2">
             <Badge variant="secondary" className="font-black h-8 px-6 rounded-full uppercase text-[10px] tracking-widest bg-white shadow-sm border border-border/40">{processedEvents.length} Eventos</Badge>
          </div>
        </div>

        {processedEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {processedEvents.map((event) => (
              <EventCard 
                key={event.id} 
                event={{ ...event, userLocation }} 
                thematicTheme={isOktoberfest ? 'oktoberfest' : 'default'}
              />
            ))}
          </div>
        ) : (
          <div className="py-40 text-center bg-white rounded-[4rem] border-2 border-dashed border-border shadow-inner flex flex-col items-center gap-6">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center opacity-20">
               <Inbox className="w-12 h-12" />
            </div>
            <div className="space-y-2">
               <h3 className="text-2xl font-black uppercase italic text-primary">Ainda não encontramos eventos para este tema.</h3>
               <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">Mas estamos de olho nas próximas programações!</p>
            </div>
            <Button variant="outline" onClick={clearFilters} className="rounded-2xl h-14 px-10 border-2 uppercase font-black italic transition-all hover:scale-105 active:scale-95">
               Limpar Busca
            </Button>
          </div>
        )}

        {hasMore && (
           <div className="mt-24 flex justify-center">
              <Button 
                onClick={() => fetchMore(false)} 
                disabled={isFetching}
                className={cn(
                  "h-16 px-16 font-black uppercase italic border-2 rounded-2xl shadow-xl transition-all",
                  isOktoberfest ? "bg-[#DD0000] text-white border-none" : "bg-white text-primary"
                )}
              >
                {isFetching ? <Loader2 className="w-5 h-5 animate-spin" /> : `Ver mais ${isOktoberfest ? 'Oktoberfests' : 'eventos'}`}
              </Button>
           </div>
        )}
      </section>

      <Footer />
    </div>
  )
}
