"use client"

import * as React from "react"
import { useCollection, useFirestore } from "@/firebase"
import { collection, query, where, orderBy, getDocs, startAfter, DocumentSnapshot } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { PrideHeader } from "@/components/layout/PrideHeader"
import Footer from "@/components/layout/Footer"
import { Badge } from "@/components/ui/badge"
import { Loader2, Inbox, MapPin, Calendar as CalendarIcon, FilterX, Clock } from "lucide-react"
import ProgressPrideBackground from "@/components/ui/ProgressPrideBackground"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { format, startOfToday, addDays, endOfWeek, isSameDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn, normalizeText } from "@/lib/utils"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"
import { isEventVisible } from "@/lib/event-scoring-utils"

const LGBT_CATEGORY_IDS = [
  "bNr5g766mc0vGskU1RBq",
  "bnxzzfbroJjdEjwlBfy0"
]

const LGBT_TAGS = [
  "lgbt", "lgbtqiapn", "lgbtqia+", "gay", "lesbica", "lésbica", 
  "bissexual", "bi", "trans", "travesti", "transgenero", "queer", 
  "diversidade", "pride", "parada lgbt"
]

export default function LGBTClient({ initialEvents = [] }: { initialEvents: any[] }) {
  const db = useFirestore()
  const [searchCity, setSearchCity] = React.useState("")
  const [dateFilter, setDateFilter] = React.useState<"all" | "today" | "tomorrow" | "week" | "custom">("all")
  const [customDate, setCustomDate] = React.useState<Date | undefined>(undefined)
  const [now, setNow] = React.useState<Date | null>(null)

  const [rawEvents, setRawEvents] = React.useState<any[]>(initialEvents)
  const [lastVisible, setLastVisible] = React.useState<DocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = React.useState(initialEvents.length >= 12)
  const [isFetching, setIsFetching] = React.useState(false)

  React.useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

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
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - 60);

      let q;
      if (isInitial) {
        q = query(
          collection(db, "events"), 
          where("status", "==", "Ativo"), 
          where("date", ">=", thresholdDate),
          orderBy("date", "asc"),
          limit(30)
        );
      } else {
        const cursor = lastVisible || (rawEvents.length > 0 ? rawEvents[rawEvents.length - 1].date : null);
        q = query(
          collection(db, "events"), 
          where("status", "==", "Ativo"), 
          where("date", ">=", thresholdDate),
          orderBy("date", "asc"),
          startAfter(cursor),
          limit(12)
        );
      }

      const snap = await getDocs(q);
      const newDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (isInitial) {
        setRawEvents(newDocs);
      } else {
        setRawEvents(prev => [...prev, ...newDocs]);
      }

      if (snap.docs.length > 0) setLastVisible(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length >= 12);
    } catch (e) {
      console.error("[LGBT Fetch Error]", e);
    } finally {
      setIsFetching(false);
    }
  }, [db, isFetching, lastVisible, rawEvents]);

  React.useEffect(() => {
    if (initialEvents.length === 0) fetchEvents(true);
  }, [initialEvents.length, fetchEvents]);
  
  const displayEvents = React.useMemo(() => {
    const today = startOfToday();
    const refTime = now || new Date();
    
    return rawEvents.map(e => {
      let effectiveDate = e.date;
      if (e.isRecurring && allOccurrences && allOccurrences.length > 0) {
        const myOccs = allOccurrences.filter((o: any) => o.parentId === e.id) || [];
        if (myOccs.length > 0) {
          const sorted = [...myOccs]
            .map(o => ({ ...o, _dt: new Date(`${o.date}T${o.startTime || '00:00'}:00`) }))
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
    }).filter(event => {
      // Regra de Visibilidade Resiliente à Recorrência
      if (!isEventVisible(event, refTime) && (!event.isRecurring || !loadingOccs)) return false;

      const byCategory = LGBT_CATEGORY_IDS.includes(event.categoryId)
      const byTags = event.tags?.some((tag: string) => 
        LGBT_TAGS.includes(tag.toLowerCase())
      )
      
      if (!(byCategory || byTags)) return false;

      if (searchCity) {
        const cityNorm = normalizeText(searchCity);
        const eventLoc = normalizeText(`${event.city || ""} ${event.state || ""}`);
        if (!eventLoc.includes(cityNorm)) return false;
      }

      if (dateFilter !== 'all') {
        const parseDate = (val: any) => {
          if (!val) return null;
          if (val.toDate) return val.toDate();
          const d = new Date(val);
          return isNaN(d.getTime()) ? null : d;
        };

        const eventDate = parseDate(event.date);
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
    }).sort((a, b) => {
      const tA = new Date(a.date?.toDate ? a.date.toDate().toISOString() : a.date).getTime();
      const tB = new Date(b.date?.toDate ? b.date.toDate().toISOString() : b.date).getTime();
      return tA - tB;
    });
  }, [rawEvents, allOccurrences, loadingOccs, searchCity, dateFilter, customDate, now])

  const clearFilters = () => {
    setSearchCity("");
    setDateFilter("all");
    setCustomDate(undefined);
  };

  return (
    <ProgressPrideBackground>
      <div className="flex flex-col min-h-screen">
        <PrideHeader />

        <section className="relative h-[50vh] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div className="container mx-auto px-4 relative z-10 text-center text-white space-y-6">
            <Badge className="bg-white/20 backdrop-blur-md text-white border-white/20 px-4 py-1.5 rounded-full font-black uppercase text-[10px] tracking-widest animate-bounce">
              Espaço de Diversidade
            </Badge>
            <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter leading-none shadow-sm">
              Experiências <span className="text-secondary">LGBTQIAPN+</span>
            </h1>
            <p className="text-lg md:text-2xl font-medium max-w-2xl mx-auto opacity-90 leading-relaxed uppercase tracking-wide">
              Eventos, celebrações e espaços de diversidade para viver o agora.
            </p>
          </div>
        </section>

        <main className="container mx-auto px-4 py-16 flex-1 space-y-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white drop-shadow-md">Agenda da Diversidade</h2>
              <p className="text-white/80 font-medium uppercase text-[10px] tracking-widest">Encontre o seu próximo rolê.</p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative w-full sm:w-48">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input 
                  placeholder="Cidade" 
                  className="pl-10 h-11 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-white/40 border-dashed focus-visible:ring-secondary/50" 
                  value={searchCity} 
                  onChange={(e) => setSearchCity(e.target.value)} 
                />
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("rounded-xl h-11 border-dashed gap-2 font-bold text-xs uppercase bg-white/10 border-white/20 text-white hover:bg-white/20", dateFilter !== 'all' && "bg-secondary text-white border-secondary")}>
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
                      <Button variant="ghost" size="sm" className={cn("text-[10px] font-black uppercase rounded-lg", dateFilter === 'today' && "bg-secondary text-white hover:bg-secondary/90")} onClick={() => { setDateFilter('today'); setCustomDate(undefined); }}>Hoje</Button>
                      <Button variant="ghost" size="sm" className={cn("text-[10px] font-black uppercase rounded-lg", dateFilter === 'tomorrow' && "bg-secondary text-white hover:bg-secondary/90")} onClick={() => { setDateFilter('tomorrow'); setCustomDate(undefined); }}>Amanhã</Button>
                      <Button variant="ghost" size="sm" className={cn("text-[10px] font-black uppercase rounded-lg", dateFilter === 'week' && "bg-secondary text-white hover:bg-secondary/90")} onClick={() => { setDateFilter('week'); setCustomDate(undefined); }}>Semana</Button>
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

              {(searchCity || dateFilter !== 'all') && (
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-white hover:bg-white/10" onClick={clearFilters}>
                  <FilterX className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {isFetching && rawEvents.length === 0 ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-white" /></div>
          ) : displayEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {displayEvents.map((event) => (
                <div key={event.id} className="relative group/lgbt">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 via-yellow-500 to-purple-500 rounded-3xl opacity-20 group-hover/lgbt:opacity-100 transition-opacity blur-[2px] group-hover/lgbt:blur-md" />
                  <div className="relative">
                      <EventCard event={event} />
                      <div className="absolute top-4 left-4 pointer-events-none">
                        <Badge className="bg-secondary text-white font-black uppercase text-[8px] h-5 shadow-xl border-none">LGBTQ+</Badge>
                      </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-32 text-center bg-white/10 backdrop-blur-md rounded-[3rem] border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-4 shadow-inner text-white">
              <Inbox className="w-12 h-12 opacity-40" />
              <p className="text-sm font-black uppercase tracking-widest">Nenhum evento localizado para estes filtros.</p>
              <Button variant="link" className="text-white font-bold underline" onClick={clearFilters}>Limpar Filtros</Button>
            </div>
          )}
        </main>

        <Footer />
      </div>
    </ProgressPrideBackground>
  )
}