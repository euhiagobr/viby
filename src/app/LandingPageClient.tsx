"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, query, limit, doc, where } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { AdCard } from "@/components/ads/AdCard"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, MapPin, FilterX, Settings, Navigation, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
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
import Footer from "@/components/layout/Footer"
import { cn } from "@/lib/utils"
import useEmblaCarousel from 'embla-carousel-react'
import { PlaceHolderImages } from "@/lib/placeholder-images"

export default function LandingPageClient() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  const [searchName, setSearchName] = React.useState("")
  const [selectedCity, setSelectedCity] = React.useState("all")
  const [selectedCategory, setSelectedCategory] = React.useState("all")
  const [sortBy, setSortBy] = React.useState<'date' | 'distance'>('date')
  const [userLocation, setUserLocation] = React.useState<Coordinates | null>(null)

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)

  const eventsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "events"), where("status", "==", "Ativo"), limit(100))
  }, [db])

  const { data: events, loading: eventsLoading } = useCollection<any>(eventsQuery)

  const categoriesQuery = useMemoFirebase(() => db ? collection(db, "categories") : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const adsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "ads"), where("status", "==", "Ativo"))
  }, [db])
  const { data: activeAds } = useCollection<any>(adsQuery)

  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true, 
    align: 'start',
    slidesToScroll: 1
  })

  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-bg')?.imageUrl || "https://picsum.photos/seed/vibyhero-event/1920/1080"

  React.useEffect(() => {
    const fetchLocation = async () => {
      try {
        const loc = await getCurrentLocation()
        setUserLocation(loc)
      } catch (err) {}
    }
    fetchLocation()
  }, [])

  const uniqueCities = React.useMemo(() => {
    if (!events) return []
    const cities = events
      .filter((e: any) => e.city && e.status === 'Ativo')
      .map((e: any) => e.city)
    return Array.from(new Set(cities)).sort() as string[]
  }, [events])

  const filteredEvents = React.useMemo(() => {
    if (!events) return []
    const now = new Date()

    let result = events.filter((e: any) => {
      const matchesSearch = e.title?.toLowerCase().includes(searchName.toLowerCase())
      const matchesCity = selectedCity === 'all' || e.city === selectedCity
      const matchesCategory = selectedCategory === 'all' || e.categoryId === selectedCategory
      
      const start = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      const end = e.endDate?.toDate ? e.endDate.toDate() : (e.endDate ? new Date(e.endDate) : new Date(start.getTime() + 4 * 60 * 60 * 1000));
      const isNotEnded = end >= now;

      return matchesSearch && matchesCity && matchesCategory && isNotEnded
    })

    if (sortBy === 'distance' && userLocation) {
      result = result.map(e => ({
        ...e,
        _dist: e.latitude && e.longitude ? calculateDistance(userLocation, { latitude: e.latitude, longitude: e.longitude }) : Infinity
      })).sort((a, b) => a._dist - b._dist)
    } else {
      result.sort((a, b) => {
        const tA = a.date?.seconds || new Date(a.date).getTime()
        const tB = b.date?.seconds || new Date(b.date).getTime()
        return tA - tB
      })
    }

    return result
  }, [events, searchName, selectedCity, selectedCategory, sortBy, userLocation])

  const interleavedContent = React.useMemo(() => {
    if (filteredEvents.length === 0) return []
    const now = new Date()
    
    // Filtrar e preparar Ads ativos
    const sponsoredPool = (activeAds || [])
      .map((ad: any) => {
        const start = ad.startDate?.toDate ? ad.startDate.toDate() : new Date(ad.startDate);
        const end = ad.endDate?.toDate ? ad.endDate.toDate() : new Date(ad.endDate);
        const isDateValid = (!start || now >= start) && (!end || now <= end);
        const hasBudget = (ad.remainingBudget || 0) > 0;

        if (!isDateValid || !hasBudget) return null;

        if (ad.type === 'evento') {
          const fullEvent = events?.find((e: any) => e.id === ad.eventId);
          if (!fullEvent || fullEvent.status !== 'Ativo') return null;
          return { ...fullEvent, isSponsored: true, adId: ad.id, _remainingBudget: ad.remainingBudget, _isAdObject: false };
        }
        return { ...ad, isSponsored: true, adId: ad.id, _remainingBudget: ad.remainingBudget, _isAdObject: true };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (b._remainingBudget || 0) - (a._remainingBudget || 0));

    const organic = filteredEvents.map(e => ({ ...e, isSponsored: false, _isAdObject: false }));
    const result = [];
    const sponsoredEventIds = new Set(sponsoredPool.filter(s => !s._isAdObject).map(s => s.id));
    const filteredOrganic = organic.filter(e => !sponsoredEventIds.has(e.id));

    let organicIdx = 0;
    let adIdx = 0;

    while (organicIdx < filteredOrganic.length || adIdx < sponsoredPool.length) {
      const interval = 4;
      const chunk = filteredOrganic.slice(organicIdx, organicIdx + interval);
      result.push(...chunk);
      organicIdx += interval;

      if (adIdx < sponsoredPool.length) {
        result.push(sponsoredPool[adIdx]);
        adIdx++;
      }
    }

    return result;
  }, [filteredEvents, activeAds, events])

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
            <Button variant="ghost" asChild className="font-bold uppercase text-[10px] tracking-widest hidden sm:flex">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild className="bg-secondary text-white font-black uppercase italic text-[10px] tracking-widest rounded-full px-6 shadow-lg shadow-secondary/20">
              <Link href="/cadastro">Criar Conta</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Centralized */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-primary text-white text-center">
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
          <div className="max-w-4xl mx-auto space-y-8 flex flex-col items-center">
            <Badge className="bg-secondary text-white border-none px-4 py-1.5 rounded-full font-black uppercase text-[10px] tracking-widest w-fit flex items-center gap-2">
              {settings?.iconUrl ? (
                <img src={settings.iconUrl} alt="" className="w-3 h-3 object-contain" />
              ) : (
                <Settings className="w-3 h-3" />
              )} 
              Descubra sua próxima experiência
            </Badge>
            <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter leading-[0.85]">
              VIVA O <span className="text-secondary">AGORA.</span>
            </h1>
            <p className="text-lg md:text-xl font-medium opacity-80 max-w-2xl leading-relaxed">
              A maior vitrine de eventos do Brasil. Shows, festivais, gastronomia e cultura a um clique de distância.
            </p>

            <Card className="bg-white/10 backdrop-blur-xl border-white/10 rounded-[2.5rem] p-4 md:p-8 shadow-2xl mt-12 w-full text-left">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-5 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input 
                    placeholder="O que você está procurando?" 
                    className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white placeholder:text-white/30 focus-visible:ring-secondary/50"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                  />
                </div>
                <div className="md:col-span-4">
                  <Select value={selectedCity} onValueChange={setSelectedCity}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-14 rounded-2xl text-white focus:ring-secondary/50">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-secondary" />
                        <SelectValue placeholder="Sua cidade" />
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
                <div className="md:col-span-3">
                  <Button className="w-full h-14 bg-secondary text-white font-black uppercase italic rounded-2xl shadow-xl shadow-secondary/20 hover:scale-[1.02] transition-transform">
                    Explorar
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Category Filter - Infinite Carousel */}
      <section className="bg-white border-b border-border py-6 sticky top-16 z-40 shadow-sm overflow-hidden">
        <div className="container mx-auto px-4 relative group">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-4">
              <div className="flex-[0_0_auto]">
                <Button 
                  variant={selectedCategory === 'all' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className={cn("rounded-full font-black uppercase text-[10px] tracking-widest px-6 h-10 shrink-0", selectedCategory === 'all' && "shadow-lg shadow-secondary/20")}
                  onClick={() => setSelectedCategory('all')}
                >
                  Todos
                </Button>
              </div>
              {categories?.map((cat: any) => (
                <div key={cat.id} className="flex-[0_0_auto]">
                  <Button 
                    variant={selectedCategory === cat.id ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className={cn("rounded-full font-black uppercase text-[10px] tracking-widest px-6 h-10 shrink-0", selectedCategory === cat.id && "shadow-lg shadow-secondary/20")}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.name}
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1 bg-gradient-to-l from-white via-white to-transparent pl-12 h-full items-center pointer-events-none group-hover:pointer-events-auto">
             <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white shadow-md border" onClick={() => emblaApi?.scrollPrev()}><ChevronLeft className="w-4 h-4" /></Button>
             <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white shadow-md border" onClick={() => emblaApi?.scrollNext()}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-16 container mx-auto px-4 flex-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-1">
            <h2 className="text-4xl font-black uppercase italic tracking-tighter text-primary">Explorar</h2>
            <p className="text-muted-foreground font-medium">As melhores experiências selecionadas para você.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-40 mr-2">Ordenar por:</span>
            <Button 
              variant={sortBy === 'date' ? 'secondary' : 'outline'} 
              size="sm" 
              onClick={() => setSortBy('date')}
              className="rounded-full h-9 px-4 font-bold text-[10px] uppercase"
            >
              Data
            </Button>
            <Button 
              variant={sortBy === 'distance' ? 'secondary' : 'outline'} 
              size="sm" 
              onClick={() => setSortBy('distance')}
              disabled={!userLocation}
              className="rounded-full h-9 px-4 font-bold text-[10px] uppercase gap-1.5"
            >
              <Navigation className="w-3 h-3" /> Proximidade
            </Button>
          </div>
        </div>

        {eventsLoading ? (
          <div className="py-32 flex justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-secondary" />
          </div>
        ) : interleavedContent.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {interleavedContent.map((item: any, idx: number) => (
              item._isAdObject ? (
                <AdCard key={`ad-${item.adId}-${idx}`} ad={item} />
              ) : (
                <EventCard key={`ev-${item.id}-${idx}`} event={item} userLocation={userLocation} isSponsored={item.isSponsored} />
              )
            ))}
          </div>
        ) : (
          <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-border shadow-inner">
             <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FilterX className="w-8 h-8 text-muted-foreground opacity-20" />
             </div>
             <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Nenhum evento ativo encontrado para os filtros selecionados.</p>
             <Button variant="link" className="mt-2 text-secondary font-bold" onClick={() => { setSearchName(""); setSelectedCity("all"); setSelectedCategory("all"); }}>Limpar Filtros</Button>
          </div>
        )}
      </section>

      <Footer />
    </div>
  )
}
