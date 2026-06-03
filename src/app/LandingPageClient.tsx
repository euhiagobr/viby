"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, query, limit, doc, where } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { AdCard } from "@/components/ads/AdCard"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, MapPin, FilterX, Navigation, ChevronLeft, ChevronRight, Loader2, Clock, Zap, Globe, Calendar as CalendarIcon, Inbox } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import Image from "next/image"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getCurrentLocation, calculateDistance, type Coordinates } from "@/lib/location-utils"
import { calculateEventScore, isEventVisible } from "@/lib/event-scoring-utils"
import Footer from "@/components/layout/Footer"
import { cn } from "@/lib/utils"
import useEmblaCarousel from 'embla-carousel-react'
import { PlaceHolderImages } from "@/lib/placeholder-images"
import { UserNav } from "@/components/layout/UserNav"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format, startOfToday, addDays, endOfWeek, isSameDay } from "date-fns"
import { ptBR } from "date-fns/locale"

export default function LandingPageClient() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  const [searchName, setSearchName] = React.useState("")
  const [selectedCity, setSelectedCity] = React.useState("all")
  const [selectedCategory, setSelectedCategory] = React.useState("all")
  const [radiusKm, setRadiusKm] = React.useState("50")
  const [userLocation, setUserLocation] = React.useState<Coordinates | null>(null)
  
  const [dateFilter, setDateFilter] = React.useState<"all" | "today" | "tomorrow" | "week" | "custom">("all")
  const [customDate, setCustomDate] = React.useState<Date | undefined>(undefined)

  const [showLiveOnly, setShowLiveOnly] = React.useState(false)
  const [showRegionOnly, setShowRegionOnly] = React.useState(false)

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)

  const eventsQuery = useMemoFirebase(() => {
    if (!db) return null
    // Busca eventos ativos. Nota: se houver erro de permissão aqui, o useCollection logará no console.
    return query(collection(db, "events"), where("status", "==", "Ativo"), limit(150))
  }, [db])

  const { data: events, loading: eventsLoading, error: eventsError } = useCollection<any>(eventsQuery)

  const categoriesQuery = useMemoFirebase(() => db ? collection(db, "categories") : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const adsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "ads"), where("status", "==", "Ativo"))
  }, [db])
  const { data: activeAds } = useCollection<any>(adsQuery)

  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false, 
    align: 'center', 
    slidesToScroll: 1,
    containScroll: 'trimSnaps'
  })

  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-bg')?.imageUrl || "https://picsum.photos/seed/vibyhero-event/1920/1080"

  React.useEffect(() => {
    getCurrentLocation()
      .then(loc => {
        console.log("[Debug] Localização GPS obtida:", loc);
        setUserLocation(loc);
      })
      .catch((err) => {
        console.warn("[Debug] GPS negado ou falhou:", err.message);
      })
  }, [])

  // Log de status das coleções
  React.useEffect(() => {
    if (!eventsLoading) {
      console.log("[Debug] Firestore Events carregados:", events?.length || 0);
      if (eventsError) console.error("[Debug] Erro Firestore Events:", eventsError);
    }
  }, [events, eventsLoading, eventsError]);

  const filteredAndSortedEvents = React.useMemo(() => {
    if (!events || events.length === 0) return []

    console.log("[Debug] Iniciando filtragem de eventos...");

    let result = events.filter(e => {
      // 1. Visibilidade Básica
      if (!isEventVisible(e)) {
        // console.log(`[Debug] Evento Ocultado (isEventVisible): ${e.title}`);
        return false;
      }

      // 2. Busca por Nome
      const matchesSearch = !searchName || e.title?.toLowerCase().includes(searchName.toLowerCase());
      if (!matchesSearch) return false;

      // 3. Cidade e Categoria
      const matchesCity = selectedCity === 'all' || e.city === selectedCity;
      const matchesCategory = selectedCategory === 'all' || e.categoryId === selectedCategory;
      if (!matchesCity || !matchesCategory) return false;
      
      // 4. Parsing de Data Robusto
      const parseDate = (val: any) => {
        if (!val) return null;
        if (val.toDate) return val.toDate();
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      };

      const eventDate = parseDate(e.date);
      if (!eventDate) {
        console.warn(`[Debug] Evento sem data válida ignorado: ${e.title}`, e.date);
        return false;
      }

      const endDate = parseDate(e.endDate) || new Date(eventDate.getTime() + 4 * 60 * 60 * 1000);
      const now = new Date();

      // 5. Filtro Inteligente: Acontecendo Agora ou em 1h
      if (showLiveOnly) {
        const startsInLessOneHour = (eventDate.getTime() - now.getTime()) <= 3600000 && (eventDate.getTime() - now.getTime()) > 0;
        const isLive = now >= eventDate && now <= endDate;
        if (!isLive && !startsInLessOneHour) return false;
      }

      // 6. Filtro Inteligente: Na sua região (Raio fixo de 20km)
      if (showRegionOnly && userLocation && e.latitude && e.longitude) {
        const dist = calculateDistance(userLocation, { latitude: e.latitude, longitude: e.longitude });
        if (dist > 20) return false;
      }

      // 7. Filtro de Data Normal
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const today = startOfToday();
        if (dateFilter === 'today') {
          matchesDate = isSameDay(eventDate, today);
        } else if (dateFilter === 'tomorrow') {
          matchesDate = isSameDay(eventDate, addDays(today, 1));
        } else if (dateFilter === 'week') {
          const sunday = endOfWeek(today, { weekStartsOn: 0 });
          matchesDate = eventDate >= today && eventDate <= sunday;
        } else if (dateFilter === 'custom' && customDate) {
          matchesDate = isSameDay(eventDate, customDate);
        }
      }
      if (!matchesDate) return false;

      // 8. Filtro de Raio Geral (do seletor)
      let matchesRadius = true;
      if (userLocation && radiusKm !== 'unlimited' && e.latitude && e.longitude) {
        const dist = calculateDistance(userLocation, { latitude: e.latitude, longitude: e.longitude });
        matchesRadius = dist <= parseInt(radiusKm);
      }
      if (!matchesRadius) return false;

      return true;
    });

    const final = result.map(e => ({
      ...e,
      _score: calculateEventScore(e, {
        userLocation,
        maxRadiusKm: radiusKm === 'unlimited' ? 500 : parseInt(radiusKm)
      })
    })).sort((a, b) => b._score - a._score);

    console.log("[Debug] Filtragem concluída. Exibindo:", final.length, "eventos.");
    return final;
  }, [events, searchName, selectedCity, selectedCategory, radiusKm, userLocation, dateFilter, customDate, showLiveOnly, showRegionOnly])

  const interleavedContent = React.useMemo(() => {
    if (!filteredAndSortedEvents || filteredAndSortedEvents.length === 0) return []
    const now = new Date()
    
    const sponsoredPool = (activeAds || [])
      .map((ad: any) => {
        const parseDate = (val: any) => {
          if (!val) return null;
          if (val.toDate) return val.toDate();
          const d = new Date(val);
          return isNaN(d.getTime()) ? null : d;
        };

        const start = parseDate(ad.startDate);
        const end = parseDate(ad.endDate);
        const isDateValid = (!start || now >= start) && (!end || now <= end);
        const hasBudget = (ad.remainingBudget || 0) > 0;

        if (!isDateValid || !hasBudget) return null;

        if (ad.type === 'evento') {
          const fullEvent = events?.find((e: any) => e.id === ad.eventId);
          if (!fullEvent || fullEvent.status !== 'Ativo') return null;
          return { ...fullEvent, isSponsored: true, adId: ad.id, _isAdObject: false };
        }
        return { ...ad, isSponsored: true, adId: ad.id, _isAdObject: true };
      })
      .filter(Boolean);

    const organic = filteredAndSortedEvents.map(e => ({ ...e, isSponsored: false, _isAdObject: false }));
    const result = [];
    const sponsoredEventIds = new Set(sponsoredPool.filter(s => !s._isAdObject).map(s => s.id));
    const finalOrganic = organic.filter(e => !sponsoredEventIds.has(e.id));

    let organicIdx = 0;
    let adIdx = 0;

    while (organicIdx < finalOrganic.length || adIdx < sponsoredPool.length) {
      const interval = 4;
      const chunk = finalOrganic.slice(organicIdx, organicIdx + interval);
      result.push(...chunk);
      organicIdx += interval;

      if (adIdx < sponsoredPool.length) {
        result.push(sponsoredPool[adIdx]);
        adIdx++;
      }
    }

    return result;
  }, [filteredAndSortedEvents, activeAds, events])

  const uniqueCities = React.useMemo(() => {
    if (!events) return []
    const cities = events
      .filter((e: any) => e.city && e.status === 'Ativo')
      .map((e: any) => e.city)
    return Array.from(new Set(cities)).sort() as string[]
  }, [events])

  const siteName = settings?.siteName || "Viby"

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {settings?.logoUrl ? (
              <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-10 w-auto object-contain" priority unoptimized />
            ) : (
              <span className="text-xl font-bold tracking-tight italic uppercase">{siteName}</span>
            )}
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <UserNav />
            ) : (
              <>
                <Button variant="ghost" asChild className="font-bold uppercase text-[10px] tracking-widest">
                  <Link href="/login">Entrar</Link>
                </Button>
                <Button asChild className="bg-secondary text-white font-black uppercase italic text-[10px] tracking-widest rounded-full px-6 shadow-lg shadow-secondary/20">
                  <Link href="/cadastro">Criar Conta</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-primary text-white text-center">
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <Image 
            src={heroImage} 
            alt="Hero Background" 
            fill 
            className="object-cover" 
            priority
            unoptimized
            data-ai-hint="concert event"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/60 via-primary/40 to-primary" />
        </div>
        <div className="container mx-auto px-4 relative z-10 py-20">
          <div className="max-w-5xl mx-auto space-y-10 flex flex-col items-center">
            <Badge className="bg-secondary text-white border-none px-4 py-1.5 rounded-full font-black uppercase text-[10px] tracking-widest w-fit flex items-center gap-2 animate-bounce">
              <Zap className="w-3.5 h-3.5 fill-current" /> Descubra o que acontece agora
            </Badge>
            <h1 className="text-6xl md:text-9xl font-black uppercase italic tracking-tighter leading-[0.8]">
              VIVA O <span className="text-secondary">AGORA.</span>
            </h1>
            <p className="text-lg md:text-2xl font-medium opacity-80 max-w-2xl leading-relaxed">
              A maior vitrine de eventos inteligentes do Brasil. Perto de você, no seu tempo.
            </p>

            <Card className="bg-white/10 backdrop-blur-2xl border-white/10 rounded-[3rem] p-6 md:p-10 shadow-2xl mt-12 w-full text-left">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input 
                    placeholder="O que você quer viver?" 
                    className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white placeholder:text-white/30 focus-visible:ring-secondary/50"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("bg-white/5 border-white/10 h-14 w-full rounded-2xl text-white justify-start font-normal focus:ring-secondary/50 hover:bg-white/10", !customDate && dateFilter === 'all' && "text-white/60")}>
                        <CalendarIcon className="mr-2 h-4 w-4 text-secondary" />
                        {dateFilter === 'today' ? "Hoje" :
                         dateFilter === 'tomorrow' ? "Amanhã" :
                         dateFilter === 'week' ? "Esta semana" :
                         dateFilter === 'custom' && customDate ? format(customDate, "dd/MM/yy", { locale: ptBR }) :
                         "Quando?"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
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
                      <div className="p-2 border-t">
                           <Button variant="link" size="sm" className="w-full text-[10px] font-black uppercase text-muted-foreground" onClick={() => { setDateFilter('all'); setCustomDate(undefined); }}>Limpar Data</Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="md:col-span-2">
                  <Select value={selectedCity} onValueChange={setSelectedCity}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-14 rounded-2xl text-white focus:ring-secondary/50">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-secondary" />
                        <SelectValue placeholder="Cidade" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                      <SelectItem value="all">Todas as cidades</SelectItem>
                      {uniqueCities.map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Select value={radiusKm} onValueChange={setRadiusKm}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-14 rounded-2xl text-white focus:ring-secondary/50">
                      <div className="flex items-center gap-2">
                        <Navigation className="w-4 h-4 text-secondary" />
                        <SelectValue placeholder="Raio" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                      <SelectItem value="5">Até 5km</SelectItem>
                      <SelectItem value="10">Até 10km</SelectItem>
                      <SelectItem value="25">Até 25km</SelectItem>
                      <SelectItem value="50">Até 50km</SelectItem>
                      <SelectItem value="100">Até 100km</SelectItem>
                      <SelectItem value="unlimited">Ilimitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Button className="w-full h-14 bg-secondary text-white font-black uppercase italic rounded-2xl shadow-xl shadow-secondary/20 hover:scale-[1.02] transition-transform">
                    Explorar
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {categories && categories.length > 0 && (
        <section className="bg-white border-b border-border py-8 sticky top-16 z-40 shadow-sm">
          <div className="container mx-auto px-4 relative group">
            <div className="overflow-hidden" ref={emblaRef}>
              <div className="flex gap-4 justify-center">
                <div className="flex-[0_0_auto]">
                  <Button 
                    variant={selectedCategory === 'all' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className={cn("rounded-full font-black uppercase text-[10px] tracking-widest px-8 h-12 shrink-0", selectedCategory === 'all' && "shadow-lg shadow-secondary/20")}
                    onClick={() => setSelectedCategory('all')}
                  >
                    <Globe className="w-4 h-4 mr-2" /> Todos
                  </Button>
                </div>
                {categories.map((cat: any) => (
                  <div key={cat.id} className="flex-[0_0_auto]">
                    <Button 
                      variant={selectedCategory === cat.id ? 'secondary' : 'ghost'} 
                      size="sm" 
                      className={cn("rounded-full font-black uppercase text-[10px] tracking-widest px-8 h-12 shrink-0", selectedCategory === cat.id && "shadow-lg shadow-secondary/20")}
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      {cat.name}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="py-20 container mx-auto px-4 flex-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div className="space-y-2">
            <h2 className="text-5xl font-black uppercase italic tracking-tighter text-primary">
              {radiusKm === 'unlimited' ? 'Experiências Globais' : 'Perto de Você'}
            </h2>
            <p className="text-muted-foreground font-medium text-lg">Ordenados por relevância geográfica e temporal.</p>
          </div>
          
          <div className="flex items-center gap-4 bg-muted/50 p-2 rounded-2xl border border-dashed">
            <button 
              onClick={() => setShowLiveOnly(!showLiveOnly)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl transition-all",
                showLiveOnly ? "bg-white shadow-sm scale-105" : "opacity-40 hover:opacity-100"
              )}
            >
               <Clock className={cn("w-4 h-4", showLiveOnly ? "text-secondary" : "text-primary")} />
               <span className="text-[10px] font-black uppercase tracking-widest">
                 {showLiveOnly ? 'Acontecendo Agora' : 'Acontece em Breve'}
               </span>
            </button>

            <button 
              onClick={() => setShowRegionOnly(!showRegionOnly)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl transition-all",
                showRegionOnly ? "bg-white shadow-sm scale-105" : "opacity-40 hover:opacity-100"
              )}
            >
               <MapPin className={cn("w-4 h-4", showRegionOnly ? "text-secondary" : "text-primary")} />
               <span className="text-[10px] font-black uppercase tracking-widest">Na sua região</span>
            </button>
          </div>
        </div>

        {eventsLoading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-secondary" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Sincronizando experiências...</p>
          </div>
        ) : interleavedContent.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {interleavedContent.map((item: any, idx: number) => (
              item._isAdObject ? (
                <AdCard key={`ad-${item.adId}-${idx}`} ad={item} />
              ) : (
                <EventCard key={`ev-${item.id}-${idx}`} event={item} userLocation={userLocation} isSponsored={item.isSponsored} />
              )
            ))}
          </div>
        ) : (
          <div className="py-40 text-center bg-white rounded-[4rem] border-2 border-dashed border-border shadow-inner">
             <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                <Inbox className="w-10 h-10 text-muted-foreground opacity-20" />
             </div>
             <h3 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Nenhum evento localizado</h3>
             <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs mt-2">Tente expandir o raio de busca ou mudar os filtros.</p>
             <Button variant="link" className="mt-6 text-secondary font-black uppercase italic" onClick={() => { setSearchName(""); setSelectedCity("all"); setSelectedCategory("all"); setRadiusKm("50"); setDateFilter("all"); setCustomDate(undefined); setShowLiveOnly(false); setShowRegionOnly(false); }}>Limpar Todos os Filtros</Button>
          </div>
        )}
      </section>

      <Footer />
    </div>
  )
}
