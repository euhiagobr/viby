
"use client"

import * as React from "react"
import { useCollection, useFirestore, useUser, useAuth } from "@/firebase"
import { collection, query, where, limit, orderBy, getDocs, startAfter, DocumentSnapshot } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Trophy, 
  MapPin, 
  Search, 
  Loader2, 
  Navigation, 
  FilterX, 
  Zap, 
  Globe, 
  Ticket,
  ChevronRight,
  Inbox,
  Clock,
  Coins
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { cn, normalizeText } from "@/lib/utils"
import { getCurrentLocation, type Coordinates } from "@/lib/location-utils"
import { isEventVisible, calculateDistanceMeters } from "@/lib/event-scoring-utils"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"
import { format, startOfToday, addDays } from "date-fns"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { COPA_TAGS } from "@/lib/constants"

export default function CopaMundoClient({ initialEvents = [] }: { initialEvents?: any[] }) {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  const [search, setSearch] = React.useState("")
  const [searchCity, setSearchCity] = React.useState("")
  const [priceFilter, setPriceFilter] = React.useState("all")
  const [dateFilter, setDateFilter] = React.useState("all")
  const [userLocation, setUserLocation] = React.useState<Coordinates | null>(null)
  const [now, setNow] = React.useState<Date | null>(null)

  const [rawEvents, setRawEvents] = React.useState<any[]>(initialEvents)
  const [lastVisible, setLastVisible] = React.useState<DocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = React.useState(initialEvents.length >= 12)
  const [isFetching, setIsFetching] = React.useState(false)

  React.useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 60000)
    getCurrentLocation()
      .then(loc => { if (loc) setUserLocation(loc); })
      .catch(() => {});
    return () => clearInterval(timer)
  }, []);

  // Pipeline de Ocorrências para eventos recorrentes
  const occurrencesQuery = useMemoFirebase(() => {
    if (!db) return null
    const yesterdayStr = format(addDays(startOfToday(), -1), 'yyyy-MM-dd')
    return query(collection(db, "recurring_occurrences"), where("status", "==", "active"), where("date", ">=", yesterdayStr))
  }, [db])
  const { data: allOccurrences } = useCollection<any>(occurrencesQuery)

  const fetchMore = async () => {
    if (!db || isFetching || !hasMore) return
    setIsFetching(true)
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - 30);
      
      const cursor = lastVisible || (rawEvents.length > 0 ? rawEvents[rawEvents.length - 1].date : null);

      const q = query(
        collection(db, "events"),
        where("status", "==", "Ativo"),
        where("tags", "array-contains-any", COPA_TAGS),
        where("date", ">=", thresholdDate.toISOString()),
        orderBy("date", "asc"),
        startAfter(cursor),
        limit(12)
      )
      const snap = await getDocs(q)
      const newDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      
      setRawEvents(prev => {
        const existingIds = new Set(prev.map(i => i.id));
        const filtered = newDocs.filter(f => !existingIds.has(f.id));
        return [...prev, ...filtered];
      });

      setLastVisible(snap.docs[snap.docs.length - 1] || null)
      setHasMore(snap.docs.length === 12)
    } catch (e) {
      console.error(e)
    } finally {
      setIsFetching(false)
    }
  }

  const processedEvents = React.useMemo(() => {
    const cityNorm = normalizeText(searchCity);
    const searchNorm = normalizeText(search);
    const refTime = now || new Date();

    return rawEvents.map(e => {
      let effectiveDate = e.date;
      let effectiveEndDate = e.endDate;
      let nextOccurrences: any[] = [];

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
            
            if (nextValid.endTime) {
              effectiveEndDate = `${nextValid.date}T${nextValid.endTime}:00`;
            } else {
              const dStart = new Date(e.date || 0).getTime();
              const dEnd = new Date(e.endDate || 0).getTime();
              const duration = (!isNaN(dStart) && !isNaN(dEnd) && dEnd > dStart) ? (dEnd - dStart) : (4 * 60 * 60 * 1000);
              effectiveEndDate = new Date(new Date(effectiveDate).getTime() + duration).toISOString();
            }

            nextOccurrences = sorted
              .filter(o => new Date(o._dt.getTime() + 6 * 60 * 60 * 1000) > refTime)
              .slice(0, 3);
          }
        }
      }
      return { ...e, date: effectiveDate, endDate: effectiveEndDate, _nextOccurrences: nextOccurrences };
    }).filter(e => {
      if (!isEventVisible(e, refTime)) return false;
      
      if (search && !normalizeText(e.title || "").includes(searchNorm)) return false;
      if (searchCity && !normalizeText(e.city || "").includes(cityNorm)) return false;

      // Filtro de Preço
      if (priceFilter !== 'all') {
        const minPrice = e.startingPrice ?? 0;
        if (priceFilter === 'free' && minPrice > 0) return false;
        if (priceFilter === '20' && minPrice > 20) return false;
        if (priceFilter === '50' && minPrice > 50) return false;
        if (priceFilter === '100' && minPrice > 100) return false;
      }

      // Filtro de Data
      if (refTime) {
        const dateStr = e.date?.toDate ? e.date.toDate().toISOString() : e.date;
        const eventDate = new Date(dateStr);
        if (dateFilter === 'today' && eventDate.toDateString() !== refTime.toDateString()) return false;
        if (dateFilter === 'week') {
          const nextWeek = new Date();
          nextWeek.setDate(refTime.getDate() + 7);
          if (eventDate > nextWeek) return false;
        }
      }

      return true;
    }).map(e => {
      let dist = Infinity;
      if (userLocation && e.latitude && e.longitude) {
        dist = calculateDistanceMeters(userLocation, { latitude: e.latitude, longitude: e.longitude });
      }
      const dateStr = e.date?.toDate ? e.date.toDate().toISOString() : e.date;
      const startDateTime = new Date(dateStr);
      return { ...e, _distanceMeters: dist, _startDateTime: isNaN(startDateTime.getTime()) ? new Date() : startDateTime };
    }).sort((a, b) => {
      const timeDiff = a._startDateTime.getTime() - b._startDateTime.getTime();
      if (timeDiff !== 0) return timeDiff;
      return a._distanceMeters - b._distanceMeters;
    });
  }, [rawEvents, allOccurrences, search, searchCity, priceFilter, dateFilter, userLocation, now]);

  const clearFilters = () => {
    setSearch("");
    setSearchCity("");
    setPriceFilter("all");
    setDateFilter("all");
  };

  const handleGlobalSearchManual = () => {
    const feedSection = document.getElementById('copa-feed');
    if (feedSection) {
      feedSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden bg-[#002776] text-white">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
           <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/stadium/1920/1080')] bg-cover bg-center grayscale" />
           <div className="absolute inset-0 bg-gradient-to-b from-[#002776]/90 via-[#002776]/60 to-[#002776]" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10 py-20 text-center">
          <div className="max-w-4xl mx-auto space-y-10 flex flex-col items-center">
            <Badge className="bg-[#ffdf00] text-[#002776] border-none px-4 py-1.5 rounded-full font-black uppercase text-[10px] tracking-widest flex items-center gap-2 animate-pulse cursor-pointer">
              <Trophy className="w-3.5 h-3.5 fill-current" /> Rumo ao Hexa 2026
            </Badge>
            <h1 className="text-6xl md:text-9xl font-black uppercase italic tracking-tighter leading-[0.8]">
              SAIBA ONDE ASSISTIR À <span className="text-[#009c3b]">COPA</span> DO <span className="text-[#ffdf00]">MUNDO</span>
            </h1>
            <p className="text-lg md:text-2xl font-medium opacity-80 max-w-2xl mx-auto leading-relaxed">
              Encontre bares, festas, telões, restaurantes e eventos transmitindo os jogos da Copa do Mundo perto de você.
            </p>

            <Card className="bg-white/10 backdrop-blur-2xl border-white/10 rounded-[3rem] p-6 md:p-8 shadow-2xl mt-12 w-full text-left">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-4 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input 
                    placeholder="Buscar por local ou festa..." 
                    className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white placeholder:text-white/30"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="md:col-span-3 relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#ffdf00]" />
                  <Input 
                    placeholder="Qual cidade?" 
                    className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white placeholder:text-white/30"
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                  />
                </div>
                <div className="md:col-span-3">
                   <Select value={priceFilter} onValueChange={setPriceFilter}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-14 rounded-2xl text-white">
                         <Coins className="w-4 h-4 text-[#009c3b] mr-2" />
                         <SelectValue placeholder="Preço" />
                      </SelectTrigger>
                      <SelectContent>
                         <SelectItem value="all">Qualquer valor</SelectItem>
                         <SelectItem value="free">Gratuito</SelectItem>
                         <SelectItem value="20">Até R$ 20</SelectItem>
                         <SelectItem value="50">Até R$ 50</SelectItem>
                         <SelectItem value="100">Até R$ 100</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
                <div className="md:col-span-2">
                   <Button onClick={handleGlobalSearchManual} className="w-full h-14 bg-[#009c3b] text-white font-black uppercase italic rounded-2xl shadow-xl hover:scale-105 transition-all">
                      Ver Jogos
                   </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section id="copa-feed" className="py-20 container mx-auto px-4 flex-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div className="space-y-2">
            <h2 className="text-5xl font-black uppercase italic tracking-tighter text-primary">Perto de <span className="text-[#009c3b]">Você</span></h2>
            <p className="text-muted-foreground font-medium text-lg">Os locais mais próximos transmitindo a emoção da Copa.</p>
          </div>
          <div className="flex items-center gap-3">
             <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-40 rounded-xl h-11 border-dashed">
                   <Clock className="w-4 h-4 mr-2 text-[#002776]" />
                   <SelectValue />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">Todos os jogos</SelectItem>
                   <SelectItem value="today">Hoje</SelectItem>
                   <SelectItem value="week">Esta semana</SelectItem>
                </SelectContent>
             </Select>
          </div>
        </div>

        {processedEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {processedEvents.map((event) => (
              <EventCard 
                key={event.id} 
                event={event} 
                userLocation={userLocation} 
                isSponsored={event.isSponsored} 
              />
            ))}
          </div>
        ) : (
          <div className="py-32 text-center bg-white rounded-[4rem] border-2 border-dashed border-border shadow-inner flex flex-col items-center gap-6">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center opacity-20">
               <Inbox className="w-12 h-12" />
            </div>
            <div className="space-y-2">
               <h3 className="text-2xl font-black uppercase italic text-primary">Ainda não encontramos locais transmitindo a Copa nesta região.</h3>
               <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">Novos eventos são adicionados diariamente.</p>
            </div>
            <Button variant="outline" onClick={clearFilters} className="rounded-full font-bold h-12 px-8 uppercase italic border-2">
               Explorar todos os eventos
            </Button>
          </div>
        )}

        {hasMore && (
           <div className="mt-20 flex justify-center">
              <Button 
                onClick={fetchMore} 
                disabled={isFetching}
                className="h-14 px-12 bg-white text-primary font-black border-2 rounded-2xl hover:bg-muted transition-all"
              >
                {isFetching ? <Loader2 className="w-5 h-5 animate-spin" /> : "Carregar Mais Locais"}
              </Button>
           </div>
        )}
      </section>
    </>
  )
}
