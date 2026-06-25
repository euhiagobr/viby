
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
  Users,
  Moon,
  Wind
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
import { PlaceHolderImages } from "@/lib/placeholder-images"
import { motion, AnimatePresence } from "framer-motion"

const ICON_MAP = {
  beer: Beer,
  ghost: Ghost,
  flame: Flame,
  gift: Gift,
  sparkles: Sparkles,
  music: Music,
};

const HopsSVG = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-40">
    <path d="M32 8C24 8 16 14 16 22C16 28 20 32 20 40C20 48 24 56 32 56C40 56 44 48 44 40C44 32 48 28 48 22C48 14 40 8 32 8Z" stroke="#FFCC00" strokeWidth="2" />
    <path d="M32 8V56M16 22H48M20 40H44" stroke="#FFCC00" strokeWidth="1" strokeDasharray="4 4" />
  </svg>
);

const WheatSVG = () => (
  <svg width="40" height="120" viewBox="0 0 40 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-30">
    <path d="M20 120V10M20 40L10 30M20 40L30 30M20 60L10 50M20 60L30 50M20 80L10 70M20 80L30 70M20 20L10 10M20 20L30 10" stroke="#FFCC00" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const BatSVG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12,4.33C12.83,4.33 13.5,5 13.5,5.83C13.5,6.67 12.83,7.33 12,7.33C11.17,7.33 10.5,6.67 10.5,5.83C10.5,5 11.17,4.33 12,4.33M12,2C10.17,2 8.67,3.5 8.67,5.33C8.67,7.17 10.17,8.67 12,8.67C13.83,8.67 15.33,7.17 15.33,5.33C15.33,3.5 13.83,2 12,2M22,12C22,12 19,10 16,10C15,10 14,11 14,12C14,13 15,14 16,14C19,14 22,12 22,12M2,12C2,12 5,10 8,10C9,10 10,11 10,12C10,13 9,14 8,14C5,14 2,12 2,12Z" />
  </svg>
);

const CobwebSVG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.2">
    <path d="M0 0 L100 100 M0 100 L100 0 M50 0 L50 100 M0 50 L100 50" />
    <path d="M10 10 Q 50 20 90 10 M10 90 Q 50 80 90 90 M10 10 Q 20 50 10 90 M90 10 Q 80 50 90 90" />
    <path d="M25 25 Q 50 35 75 25 M25 75 Q 50 65 75 75 M25 25 Q 35 50 25 75 M75 25 Q 65 50 75 75" />
  </svg>
);

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
  const isHalloween = config.slug === 'halloween';

  // Ocorrências para eventos recorrentes
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
            effectiveDate = nextValid.date + 'T' + (nextValid.startTime || '19:00') + ':00';
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
    <div className={cn("flex flex-col min-h-screen", isHalloween ? "bg-[#050505] text-white" : "bg-[#f8fafc]")}>
      <PublicHeader showBack />

      {/* HERO SECTION */}
      {isHalloween ? (
        <section className="relative min-h-[75vh] flex items-center justify-center overflow-hidden bg-[#050505] px-4">
           {/* Particles/Cinzas */}
           <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
              {Array.from({ length: 20 }).map((_, i) => (
                <div 
                  key={i} 
                  className="absolute w-1 h-1 bg-white/10 rounded-full animate-mist"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 10}s`,
                    animationDuration: `${15 + Math.random() * 10}s`
                  }}
                />
              ))}
           </div>

           {/* Mist / Névoa rasteira */}
           <div className="absolute bottom-0 left-0 right-0 h-[40vh] bg-gradient-to-t from-black via-purple-900/10 to-transparent z-20 pointer-events-none">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 animate-mist" />
           </div>

           {/* Decorativos SVG */}
           <div className="absolute top-0 left-0 p-10 z-0">
              <CobwebSVG className="w-64 h-64 text-purple-500/20" />
           </div>
           <div className="absolute top-20 right-20 z-0">
              <Moon className="w-48 h-48 text-white/5 fill-white/5 blur-sm" />
           </div>

           {/* Morcegos Animados */}
           <div className="absolute inset-0 pointer-events-none z-30">
              <BatSVG className="absolute w-8 h-8 text-black/40 animate-bat" style={{ animationDelay: '2s' }} />
              <BatSVG className="absolute w-12 h-12 text-black/60 animate-bat" style={{ animationDelay: '7s' }} />
              <BatSVG className="absolute w-6 h-6 text-black/30 animate-bat" style={{ animationDelay: '0s' }} />
           </div>

           <div className="container mx-auto max-w-4xl relative z-40 py-24 text-center">
              <div className="flex flex-col items-center gap-12">
                 <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4"
                 >
                    <Badge className="bg-[#FF6B00] text-black border-none px-8 py-2 rounded-full font-black uppercase text-xs tracking-widest shadow-[0_0_30px_rgba(255,107,0,0.4)] animate-pulse">
                      Edição Especial Limitada
                    </Badge>
                    <div className="flex gap-4">
                       <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-glow-orange" />
                       <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-glow-orange" style={{ animationDelay: '1s' }} />
                       <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-glow-orange" style={{ animationDelay: '2s' }} />
                    </div>
                 </motion.div>

                 <div className="relative">
                    <h1 className="text-7xl md:text-[12rem] font-black uppercase italic tracking-tighter leading-[0.75] text-white drop-shadow-[0_0_50px_rgba(45,10,69,0.8)]">
                       HALLOW<br/><span className="text-[#FF6B00] animate-glow-orange">EEN</span>
                    </h1>
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-full text-center">
                       <p className="text-2xl md:text-4xl font-black uppercase italic tracking-[0.3em] text-purple-500/80">
                          2026
                       </p>
                    </div>
                 </div>

                 <p className="text-lg md:text-2xl font-medium text-white/70 max-w-2xl leading-relaxed uppercase tracking-wide italic mt-8">
                    {config.intro}
                 </p>

                 {/* Spooky Eyes que piscam raramente */}
                 <div className="absolute bottom-20 left-1/4 animate-eyes flex gap-2">
                    <div className="w-1 h-1 bg-[#FF6B00] rounded-full shadow-[0_0_5px_#FF6B00]" />
                    <div className="w-1 h-1 bg-[#FF6B00] rounded-full shadow-[0_0_5px_#FF6B00]" />
                 </div>
              </div>
           </div>
        </section>
      ) : isOktoberfest ? (
        <section className="relative min-h-[65vh] flex items-center justify-center overflow-hidden bg-wood text-white px-4">
           {/* Bavarian Border Pattern */}
           <div className="absolute top-0 left-0 right-0 h-4 bg-bavarian opacity-30 z-30" />
           <div className="absolute bottom-0 left-0 right-0 h-4 bg-bavarian opacity-30 z-30" />
           
           {/* Decorative Elements */}
           <div className="absolute left-10 top-1/2 -translate-y-1/2 hidden lg:block">
              <WheatSVG />
           </div>
           <div className="absolute right-10 top-1/2 -translate-y-1/2 hidden lg:block">
              <WheatSVG />
           </div>

           <div className="container mx-auto max-w-4xl relative z-10 py-24 text-center">
              <div className="flex flex-col items-center gap-10">
                 <div className="flex flex-col items-center gap-3">
                    <Badge className="bg-[#FFCC00] text-black border-none px-6 py-2 rounded-full font-black uppercase text-xs tracking-widest shadow-[0_0_20px_rgba(250,204,21,0.3)]">
                      Festival Premium
                    </Badge>
                    <div className="w-16 h-1 bg-[#DD0000] rounded-full" />
                 </div>

                 <div className="relative">
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                       <HopsSVG />
                    </div>
                    <h1 className="text-7xl md:text-[11rem] font-black uppercase italic tracking-tighter leading-[0.8] text-[#FFCC00] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
                       OKTOBER<br/><span className="text-white">FEST</span> 2026
                    </h1>
                 </div>

                 <div className="space-y-6 max-w-2xl">
                    <p className="text-xl md:text-3xl font-black uppercase italic tracking-widest text-[#DD0000]">
                       Viva a Tradição
                    </p>
                    <p className="text-lg md:text-xl font-medium text-white/80 leading-relaxed uppercase tracking-wide">
                       {config.intro}
                    </p>
                 </div>

                 <div className="flex gap-4">
                    <div className="w-3 h-3 rounded-full bg-[#000000] ring-1 ring-white/20" />
                    <div className="w-3 h-3 rounded-full bg-[#DD0000] ring-1 ring-white/20" />
                    <div className="w-3 h-3 rounded-full bg-[#FFCC00] ring-1 ring-white/20" />
                 </div>
              </div>
           </div>

           {/* Subtle Vignette */}
           <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black opacity-60" />
        </section>
      ) : (
        <section className={cn(
          "relative min-h-[65vh] flex items-center justify-center overflow-hidden text-white transition-all duration-700",
          config.themeColor
        )}>
          <div className="absolute inset-0 opacity-50 pointer-events-none">
             <div 
               className="absolute inset-0 bg-cover bg-center" 
               style={{ backgroundImage: `url(${config.heroBg})` }}
               data-ai-hint={config.heroHint}
             />
             <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90" />
          </div>

          <div className="container mx-auto px-4 relative z-10 py-20 text-center">
            <div className="max-w-4xl mx-auto space-y-8 flex flex-col items-center">
              <Badge className="bg-white/20 backdrop-blur-md border-none px-6 py-2 rounded-full font-black uppercase text-xs tracking-widest flex items-center gap-2">
                <IconComponent className="w-4 h-4 fill-current" /> Viby Temático
              </Badge>

              <h1 className="text-6xl md:text-[8rem] font-black uppercase italic tracking-tighter leading-[0.8] text-white drop-shadow-2xl">
                {config.title}
              </h1>

              <p className="text-xl md:text-2xl font-medium opacity-95 max-w-2xl mx-auto leading-relaxed uppercase tracking-wide italic">
                {config.intro}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* SECTION: VIVA A TRADIÇÃO ALEMÃ (OKTOBERFEST ONLY) */}
      {isOktoberfest && (
        <section className="py-32 bg-white relative overflow-hidden">
           <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
              <Beer className="w-64 h-64 text-[#FFCC00]" />
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
                    <div className="p-6 bg-[#fdf6e3] rounded-[2rem] border border-[#FFCC00]/30 text-center shadow-sm hover:shadow-md transition-all">
                       <Beer className="w-10 h-10 text-[#FFCC00] mx-auto mb-3" />
                       <p className="text-[10px] font-black uppercase tracking-tight text-[#78350f]">Chope Gelado</p>
                    </div>
                    <div className="p-6 bg-[#fdf6e3] rounded-[2rem] border border-[#FFCC00]/30 text-center shadow-sm hover:shadow-md transition-all">
                       <Music className="w-10 h-10 text-[#DD0000] mx-auto mb-3" />
                       <p className="text-[10px] font-black uppercase tracking-tight text-[#DD0000]">Bandas Típicas</p>
                    </div>
                    <div className="p-6 bg-[#fdf6e3] rounded-[2rem] border border-[#FFCC00]/30 text-center shadow-sm hover:shadow-md transition-all">
                       <Users className="w-10 h-10 text-primary mx-auto mb-3" />
                       <p className="text-[10px] font-black uppercase tracking-tight text-primary">Confraternização</p>
                    </div>
                 </div>
              </div>
              <div className="relative group">
                 <div className="absolute -inset-4 bg-[#FFCC00]/10 rounded-[4rem] blur-2xl group-hover:bg-[#DD0000]/10 transition-colors" />
                 <div className="relative grid grid-cols-2 gap-4">
                    <img 
                      src={PlaceHolderImages.find(img => img.id === 'oktoberfest-blumenau')?.imageUrl || "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Foktoberfest-blumenau-clube-candeias.jpeg?alt=media&token=2995612c-6f08-4db1-a427-8db6dddeb0da"} 
                      className="rounded-[3rem] shadow-2xl rotate-2 aspect-[5/7] object-cover" 
                      alt="Oktoberfest Blumenau" 
                    />
                    <img 
                      src={PlaceHolderImages.find(img => img.id === 'oktoberfest-poa')?.imageUrl || "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Foktoberfest-porto-alegre.png?alt=media&token=f6c36039-f98f-412d-8c87-568b7a631fe1"} 
                      className="rounded-[3rem] shadow-2xl -rotate-3 mt-12 aspect-[5/7] object-cover" 
                      alt="Oktoberfest Porto Alegre" 
                    />
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
                <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4", isOktoberfest ? "text-[#FFCC00]" : isHalloween ? "text-[#FF6B00]" : "opacity-40")} />
                <Input 
                  placeholder="Qual evento você busca?" 
                  className={cn(
                    "h-14 pl-12 rounded-2xl shadow-sm border-none text-sm font-bold uppercase",
                    isOktoberfest ? "bg-[#fdf6e3] text-primary placeholder:text-primary/40" : isHalloween ? "bg-[#1a1a1a] border-purple-500/20 text-white placeholder:text-white/30" : "bg-white"
                  )}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
             </div>
             <div className="relative w-full sm:w-56">
                <MapPin className={cn("absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4", isOktoberfest ? "text-[#DD0000]" : isHalloween ? "text-[#FF6B00]" : "opacity-40")} />
                <Input 
                  placeholder="Cidade" 
                  className={cn(
                    "h-14 pl-12 rounded-2xl shadow-sm border-none text-sm font-bold uppercase",
                    isOktoberfest ? "bg-[#fdf6e3] text-primary placeholder:text-primary/40" : isHalloween ? "bg-[#1a1a1a] border-purple-500/20 text-white placeholder:text-white/30" : "bg-white"
                  )}
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                />
             </div>
             
             <Select value={priceFilter} onValueChange={setPriceFilter}>
                <SelectTrigger className={cn("w-44 rounded-2xl h-14 border-none shadow-sm font-bold uppercase text-[10px]", isOktoberfest ? "bg-[#fdf6e3] text-primary" : isHalloween ? "bg-[#1a1a1a] text-white border-purple-500/20" : "bg-white")}>
                   <Coins className={cn("w-4 h-4 mr-2", isOktoberfest || isHalloween ? "text-[#FF6B00]" : "")} />
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
                  <Button variant="outline" className={cn("rounded-2xl h-14 border-none shadow-sm gap-2 font-black text-[10px] uppercase transition-all px-8", isOktoberfest ? "bg-[#fdf6e3] text-primary" : isHalloween ? "bg-[#1a1a1a] text-white hover:bg-purple-900/20" : "bg-white", dateFilter !== 'all' && "bg-primary text-white")}>
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
              <div key={event.id} className={cn(isHalloween && "group/spooky-card relative transition-all duration-500 hover:scale-[1.02]")}>
                 {isHalloween && (
                   <div className="absolute -inset-1 bg-gradient-to-r from-purple-900 via-[#FF6B00]/20 to-purple-900 rounded-[2.2rem] opacity-0 group-hover/spooky-card:opacity-100 blur-md transition-opacity pointer-events-none" />
                 )}
                 <EventCard 
                    event={{ ...event, userLocation }} 
                    thematicTheme={isOktoberfest ? 'oktoberfest' : 'default'}
                 />
              </div>
            ))}
          </div>
        ) : (
          <div className={cn(
            "py-40 text-center rounded-[4rem] border-2 border-dashed flex flex-col items-center gap-6 shadow-inner",
            isHalloween ? "bg-white/5 border-purple-500/20" : "bg-white border-border"
          )}>
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
                  isOktoberfest ? "bg-[#DD0000] text-white border-none" : isHalloween ? "bg-[#FF6B00] text-black border-none" : "bg-white text-primary"
                )}
              >
                {isFetching ? <Loader2 className="w-5 h-5 animate-spin" /> : `Ver mais ${isOktoberfest ? 'Oktoberfests' : isHalloween ? 'Halloween' : 'eventos'}`}
              </Button>
           </div>
        )}
      </section>

      <Footer />
    </div>
  )
}
