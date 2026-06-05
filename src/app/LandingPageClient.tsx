"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, query, limit, doc, where } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { AdsRenderer } from "@/components/ads/AdsRenderer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, MapPin, FilterX, Navigation, Loader2, Clock, Zap, Globe, Calendar as CalendarIcon, Inbox } from "lucide-react"
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

  const [hasMounted, setHasMounted] = React.useState(false)
  const [searchName, setSearchName] = React.useState("")
  const [selectedCity, setSelectedCity] = React.useState("all")
  const [selectedCategory, setSelectedCategory] = React.useState("all")
  const [radiusKm, setRadiusKm] = React.useState("unlimited")
  const [userLocation, setUserLocation] = React.useState<Coordinates | null>(null)
  
  const [dateFilter, setDateFilter] = React.useState<"all" | "today" | "tomorrow" | "week" | "custom">("all")
  const [customDate, setCustomDate] = React.useState<Date | undefined>(undefined)

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)

  const eventsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "events"), where("status", "==", "Ativo"), limit(100))
  }, [db])

  const { data: events, loading: eventsLoading } = useCollection<any>(eventsQuery)

  const uniqueCities = React.useMemo(() => {
    if (!events) return []
    const cities = events.filter((e: any) => e.city && e.status === 'Ativo').map((e: any) => e.city)
    return Array.from(new Set(cities)).sort() as string[]
  }, [events])

  const filteredAndSortedEvents = React.useMemo(() => {
    if (!events) return []

    let result = events.filter(e => {
      if (!isEventVisible(e)) return false;

      if (searchName && !e.title?.toLowerCase().includes(searchName.toLowerCase())) return false;
      if (selectedCity !== 'all' && e.city !== selectedCity) return false;
      if (selectedCategory !== 'all' && e.categoryId !== selectedCategory) return false;
      
      const parseDate = (val: any) => {
        if (!val) return null;
        if (val.toDate) return val.toDate();
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      };

      const eventDate = parseDate(e.date);
      if (!eventDate) return false;

      let matchesDate = true;
      if (dateFilter !== 'all') {
        const today = startOfToday();
        if (dateFilter === 'today') matchesDate = isSameDay(eventDate, today);
        else if (dateFilter === 'tomorrow') matchesDate = isSameDay(eventDate, addDays(today, 1));
        else if (dateFilter === 'week') matchesDate = eventDate >= today && eventDate <= endOfWeek(today);
        else if (dateFilter === 'custom' && customDate) matchesDate = isSameDay(eventDate, customDate);
      }
      if (!matchesDate) return false;

      if (userLocation && radiusKm !== 'unlimited' && e.latitude && e.longitude) {
        const dist = calculateDistance(userLocation, { latitude: e.latitude, longitude: e.longitude });
        if (dist > parseInt(radiusKm)) return false;
      }

      return true;
    });

    return result.map(e => ({
      ...e,
      _score: calculateEventScore(e, {
        userLocation,
        maxRadiusKm: radiusKm === 'unlimited' ? 500 : parseInt(radiusKm)
      })
    })).sort((a, b) => b._score - a._score);
  }, [events, searchName, selectedCity, selectedCategory, radiusKm, userLocation, dateFilter, customDate])

  const unifiedFeed = React.useMemo(() => {
    const result = [];
    let eventCounter = 0;
    let adIndex = 0;

    if (!filteredAndSortedEvents || filteredAndSortedEvents.length === 0) {
      if (!eventsLoading) {
        // Fallback para feed vazio conforme requisito de monetização
        result.push({ type: "ad", adIndex: adIndex++ });
        result.push({ type: "ad", adIndex: adIndex++ });
        result.push({ type: "ad", adIndex: adIndex++ });
      }
      return result;
    }

    for (let i = 0; i < filteredAndSortedEvents.length; i++) {
      result.push({ type: "event", data: filteredAndSortedEvents[i] });
      eventCounter++;

      if (eventCounter === 6) {
        result.push({ type: "ad", adIndex: adIndex++ });
        eventCounter = 0;
      }
    }

    return result;
  }, [filteredAndSortedEvents, eventsLoading])

  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-bg')?.imageUrl || "https://picsum.photos/seed/vibyhero-event/1920/1080"

  React.useEffect(() => {
    setHasMounted(true);
    getCurrentLocation()
      .then(loc => { if (loc) setUserLocation(loc); })
      .catch(() => {})
  }, [])

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
            {user ? <UserNav /> : (
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
          <Image src={heroImage} alt="Hero Background" fill className="object-cover" priority unoptimized data-ai-hint="concert event" />
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
                    className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white placeholder:text-white/30"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                  />
                </div>
                
                {hasMounted && (
                  <>
                    <div className="md:col-span-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("bg-white/5 border-white/10 h-14 w-full rounded-2xl text-white justify-start font-normal", !customDate && dateFilter === 'all' && "text-white/60")}>
                            <CalendarIcon className="mr-2 h-4 w-4 text-secondary" />
                            {dateFilter === 'today' ? "Hoje" : dateFilter === 'tomorrow' ? "Amanhã" : dateFilter === 'week' ? "Semana" : customDate ? format(customDate, "dd/MM") : "Quando?"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
                          <div className="p-3 border-b grid grid-cols-3 gap-2">
                              <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase" onClick={() => { setDateFilter('today'); setCustomDate(undefined); }}>Hoje</Button>
                              <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase" onClick={() => { setDateFilter('tomorrow'); setCustomDate(undefined); }}>Amanhã</Button>
                              <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase" onClick={() => { setDateFilter('week'); setCustomDate(undefined); }}>Semana</Button>
                          </div>
                          <Calendar mode="single" selected={customDate} onSelect={(d) => { if(d) { setCustomDate(d); setDateFilter('custom'); } }} locale={ptBR} />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="md:col-span-2">
                      <Select value={selectedCity} onValueChange={setSelectedCity}>
                        <SelectTrigger className="bg-white/5 border-white/10 h-14 rounded-2xl text-white">
                            <MapPin className="w-4 h-4 text-secondary mr-2" />
                            <SelectValue placeholder="Cidade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as cidades</SelectItem>
                          {uniqueCities.map(city => <SelectItem key={city} value={city}>{city}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Select value={radiusKm} onValueChange={setRadiusKm}>
                        <SelectTrigger className="bg-white/5 border-white/10 h-14 rounded-2xl text-white">
                            <Navigation className="w-4 h-4 text-secondary mr-2" />
                            <SelectValue placeholder="Raio" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">Até 10km</SelectItem>
                          <SelectItem value="50">Até 50km</SelectItem>
                          <SelectItem value="100">Até 100km</SelectItem>
                          <SelectItem value="unlimited">Ilimitado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <Button className="w-full h-14 bg-secondary text-white font-black uppercase italic rounded-2xl shadow-xl">
                    Explorar
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 container mx-auto px-4 flex-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div className="space-y-2">
            <h2 className="text-5xl font-black uppercase italic tracking-tighter text-primary">Próximas Experiências</h2>
            <p className="text-muted-foreground font-medium text-lg">Perto de você, no seu tempo.</p>
          </div>
        </div>

        {eventsLoading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-secondary" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sincronizando experiências...</p>
          </div>
        ) : (
          <>
            {unifiedFeed.length === 0 && !eventsLoading && (
              <div className="py-20 text-center bg-white rounded-[4rem] border-2 border-dashed border-border shadow-inner mb-20">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                    <Inbox className="w-10 h-10 text-muted-foreground opacity-20" />
                </div>
                <h3 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Nenhum evento localizado</h3>
                <Button variant="link" className="mt-6 text-secondary font-black uppercase italic" onClick={() => { setSearchName(""); setSelectedCity("all"); setSelectedCategory("all"); setRadiusKm("unlimited"); setDateFilter("all"); }}>Limpar Todos os Filtros</Button>
              </div>
            )}

            {unifiedFeed.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                {unifiedFeed.map((item: any, idx: number) => (
                  item.type === 'ad' ? (
                    <AdsRenderer 
                      key={`ad-slot-${item.adIndex}-${idx}`} 
                      location="feed" 
                      index={item.adIndex} 
                      googleSlotId="home-feed-slot" 
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
          </>
        )}
      </section>
      <Footer />
    </div>
  )
}
