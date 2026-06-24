"use client"

import * as React from "react"
import { useCollection, useFirestore, useUser, useAuth } from "@/firebase"
import { collection, query, where, limit, orderBy, getDocs, startAfter, DocumentSnapshot } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Flame, 
  MapPin, 
  Search, 
  Loader2, 
  FilterX, 
  Clock,
  Coins,
  Inbox,
  Calendar as CalendarIcon,
  ChevronRight,
  Sparkles
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
import { cn, normalizeText } from "@/lib/utils"
import { getCurrentLocation, type Coordinates } from "@/lib/location-utils"
import { isEventVisible, calculateDistanceMeters } from "@/lib/event-scoring-utils"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"
import { JUNINA_TAGS, JUNINA_THEMATIC_MAP } from "@/lib/constants"

export default function FestaJuninaClient({ initialEvents = [] }: { initialEvents?: any[] }) {
  const db = useFirestore()
  const auth = useAuth()
  
  const [search, setSearch] = React.useState("")
  const [searchCity, setSearchCity] = React.useState("")
  const [priceFilter, setPriceFilter] = React.useState("all")
  const [dateFilter, setDateFilter] = React.useState<"all" | "today" | "tomorrow" | "week" | "custom">("all")
  const [customDate, setCustomDate] = React.useState<Date | undefined>(undefined)
  const [selectedQuickCat, setSelectedQuickCat] = React.useState<string | null>(null)
  
  const [userLocation, setUserLocation] = React.useState<Coordinates | null>(null)
  const [now, setNow] = React.useState<Date | null>(null)

  const [rawEvents, setRawEvents] = React.useState<any[]>(initialEvents)
  const [lastVisible, setLastVisible] = React.useState<DocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = React.useState(initialEvents.length >= 12)
  const [isFetching, setIsFetching] = React.useState(false)

  // Pipeline de Ocorrências para eventos recorrentes
  const occurrencesQuery = useMemoFirebase(() => {
    if (!db) return null
    const yesterdayStr = format(addDays(startOfToday(), -1), 'yyyy-MM-dd')
    return query(collection(db, "recurring_occurrences"), where("status", "==", "active"), where("date", ">=", yesterdayStr))
  }, [db])
  const { data: allOccurrences, loading: loadingOccs } = useCollection<any>(occurrencesQuery)

  const fetchEvents = React.useCallback(async (isInitial = false) => {
    if (!db || isFetching) return
    setIsFetching(true)
    try {
      let q;
      if (isInitial) {
        q = query(
          collection(db, "events"),
          where("status", "==", "Ativo"),
          where("tags", "array-contains-any", ["festajunina", "junina"]),
          limit(30)
        );
      } else {
        const cursor = lastVisible;
        q = query(
          collection(db, "events"),
          where("status", "==", "Ativo"),
          where("tags", "array-contains-any", ["festajunina", "junina"]),
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
      console.error("[Junina Search Error]", e)
    } finally {
      setIsFetching(false)
    }
  }, [db, isFetching, lastVisible]);

  React.useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 60000)
    getCurrentLocation()
      .then(loc => { if (loc) setUserLocation(loc); })
      .catch(() => {});
    
    if (initialEvents.length === 0) {
      fetchEvents(true);
    }

    return () => clearInterval(timer)
  }, [initialEvents.length, fetchEvents]);

  const processedEvents = React.useMemo(() => {
    const cityNorm = normalizeText(searchCity);
    const searchNorm = normalizeText(search);
    const refTime = now || new Date();
    const today = startOfToday();

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

      if (selectedQuickCat) {
        const hasTag = e.tags?.some((t: string) => {
          const normalizedTag = t.toLowerCase();
          return JUNINA_THEMATIC_MAP[normalizedTag] === selectedQuickCat;
        });
        if (!hasTag) return false;
      }

      if (priceFilter !== 'all') {
        const minPrice = e.startingPrice ?? 0;
        if (priceFilter === 'free' && minPrice > 0) return false;
        if (priceFilter === '20' && minPrice > 20) return false;
        if (priceFilter === '50' && minPrice > 50) return false;
        if (priceFilter === '100' && minPrice > 100) return false;
      }

      if (dateFilter !== 'all') {
        const parseDate = (val: any) => {
          if (!val) return null;
          if (val.toDate) return val.toDate();
          const d = new Date(val);
          return isNaN(d.getTime()) ? null : d;
        };
        const eventDate = parseDate(e.date);
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
      const eventDate = new Date(e.date?.toDate ? e.date.toDate().toISOString() : e.date);
      return { ...e, _distanceMeters: dist, _startDateTime: isNaN(eventDate.getTime()) ? new Date() : eventDate };
    }).sort((a, b) => {
      const timeDiff = a._startDateTime.getTime() - b._startDateTime.getTime();
      if (timeDiff !== 0) return timeDiff;
      return a._distanceMeters - b._distanceMeters;
    });
  }, [rawEvents, allOccurrences, loadingOccs, search, searchCity, priceFilter, dateFilter, customDate, selectedQuickCat, userLocation, now]);

  // Geração dinâmica das categorias disponíveis baseada nos eventos presentes
  const dynamicCategories = React.useMemo(() => {
    const categoriesSet = new Set<string>();
    rawEvents.forEach(e => {
      const hasPrimaryTag = e.tags?.some((t: string) => {
        const nt = t.toLowerCase();
        return nt === "festajunina" || nt === "junina";
      });
      if (hasPrimaryTag) {
        e.tags?.forEach((t: string) => {
          const label = JUNINA_THEMATIC_MAP[t.toLowerCase()];
          if (label) categoriesSet.add(label);
        });
      }
    });
    return Array.from(categoriesSet).sort();
  }, [rawEvents]);

  const featuredEvents = React.useMemo(() => {
    return processedEvents.filter(e => e.isFeatured || e.isSponsored).slice(0, 3);
  }, [processedEvents]);

  const clearFilters = () => {
    setSearch("");
    setSearchCity("");
    setPriceFilter("all");
    setDateFilter("all");
    setCustomDate(undefined);
    setSelectedQuickCat(null);
  };

  const scrollToFeed = () => {
    const el = document.getElementById("junina-feed");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#fefce8]">
      {/* HERO SECTION */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden bg-[#78350f] text-white">
        <div className="absolute top-0 left-0 w-full h-24 z-20 pointer-events-none opacity-80" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'40\' viewBox=\'0 0 100 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0 L20 30 L40 0 L60 30 L80 0 L100 30 L100 0 Z\' fill=\'%23facc15\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat-x' }} />
        
        <div className="absolute inset-0 opacity-30 pointer-events-none">
           <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/junina-party/1920/1080')] bg-cover bg-center" />
           <div className="absolute inset-0 bg-gradient-to-b from-[#78350f]/90 via-[#78350f]/60 to-[#78350f]" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10 py-20 text-center">
          <div className="max-w-4xl mx-auto space-y-8 flex flex-col items-center">
            <Badge className="bg-[#facc15] text-[#78350f] border-none px-6 py-2 rounded-full font-black uppercase text-xs tracking-widest flex items-center gap-2 animate-bounce">
              <Flame className="w-4 h-4 fill-current" /> É tempo de arraiá!
            </Badge>
            <h1 className="text-6xl md:text-9xl font-black uppercase italic tracking-tighter leading-[0.8] text-white">
              FESTA <span className="text-[#facc15]">JUNINA</span> <br /> 2026
            </h1>
            <p className="text-lg md:text-2xl font-medium opacity-90 max-w-2xl mx-auto leading-relaxed">
              Encontre arraiás, quermesses e festas juninas perto de você.
            </p>

            <Card className="bg-white/10 backdrop-blur-2xl border-white/10 rounded-[3rem] p-6 md:p-8 shadow-2xl mt-12 w-full text-left max-w-3xl">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input 
                    placeholder="Qual arraiá você procura?" 
                    className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white placeholder:text-white/30"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="md:col-span-4 relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#facc15]" />
                  <Input 
                    placeholder="Cidade?" 
                    className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white placeholder:text-white/30"
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                  />
                </div>
                <div className="md:col-span-3">
                   <Button onClick={scrollToFeed} className="w-full h-14 bg-[#ea580c] text-white font-black uppercase italic rounded-2xl shadow-xl hover:scale-105 transition-all">
                      Explorar eventos
                   </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CATEGORIAS RÁPIDAS DINÂMICAS */}
      {dynamicCategories.length > 0 && (
        <section className="py-12 bg-white border-b overflow-x-auto scrollbar-hide">
          <div className="container mx-auto px-4 flex justify-center gap-4 min-w-max">
             {dynamicCategories.map((label) => (
               <Button
                 key={label}
                 variant={selectedQuickCat === label ? "default" : "outline"}
                 onClick={() => setSelectedQuickCat(selectedQuickCat === label ? null : label)}
                 className={cn(
                   "rounded-full px-8 h-12 font-black uppercase italic text-xs tracking-widest transition-all",
                   selectedQuickCat === label ? "bg-[#78350f] text-white border-none shadow-lg" : "border-[#78350f]/20 text-[#78350f] hover:bg-[#78350f]/5"
                 )}
               >
                 {label}
               </Button>
             ))}
          </div>
        </section>
      )}

      {/* DESTAQUES */}
      {featuredEvents.filter(e => e.status === 'Ativo').length > 0 && (
        <section className="py-20 bg-[#fffbeb]">
           <div className="container mx-auto px-4 space-y-12">
              <div className="flex items-center gap-3 px-2">
                 <Sparkles className="w-6 h-6 text-[#facc15] fill-current" />
                 <h2 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Eventos Juninos em Destaque</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                 {featuredEvents.filter(e => e.status === 'Ativo').map(event => (
                   <EventCard key={event.id} event={{ ...event, isSponsored: true }} />
                 ))}
              </div>
           </div>
        </section>
      )}

      {/* FEED PRINCIPAL */}
      <section id="junina-feed" className="py-20 container mx-auto px-4 flex-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div className="space-y-2">
            <h2 className="text-5xl font-black uppercase italic tracking-tighter text-primary">Arraiás na <span className="text-[#ea580c]">Viby</span></h2>
            <p className="text-muted-foreground font-medium text-lg">Descubra as festas mais próximas de você.</p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
             <Select value={priceFilter} onValueChange={setPriceFilter}>
                <SelectTrigger className="w-40 rounded-xl h-11 border-dashed bg-white">
                   <Coins className="w-4 h-4 mr-2 text-[#ea580c]" />
                   <SelectValue />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">Preço</SelectItem>
                   <SelectItem value="free">Gratuito</SelectItem>
                   <SelectItem value="20">Até R$ 20</SelectItem>
                   <SelectItem value="50">Até R$ 50</SelectItem>
                   <SelectItem value="100">Até R$ 100</SelectItem>
                </SelectContent>
             </Select>

             <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("rounded-xl h-11 border-dashed gap-2 font-bold text-xs uppercase bg-white", dateFilter !== 'all' && "bg-[#78350f] text-white border-[#78350f]")}>
                    <CalendarIcon className="h-4 w-4" />
                    {dateFilter === 'today' ? 'Hoje' :
                     dateFilter === 'tomorrow' ? 'Amanhã' :
                     dateFilter === 'week' ? 'Semana' :
                     dateFilter === 'custom' && customDate ? format(customDate, "dd/MM", { locale: ptBR }) :
                     'Quando?'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="end">
                  <div className="p-3 border-b grid grid-cols-3 gap-2">
                      <Button variant="ghost" size="sm" className={cn("text-[10px] font-black uppercase rounded-lg", dateFilter === 'today' && "bg-[#78350f] text-white")} onClick={() => { setDateFilter('today'); setCustomDate(undefined); }}>Hoje</Button>
                      <Button variant="ghost" size="sm" className={cn("text-[10px] font-black uppercase rounded-lg", dateFilter === 'tomorrow' && "bg-[#78350f] text-white")} onClick={() => { setDateFilter('tomorrow'); setCustomDate(undefined); }}>Amanhã</Button>
                      <Button variant="ghost" size="sm" className={cn("text-[10px] font-black uppercase rounded-lg", dateFilter === 'week' && "bg-[#78350f] text-white")} onClick={() => { setDateFilter('week'); setCustomDate(undefined); }}>Semana</Button>
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

             {(search || searchCity || dateFilter !== 'all' || selectedQuickCat) && (
               <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-primary hover:bg-[#78350f]/5" onClick={clearFilters}>
                 <FilterX className="w-4 h-4" />
               </Button>
             )}
          </div>
        </div>

        {processedEvents.filter(e => e.status === 'Ativo').length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {processedEvents.filter(e => e.status === 'Ativo').map((event) => (
              <EventCard 
                key={event.id} 
                event={{ ...event, userLocation }} 
              />
            ))}
          </div>
        ) : (
          <div className="py-32 text-center bg-white rounded-[4rem] border-2 border-dashed border-border shadow-inner flex flex-col items-center gap-6">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center opacity-20">
               <Inbox className="w-12 h-12" />
            </div>
            <div className="space-y-2">
               <h3 className="text-2xl font-black uppercase italic text-primary">Nenhum arraiá localizado.</h3>
               <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">Tente mudar os filtros ou o período da busca.</p>
            </div>
            <Button variant="outline" onClick={clearFilters} className="rounded-full font-bold h-12 px-8 uppercase italic border-2 border-[#78350f] text-[#78350f]">
               Ver todos os eventos
            </Button>
          </div>
        )}

        {hasMore && (
           <div className="mt-20 flex justify-center">
              <Button 
                onClick={() => fetchMore(false)} 
                disabled={isFetching}
                className="h-14 px-12 bg-white text-primary font-black border-2 rounded-2xl hover:bg-muted transition-all"
              >
                {isFetching ? <Loader2 className="w-5 h-5 animate-spin" /> : "Carregar mais festas"}
              </Button>
           </div>
        )}
      </section>
    </div>
  )
}
