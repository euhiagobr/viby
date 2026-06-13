
"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, doc, query, where, limit, orderBy, getDocs, startAfter, DocumentSnapshot } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { AdsRenderer } from "@/components/ads/AdsRenderer"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  Loader2, 
  ShieldCheck, 
  Navigation, 
  ChevronRight,
  Clock,
  FilterX,
  TrendingUp,
  History,
  Calendar as CalendarIcon,
  Tag,
  MapPin,
  Inbox,
  AlertTriangle
} from "lucide-react"
import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { getCurrentLocation, type Coordinates } from "@/lib/location-utils"
import { calculateDistanceMeters, isEventVisible } from "@/lib/event-scoring-utils"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"
import { cn, normalizeText } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { format, startOfToday, addDays, endOfWeek, isSameDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useTranslation } from "@/i18n/i18n-context"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function ExplorarClient({ initialEvents = [] }: { initialEvents?: any[] }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [searchCity, setSearchCity] = useState('')
  const [radiusKm, setRadiusKm] = useState('30')
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null)
  const [now, setNow] = useState<Date | null>(null)
  
  const [dateFilter, setDateFilter] = React.useState<"all" | "today" | "tomorrow" | "week" | "custom">("all")
  const [customDate, setCustomDate] = React.useState<Date | undefined>(undefined)

  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  
  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile } = useDoc<any>(userDocRef)
  
  const isAdmin = profile?.role === 'admin'

  // Pagination State
  const [rawEvents, setRawEvents] = useState<any[]>(initialEvents)
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = useState(initialEvents.length >= 9)
  const [isFetching, setIsFetching] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(initialEvents.length === 0)

  // Atualiza o relógio a cada minuto para manter sincronia de visibilidade
  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const categoriesQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "categories"), orderBy("name", "asc"))
  }, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const occurrencesQuery = useMemoFirebase(() => {
    if (!db) return null
    const yesterdayStr = format(addDays(startOfToday(), -1), 'yyyy-MM-dd')
    return query(collection(db, "recurring_occurrences"), where("status", "==", "active"), where("date", ">=", yesterdayStr))
  }, [db])
  const { data: allOccurrences } = useCollection<any>(occurrencesQuery)

  const fetchEvents = React.useCallback(async (isInitial = false) => {
    if (!db || isFetching || (!isInitial && !hasMore)) return
    
    setIsFetching(true)
    try {
      const q = query(
        collection(db, "events"),
        where("status", "==", "Ativo"),
        orderBy("date", "asc"),
        ...(isInitial ? [limit(9)] : [startAfter(lastVisible), limit(6)])
      )
      
      const snapshot = await getDocs(q)
      const fetchedDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      
      if (isInitial) {
        setRawEvents(fetchedDocs)
      } else {
        setRawEvents(prev => [...prev, ...fetchedDocs])
      }
      
      if (snapshot.docs.length > 0) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1])
      }
      setHasMore(snapshot.docs.length >= (isInitial ? 9 : 6))
    } catch (e) {
      console.error("[Explorar Pagination Error]", e)
    } finally {
      setIsFetching(false)
      setIsInitialLoad(false)
    }
  }, [db, lastVisible, isFetching, hasMore])

  useEffect(() => {
    if (initialEvents.length === 0) {
      fetchEvents(true)
    }
    getCurrentLocation()
      .then(loc => { if(loc) setUserLocation(loc); })
      .catch(() => {});
  }, [db, initialEvents.length, fetchEvents])

  const processedEvents = React.useMemo(() => {
    if (!rawEvents) return { events: [], isFallback: false }
    
    const baseFiltered = rawEvents.map(e => {
      let effectiveDate = e.date;
      if (e.isRecurring && now) {
        const myOccs = allOccurrences?.filter((o: any) => o.parentId === e.id) || [];
        if (myOccs.length > 0) {
          const sorted = [...myOccs]
            .map(o => ({ ...o, _dt: new Date(o.date + 'T' + (o.startTime || '00:00') + ':00') }))
            .sort((a, b) => a._dt.getTime() - b._dt.getTime());
          
          const nextValid = sorted.find(o => {
            const endThreshold = new Date(o._dt.getTime() + 6 * 60 * 60 * 1000);
            return now < endThreshold;
          });

          if (nextValid) {
            effectiveDate = nextValid.date + 'T' + (nextValid.startTime || '19:00') + ':00';
          }
        }
      }
      return { ...e, date: effectiveDate };
    }).filter(e => {
      if (!isEventVisible(e)) return false
      
      const searchNorm = normalizeText(search);
      const matchesSearch = !search || 
        normalizeText(e.title || "").includes(searchNorm) ||
        (e.searchKeywords && e.searchKeywords.some((k: string) => k.includes(searchNorm)));

      const cityNorm = normalizeText(searchCity);
      if (searchCity) {
        const eventLoc = normalizeText(`${e.city || ""} ${e.state || ""}`);
        if (!eventLoc.includes(cityNorm)) return false;
      }

      const matchesCategory = selectedCategory === 'all' || e.categoryId === selectedCategory;
      
      let matchesDate = true;
      const parseDate = (val: any) => {
        if (!val) return null;
        if (val.toDate) return val.toDate();
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      };

      const eventDate = parseDate(e.date);
      if (!eventDate) return false;

      if (dateFilter !== 'all') {
        const today = startOfToday();
        if (dateFilter === 'today') matchesDate = isSameDay(eventDate, today);
        else if (dateFilter === 'tomorrow') matchesDate = isSameDay(eventDate, addDays(today, 1));
        else if (dateFilter === 'week') matchesDate = eventDate >= today && eventDate <= endOfWeek(today);
        else if (dateFilter === 'custom' && customDate) matchesDate = isSameDay(eventDate, customDate);
      }
      return matchesSearch && matchesCategory && matchesDate;
    }).map(e => {
      let distMeters = Infinity;
      if (userLocation && e.latitude && e.longitude) {
        distMeters = calculateDistanceMeters(userLocation, { latitude: e.latitude, longitude: e.longitude });
      }
      
      return {
        ...e,
        _distanceMeters: distMeters,
        _startDateTime: e.date?.toDate ? e.date.toDate() : new Date(e.date)
      };
    });

    let finalEvents = baseFiltered;
    let fallback = false;

    if (radiusKm !== 'unlimited' && userLocation) {
      const radiusMeters = parseInt(radiusKm) * 1000;
      finalEvents = baseFiltered.filter(e => e._distanceMeters <= radiusMeters);

      if (finalEvents.length === 0) {
        finalEvents = baseFiltered.filter(e => e._distanceMeters <= 100000);
        if (finalEvents.length > 0) fallback = true;
      }

      if (finalEvents.length === 0) {
        finalEvents = baseFiltered;
        if (finalEvents.length > 0) fallback = true;
      }
    }

    finalEvents.sort((a, b) => a._startDateTime.getTime() - b._startDateTime.getTime());

    return { events: finalEvents, isFallback: fallback };
  }, [rawEvents, allOccurrences, search, searchCity, userLocation, radiusKm, selectedCategory, dateFilter, customDate, now])

  const unifiedFeed = React.useMemo(() => {
    const result = [];
    let eventCounter = 0;
    let adIndex = 0;

    if (processedEvents.events.length === 0) {
      if (!isInitialLoad) {
        result.push({ type: "ad", adIndex: adIndex++ });
        result.push({ type: "ad", adIndex: adIndex++ });
      }
      return result;
    }

    for (let i = 0; i < processedEvents.events.length; i++) {
      result.push({ type: "event", data: processedEvents.events[i] });
      eventCounter++;

      if (eventCounter === 6) {
        result.push({ type: "ad", adIndex: adIndex++ });
        eventCounter = 0;
      }
    }

    return result;
  }, [processedEvents.events, isInitialLoad])

  const selectedCategoryName = React.useMemo(() => {
    if (selectedCategory === 'all') return t('dashboard.all');
    return categories?.find((c: any) => c.id === selectedCategory)?.name || t('dashboard.all');
  }, [selectedCategory, categories, t]);

  const clearFilters = () => {
    setSearch("");
    setSearchCity("");
    setSelectedCategory("all");
    setRadiusKm("30");
    setDateFilter("all");
    setCustomDate(undefined);
  };

  const observerTarget = React.useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isFetching && !isInitialLoad) {
          fetchEvents(false);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isFetching, isInitialLoad, fetchEvents]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-primary">{t('dashboard.title')}</h1>
            {isAdmin && <Button asChild variant="destructive" size="sm" className="rounded-full h-8 px-4 uppercase text-[9px] tracking-widest"><Link href="/admin"><ShieldCheck className="w-4 h-4" /> Admin</Link></Button>}
          </div>
          <p className="text-muted-foreground font-medium uppercase text-[11px] tracking-widest">{t('dashboard.subtitle')}</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('home.search_placeholder')} className="pl-10 h-11 rounded-xl" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="relative w-full sm:w-48">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
            <Input placeholder={t('home.where_placeholder')} className="pl-10 h-11 rounded-xl border-dashed" value={searchCity} onChange={(e) => setSearchCity(e.target.value)} />
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                className={cn(
                  "rounded-xl h-11 border-dashed gap-2 font-bold text-xs uppercase transition-all",
                  selectedCategory !== 'all' && "bg-secondary/10 border-secondary text-secondary"
                )}
              >
                <Tag className="h-4 w-4" />
                {selectedCategoryName}
                <ChevronRight className="h-4 w-4 opacity-30" />
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] w-[95vw] md:max-w-2xl bg-white border-none shadow-2xl p-0 overflow-hidden">
              <DialogHeader className="p-8 pb-0">
                <DialogTitle className="text-3xl font-black italic uppercase tracking-tighter text-primary">Categorias</DialogTitle>
                <DialogDescription className="font-bold text-secondary uppercase text-[10px] tracking-widest">O que você quer descobrir?</DialogDescription>
              </DialogHeader>
              
              <ScrollArea className="max-h-[60vh] p-8 pt-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                   <Button 
                    variant={selectedCategory === 'all' ? 'default' : 'outline'}
                    className={cn("h-16 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all", selectedCategory === 'all' ? "bg-secondary text-white shadow-lg shadow-secondary/20" : "border-muted hover:border-secondary/30")}
                    onClick={() => setSelectedCategory('all')}
                   >
                     Tudo
                   </Button>
                   {categories?.map((cat: any) => (
                     <Button 
                      key={cat.id}
                      variant={selectedCategory === cat.id ? 'default' : 'outline'}
                      className={cn("h-16 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all", selectedCategory === cat.id ? "bg-secondary text-white shadow-lg shadow-secondary/20" : "border-muted hover:border-secondary/30")}
                      onClick={() => setSelectedCategory(cat.id)}
                     >
                       {cat.name}
                     </Button>
                   ))}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("rounded-xl h-11 border-dashed gap-2 font-bold text-xs uppercase", dateFilter !== 'all' && "bg-secondary/10 border-secondary text-secondary")}>
                <CalendarIcon className="h-4 w-4" />
                {dateFilter === 'today' ? t('home.today') :
                 dateFilter === 'tomorrow' ? t('home.tomorrow') :
                 dateFilter === 'week' ? t('home.week') :
                 dateFilter === 'custom' && customDate ? format(customDate, "dd/MM", { locale: ptBR }) :
                 t('home.when_label')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="end">
              <div className="p-3 border-b grid grid-cols-3 gap-2">
                  <Button variant="ghost" size="sm" className={cn("text-[10px] font-black uppercase rounded-lg", dateFilter === 'today' && "bg-secondary text-white hover:bg-secondary/90")} onClick={() => { setDateFilter('today'); setCustomDate(undefined); }}>{t('home.today')}</Button>
                  <Button variant="ghost" size="sm" className={cn("text-[10px] font-black uppercase rounded-lg", dateFilter === 'tomorrow' && "bg-secondary text-white hover:bg-secondary/90")} onClick={() => { setDateFilter('tomorrow'); setCustomDate(undefined); }}>{t('home.tomorrow')}</Button>
                  <Button variant="ghost" size="sm" className={cn("text-[10px] font-black uppercase rounded-lg", dateFilter === 'week' && "bg-secondary text-white hover:bg-secondary/90")} onClick={() => { setDateFilter('week'); setCustomDate(undefined); }}>{t('home.week')}</Button>
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

          <Select value={radiusKm} onValueChange={setRadiusKm}>
            <SelectTrigger className="w-32 h-11 rounded-xl border-dashed">
               <div className="flex items-center gap-2 font-bold text-xs"><Navigation className="w-3 h-3" /><SelectValue /></div>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
               <SelectItem value="10">10km</SelectItem>
               <SelectItem value="30">30km</SelectItem>
               <SelectItem value="100">100km</SelectItem>
               <SelectItem value="unlimited">Ilimitado</SelectItem>
            </SelectContent>
          </Select>

          {(search || searchCity || selectedCategory !== 'all' || dateFilter !== 'all') && (
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-destructive hover:bg-destructive/10" onClick={clearFilters}>
              <FilterX className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {processedEvents.isFallback && (
        <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex items-center gap-3 text-orange-800 animate-in slide-in-from-top-2">
           <AlertTriangle className="w-5 h-5 shrink-0" />
           <p className="text-xs font-bold uppercase tracking-tight">Não encontramos eventos no seu raio preferido. Mostrando opções mais distantes.</p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/30 p-1 rounded-2xl h-14 w-full md:w-fit">
          <TabsTrigger value="all" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest gap-2">
            Geral
          </TabsTrigger>
          <TabsTrigger value="trending" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest gap-2">
            <TrendingUp className="w-4 h-4" /> 
            Em Alta
          </TabsTrigger>
          <TabsTrigger value="recent" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest gap-2">
            <History className="w-4 h-4" /> 
            Mais Próximos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-8">
           {isInitialLoad ? (
             <div className="py-32 flex flex-col items-center justify-center gap-4">
               <Loader2 className="w-12 h-12 animate-spin text-secondary" />
               <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">{t('dashboard.syncing_data')}</p>
             </div>
           ) : (
             <>
               {unifiedFeed.length === 0 && !isFetching && (
                 <div className="py-40 text-center bg-white rounded-[3rem] border-2 border-dashed opacity-40 mb-10 flex flex-col items-center gap-4">
                   <Inbox className="w-10 h-10" />
                   <p className="text-xs font-black uppercase tracking-widest">{t('dashboard.no_events_filter')}</p>
                   <Button variant="link" onClick={clearFilters} className="font-bold uppercase text-[10px]">Limpar todos os filtros</Button>
                 </div>
               )}

               {unifiedFeed.length > 0 && (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {unifiedFeed.map((item: any, idx: number) => (
                      item.type === 'ad' ? (
                        <AdsRenderer 
                          key={`ad-slot-${item.adIndex}-${idx}`} 
                          location="feed" 
                          index={item.adIndex} 
                          googleSlotId="discovery-feed-slot" 
                        />
                      ) : (
                        <EventCard 
                          key={`event-${item.data.id}-${idx}`} 
                          event={item.data} 
                          userLocation={userLocation} 
                          isSponsored={item.data.isSponsored} 
                        />
                      )
                    ))}
                 </div>
               )}
               
               {isFetching && (
                 <div className="py-10 flex justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                 </div>
               )}

               {!isFetching && hasMore && (
                 <div ref={observerTarget} className="h-20" />
               )}
             </>
           )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
