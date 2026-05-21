
"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, query, limit, orderBy, doc, where } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { AdCard } from "@/components/ads/AdCard"
import { Button } from "@/components/ui/button"
import { Globe, Search, ArrowRight, Loader2, MapPin, Tag, FilterX, Navigation } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import Link from "next/link"
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

export default function LandingPage() {
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
    return query(collection(db, "events"), orderBy("createdAt", "desc"), limit(100))
  }, [db])

  const { data: events, loading: eventsLoading } = useCollection<any>(eventsQuery)

  const categoriesQuery = useMemoFirebase(() => db ? collection(db, "categories") : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  // Consulta de Anúncios Ativos
  const adsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "ads"), where("status", "==", "Ativo"))
  }, [db])
  const { data: activeAds } = useCollection<any>(adsQuery)

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
      .filter((e: any) => e.city && e.status !== 'Excluído')
      .map((e: any) => e.city)
    return Array.from(new Set(cities)).sort() as string[]
  }, [events])

  const filteredEvents = React.useMemo(() => {
    if (!events) return []
    
    let result = events.filter((e: any) => {
      const isNotDeleted = e.status !== 'Excluído';
      const matchesSearch = !searchName || 
                          e.title?.toLowerCase().includes(searchName.toLowerCase()) ||
                          e.description?.toLowerCase().includes(searchName.toLowerCase());
      const matchesCity = selectedCity === 'all' || e.city === selectedCity;
      const matchesCategory = selectedCategory === 'all' || e.categoryId === selectedCategory;
      
      return isNotDeleted && matchesSearch && matchesCity && matchesCategory;
    })

    if (userLocation) {
      result = result.map((e: any) => ({
        ...e,
        _distance: e.latitude && e.longitude 
          ? calculateDistance(userLocation, { latitude: e.latitude, longitude: e.longitude })
          : Infinity
      }))
    }

    if (sortBy === 'distance' && userLocation) {
      result.sort((a, b) => (a._distance || 0) - (b._distance || 0))
    } else {
      result.sort((a, b) => {
        const dateA = a.date?.seconds || new Date(a.date).getTime() / 1000 || 0
        const dateB = b.date?.seconds || new Date(b.date).getTime() / 1000 || 0
        return dateA - dateB
      })
    }

    return result;
  }, [events, searchName, selectedCity, selectedCategory, sortBy, userLocation])

  const interleavedContent = React.useMemo(() => {
    if (!filteredEvents || filteredEvents.length === 0) return []
    
    const now = new Date()

    const parseAdDate = (val: any) => {
      if (!val) return null;
      if (val.toDate) return val.toDate();
      return new Date(val);
    };

    // 1. Pool de anúncios ativos, filtrados por data/hora e orçamento, ordenados por saldo
    const sponsoredPool = (activeAds || [])
      .map((ad: any) => {
        const start = parseAdDate(ad.startDate);
        const end = parseAdDate(ad.endDate);
        const isDateValid = (!start || now >= start) && (!end || now <= end)
        const hasBudget = (ad.remainingBudget || 0) > 0

        if (!isDateValid || !hasBudget) return null

        if (ad.type === 'evento') {
          const fullEvent = events?.find((e: any) => e.id === ad.eventId)
          return fullEvent ? { ...fullEvent, isSponsored: true, adId: ad.id, _remainingBudget: ad.remainingBudget, _isAdObject: false } : null
        }

        return { ...ad, isSponsored: true, _remainingBudget: ad.remainingBudget, _isAdObject: true }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (b._remainingBudget || 0) - (a._remainingBudget || 0))

    const organic = filteredEvents.map(e => ({ ...e, isSponsored: false, _isAdObject: false }))

    if (sponsoredPool.length === 0) return organic

    const result = []
    const sponsoredEventIds = new Set(sponsoredPool.filter(s => !s._isAdObject).map(s => s.id));
    const filteredOrganic = organic.filter(e => !sponsoredEventIds.has(e.id));

    let organicIdx = 0
    let adIdx = 0

    while (organicIdx < filteredOrganic.length || adIdx < sponsoredPool.length) {
      const interval = Math.floor(Math.random() * 4) + 4
      const chunk = filteredOrganic.slice(organicIdx, organicIdx + interval)
      result.push(...chunk)
      organicIdx += interval

      if (adIdx < sponsoredPool.length) {
        result.push(sponsoredPool[adIdx])
        adIdx++
      } else if (sponsoredPool.length > 0 && organicIdx < filteredOrganic.length) {
        // Repete anúncios favorecendo os de maior orçamento
        const topWeightedIdx = Math.floor(Math.random() * Math.ceil(sponsoredPool.length / 2))
        result.push(sponsoredPool[topWeightedIdx])
      }
    }

    return result
  }, [filteredEvents, activeAds, events])

  const siteName = settings?.siteName || "Viby"

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {settings?.logoUrl ? (
              <div className="w-10 h-10 relative flex items-center justify-center">
                <img src={settings.logoUrl} alt={siteName} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">{siteName.charAt(0)}</span>
              </div>
            )}
            <span className="text-xl font-bold tracking-tight">{siteName}</span>
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <Button asChild variant="ghost" className="font-semibold">
                <Link href="/dashboard">Meu Painel</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="font-semibold">
                  <Link href="/login">Entrar</Link>
                </Button>
                <Button asChild className="bg-secondary text-white hover:bg-secondary/90 font-bold px-6 rounded-full shadow-lg shadow-secondary/20 transition-all active:scale-95">
                  <Link href="/cadastro">Cadastrar-se</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="relative py-24 overflow-hidden">
        <div className="container mx-auto px-4 relative z-10 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm font-black uppercase tracking-widest">
            {settings?.iconUrl ? (
               <img src={settings.iconUrl} className="w-5 h-5 object-contain" alt="Site Icon" />
            ) : (
               <Globe className="w-4 h-4" />
            )}
            <span>A maior vitrine de eventos do Brasil</span>
          </div>
          <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-foreground max-w-4xl mx-auto leading-[0.9] italic uppercase">
            Viva <span className="text-secondary">Experiências</span> Memoráveis.
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed">
            A plataforma inteligente para descobrir, garantir e viver os melhores momentos da sua cidade.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button asChild size="lg" className="bg-primary text-white hover:bg-primary/90 rounded-2xl px-10 h-16 font-black text-lg uppercase italic shadow-2xl group transition-all">
              <Link href="/dashboard">
                Começar agora
                <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[700px] bg-secondary/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      </section>

      <section className="container mx-auto px-4 -mt-10 relative z-20">
        <Card className="border-none shadow-2xl rounded-[2.5rem] p-4 bg-white/80 backdrop-blur-xl border border-white">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input 
                placeholder="Qual evento você procura?" 
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="h-16 pl-12 rounded-2xl border-none bg-muted/30 focus-visible:ring-secondary font-bold"
              />
            </div>
            <div className="md:col-span-3">
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="h-16 rounded-2xl border-none bg-muted/30 focus:ring-secondary font-bold">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-secondary" />
                    <SelectValue placeholder="Toda as cidades" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  <SelectItem value="all" className="font-bold">Todas as cidades</SelectItem>
                  {uniqueCities.map(city => (
                    <SelectItem key={city} value={city} className="font-bold">{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-16 rounded-2xl border-none bg-muted/30 focus:ring-secondary font-bold">
                  <div className="flex items-center gap-3">
                    <Tag className="w-5 h-5 text-secondary" />
                    <SelectValue placeholder="Categorias" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  <SelectItem value="all" className="font-bold">Todas categorias</SelectItem>
                  {categories?.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Button 
                onClick={() => { setSearchName(""); setSelectedCity("all"); setSelectedCategory("all"); }}
                variant="ghost" 
                className="w-full h-16 rounded-2xl font-black uppercase text-[10px] tracking-widest text-muted-foreground hover:text-secondary hover:bg-secondary/5 transition-all"
              >
                <FilterX className="w-4 h-4 mr-2" /> Limpar
              </Button>
            </div>
          </div>
        </Card>
      </section>

      <section className="py-24 container mx-auto px-4 flex-1">
        <div className="mb-12">
            <h2 className="text-4xl font-black tracking-tighter uppercase italic text-primary">
              Resultados <span className="text-secondary">Encontrados</span>
            </h2>
        </div>

        {eventsLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-secondary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {interleavedContent.map((item: any, idx: number) => (
              item._isAdObject ? (
                <AdCard key={`${item.id}-${idx}`} ad={item} />
              ) : (
                <EventCard 
                  key={`${item.id}-${idx}`} 
                  event={item} 
                  userLocation={userLocation} 
                  isSponsored={item.isSponsored}
                />
              )
            ))}
          </div>
        )}
      </section>
      <Footer />
    </div>
  )
}
