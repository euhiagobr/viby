
'use client';

import * as React from "react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, limit, startAfter, getDocs, DocumentSnapshot } from "firebase/firestore";
import { EventCard } from "@/components/events/EventCard";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  Inbox, 
  Calendar as CalendarIcon, 
  MapPin, 
  ChevronRight, 
  Globe, 
  Tag, 
  Search, 
  FilterX, 
  Clock,
  Navigation
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfToday, addDays, endOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { cn, normalizeText, safeParseDate } from "@/lib/utils";
import { getCurrentLocation, type Coordinates } from "@/lib/location-utils";
import { isEventVisible, calculateDistanceMeters } from "@/lib/event-scoring-utils";

interface CityPageClientProps {
  initialEvents: any[];
  cityName: string;
  regionLabel: string;
  regionSlug: string;
  citySlug: string;
}

export default function CityPageClient({ initialEvents, cityName, regionLabel, regionSlug, citySlug }: CityPageClientProps) {
  const db = useFirestore();
  const [mounted, setMounted] = React.useState(false);
  const [userLocation, setUserLocation] = React.useState<Coordinates | null>(null);
  
  // Estados de Filtro
  const [search, setSearch] = React.useState("");
  const [searchLocal, setSearchLocal] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState<"all" | "today" | "tomorrow" | "week" | "custom">("all");
  const [customDate, setCustomDate] = React.useState<Date | undefined>(undefined);

  // Estados de Paginação
  const [rawEvents, setRawEvents] = React.useState(initialEvents);
  const [lastVisible, setLastVisible] = React.useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = React.useState(initialEvents.length >= 12);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    getCurrentLocation().then(loc => { if(loc) setUserLocation(loc); }).catch(() => {});
  }, []);

  const fetchMore = async () => {
    if (!db || loading || !hasMore) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "events"),
        where("status", "==", "Ativo"),
        where("regionSlug", "==", regionSlug),
        where("citySlug", "==", citySlug),
        orderBy("date", "asc"),
        startAfter(lastVisible || safeParseDate(rawEvents[rawEvents.length - 1]?.date)),
        limit(12)
      );

      const snap = await getDocs(q);
      const newDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      setRawEvents(prev => [...prev, ...newDocs]);
      setLastVisible(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === 12);
    } catch (e) {
      console.error("[City Pagination Error]", e);
    } finally {
      setLoading(false);
    }
  };

  const processedEvents = React.useMemo(() => {
    if (!mounted) return initialEvents;

    const today = startOfToday();
    const searchNorm = normalizeText(search);
    const localNorm = normalizeText(searchLocal);

    return rawEvents.filter(e => {
      // 1. Visibilidade Básica
      if (!isEventVisible(e)) return false;

      // 2. Filtro de Nome/Tags
      const matchesSearch = !search || 
        normalizeText(e.title || "").includes(searchNorm) ||
        (e.tags && e.tags.some(t => normalizeText(t).includes(searchNorm)));

      // 3. Filtro de Local/Bairro
      const eventLocal = normalizeText(`${e.location || ""} ${e.address?.neighborhood || ""} ${e.address?.venueName || ""}`);
      const matchesLocal = !searchLocal || eventLocal.includes(localNorm);

      // 4. Filtro de Data
      let matchesDate = true;
      const eventDate = safeParseDate(e.date);
      
      if (!eventDate) return false;

      if (dateFilter !== 'all') {
        if (dateFilter === 'today') matchesDate = isSameDay(eventDate, today);
        else if (dateFilter === 'tomorrow') matchesDate = isSameDay(eventDate, addDays(today, 1));
        else if (dateFilter === 'week') matchesDate = eventDate >= today && eventDate <= endOfWeek(today);
        else if (dateFilter === 'custom' && customDate) matchesDate = isSameDay(eventDate, customDate);
      }

      return matchesSearch && matchesLocal && matchesDate;
    }).sort((a, b) => {
      const dateA = safeParseDate(a.date)?.getTime() || 0;
      const dateB = safeParseDate(b.date)?.getTime() || 0;
      return dateA - dateB;
    });
  }, [rawEvents, search, searchLocal, dateFilter, customDate, mounted, initialEvents]);

  const clearFilters = () => {
    setSearch("");
    setSearchLocal("");
    setDateFilter("all");
    setCustomDate(undefined);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-12">
      <header className="bg-white border-b py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <Globe className="w-[800px] h-[800px] absolute -right-20 -top-20" />
        </div>
        <div className="container mx-auto px-4 text-center relative z-10 space-y-6">
          <Badge variant="secondary" className="font-black uppercase text-[10px] px-4 h-6 tracking-widest bg-secondary/10 text-secondary border-none">
            {regionLabel}
          </Badge>
          <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter leading-[0.85] text-primary">
            O que fazer em <span className="text-secondary">{cityName}</span>
          </h1>
          
          <div className="max-w-4xl mx-auto mt-12 bg-white/80 backdrop-blur-xl border border-border/40 rounded-[2.5rem] p-6 shadow-2xl flex flex-wrap gap-3 items-center">
             <div className="flex-1 min-w-[240px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="O que você quer viver?" 
                  className="pl-10 h-12 rounded-2xl bg-white border-none shadow-inner"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
             </div>

             <div className="flex-1 min-w-[180px] relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
                <Input 
                  placeholder="Local ou Bairro" 
                  className="pl-10 h-12 rounded-2xl bg-white border-none shadow-inner"
                  value={searchLocal}
                  onChange={e => setSearchLocal(e.target.value)}
                />
             </div>

             <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("rounded-2xl h-12 border-dashed gap-2 font-black text-[10px] uppercase transition-all px-6", dateFilter !== 'all' && "bg-secondary/10 border-secondary text-secondary")}>
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
                      <Button variant="ghost" size="sm" className={cn("text-[9px] font-black uppercase rounded-lg", dateFilter === 'today' && "bg-secondary text-white")} onClick={() => { setDateFilter('today'); setCustomDate(undefined); }}>Hoje</Button>
                      <Button variant="ghost" size="sm" className={cn("text-[9px] font-black uppercase rounded-lg", dateFilter === 'tomorrow' && "bg-secondary text-white")} onClick={() => { setDateFilter('tomorrow'); setCustomDate(undefined); }}>Amanhã</Button>
                      <Button variant="ghost" size="sm" className={cn("text-[9px] font-black uppercase rounded-lg", dateFilter === 'week' && "bg-secondary text-white")} onClick={() => { setDateFilter('week'); setCustomDate(undefined); }}>Semana</Button>
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

             {(search || searchLocal || dateFilter !== 'all') && (
               <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl text-destructive hover:bg-destructive/10" onClick={clearFilters}>
                 <FilterX className="w-4 h-4" />
               </Button>
             )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 space-y-20 pb-24">
        <section className="space-y-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between px-2 gap-4">
             <div className="space-y-1">
                <h2 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Próximas Experiências</h2>
                <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
                  <Clock className="w-4 h-4 text-secondary" /> Calendário Atualizado: {format(new Date(), "HH:mm")}
                </p>
             </div>
             <Badge className="bg-secondary text-white font-black uppercase italic text-[10px] h-6 px-4 shadow-lg rounded-full">
                {processedEvents.length} Eventos Localizados
             </Badge>
          </div>

          {processedEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {processedEvents.map((event) => (
                <EventCard key={event.id} event={event} userLocation={userLocation} />
              ))}
            </div>
          ) : (
            <div className="py-32 text-center bg-white rounded-[4rem] border-2 border-dashed flex flex-col items-center gap-6">
               <Inbox className="w-16 h-16 text-muted-foreground opacity-20" />
               <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase italic text-primary">Nenhum evento encontrado.</h3>
                  <p className="text-muted-foreground font-medium uppercase text-xs">Tente ajustar seus filtros ou mude o período da busca.</p>
               </div>
               <Button variant="outline" onClick={clearFilters} className="rounded-2xl h-14 px-10 border-2 uppercase font-black italic">
                  Limpar Busca
               </Button>
            </div>
          )}

          {hasMore && processedEvents.length === rawEvents.length && (
            <div className="flex justify-center pt-10">
              <Button onClick={fetchMore} disabled={loading} variant="outline" className="rounded-full px-12 h-14 font-black uppercase italic border-2 border-secondary text-secondary">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ver mais em " + cityName}
              </Button>
            </div>
          )}
        </section>

        <Separator className="border-dashed" />

        <section className="max-w-4xl mx-auto space-y-12">
          <div className="space-y-6">
             <h3 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Eventos em {cityName}</h3>
             <p className="text-lg text-muted-foreground leading-relaxed font-medium">
               Descubra os melhores eventos acontecendo em {cityName}. Encontre shows, festas, eventos culturais, feiras, experiências gastronômicas, esportivas e muito mais. 
               A Viby conecta você com a pulsação urbana de {cityName}, trazendo sempre as opções mais relevantes de acordo com a sua localização e interesses.
             </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-2">
                  <Tag className="w-4 h-4" /> Categorias em Alta
                </h4>
                <div className="flex flex-wrap gap-2">
                   {["Shows", "Festas", "Cultura", "Gastronomia", "Esporte"].map(cat => (
                     <Button key={cat} variant="ghost" onClick={() => setSearch(cat)} className="h-9 px-4 bg-muted rounded-xl text-[10px] font-black uppercase text-primary hover:bg-secondary hover:text-white transition-all">
                       {cat}
                     </Button>
                   ))}
                </div>
             </Card>

             <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-2">
                  <Navigation className="w-4 h-4" /> Navegação Regional
                </h4>
                <div className="flex flex-wrap gap-2">
                   <Link href={`/o-que-fazer-em/${regionSlug}/${citySlug}`} className="px-4 py-2 bg-secondary text-white rounded-xl text-[10px] font-black uppercase italic shadow-lg">
                     {cityName}
                   </Link>
                </div>
             </Card>
          </div>
        </section>
      </main>
    </div>
  );
}

