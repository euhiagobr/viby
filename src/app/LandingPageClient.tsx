
"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, query, limit, doc, where, orderBy, getDocs, startAfter, DocumentSnapshot } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { AdsRenderer } from "@/components/ads/AdsRenderer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, MapPin, Navigation, Loader2, Zap, Globe, Calendar as CalendarIcon, Inbox, Tag, ChevronRight, AlertTriangle, Trophy } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { cn, normalizeText } from "@/lib/utils"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getCurrentLocation, type Coordinates } from "@/lib/location-utils"
import { isEventVisible, calculateDistanceMeters } from "@/lib/event-scoring-utils"
import Footer from "@/components/layout/Footer"
import Image from "next/image"
import { UserNav } from "@/components/layout/UserNav"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format, startOfToday, addDays, endOfWeek, isSameDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useTranslation } from "@/i18n/i18n-context"
import { useState, useEffect } from "react"

export default function LandingPageClient({ initialEvents = [] }: { initialEvents?: any[] }) {
  const { t } = useTranslation()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  const [hasMounted, setHasMounted] = React.useState(false)
  const [searchName, setSearchName] = React.useState("")
  const [searchCity, setSearchCity] = React.useState("")
  const [selectedCategory, setSelectedCategory] = React.useState("all")
  const [userLocation, setUserLocation] = React.useState<Coordinates | null>(null)
  const [radiusKm, setRadiusKm] = React.useState("30")
  
  const [dateFilter, setDateFilter] = React.useState<"all" | "today" | "tomorrow" | "week" | "custom">("all")
  const [customDate, setCustomDate] = React.useState<Date | undefined>(undefined)

  const [rawEvents, setRawEvents] = useState<any[]>(initialEvents)
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(initialEvents.length === 0)

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)

  const fetchEvents = React.useCallback(async (isInitial = false) => {
    if (!db || isFetching || (!isInitial && !hasMore)) return
    
    setIsFetching(true)
    try {
      const q = query(
        collection(db, "events"),
        where("status", "==", "Ativo"),
        orderBy("date", "asc"),
        ...(isInitial ? [limit(9)] : [startAfter(lastVisible), limit(3)])
      )
      
      const snapshot = await getDocs(q)
      const fetchedDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      
      if (isInitial) {
        setRawEvents(fetchedDocs)
      } else {
        setRawEvents(prev => [...prev, ...fetchedDocs])
      }
      
      setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null)
      setHasMore(snapshot.docs.length === (isInitial ? 9 : 3))
    } catch (e) {
      console.error("[Landing Pagination Error]", e)
    } finally {
      setIsFetching(false)
      setIsInitialLoad(false)
    }
  }, [db, lastVisible, isFetching, hasMore])

  useEffect(() => {
    setHasMounted(true);
    if (initialEvents.length === 0) {
      fetchEvents(true);
    }
    getCurrentLocation().then(loc => { if (loc) setUserLocation(loc); }).catch(() => {})
  }, [db, initialEvents.length, fetchEvents])

  const processedEvents = React.useMemo(() => {
    const now = new Date();
    const baseFiltered = rawEvents.filter(e => {
      if (!isEventVisible(e)) return false;
      const nameNorm = normalizeText(searchName);
      if (searchName && !normalizeText(e.title || "").includes(nameNorm)) return false;
      if (searchCity && !normalizeText(`${e.city || ""} ${e.state || ""}`).includes(normalizeText(searchCity))) return false;
      if (selectedCategory !== 'all' && e.categoryId !== selectedCategory) return false;
      return true;
    }).map(e => {
      let distMeters = Infinity;
      if (userLocation && e.latitude && e.longitude) {
        distMeters = calculateDistanceMeters(userLocation, { latitude: e.latitude, longitude: e.longitude });
      }
      return { ...e, _distanceMeters: distMeters, _startDateTime: e.date?.toDate ? e.date.toDate() : new Date(e.date) };
    });

    baseFiltered.sort((a, b) => a._startDateTime.getTime() - b._startDateTime.getTime());
    return { events: baseFiltered, isFallback: false };
  }, [rawEvents, searchName, searchCity, selectedCategory, userLocation])

  const siteName = settings?.siteName || "Viby"

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            {settings?.logoUrl ? (
              <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-10 w-auto object-contain transition-transform group-hover:scale-105" priority unoptimized />
            ) : (
              <span className="text-xl font-black italic uppercase text-primary ml-1">{siteName}</span>
            )}
          </Link>
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" className="hidden md:flex rounded-full h-9 border-[#ffdf00] bg-[#ffdf00]/10 text-[#002776] font-black uppercase text-[9px] gap-2">
               <Link href="/copa-do-mundo"><Trophy className="w-3.5 h-3.5" /> Copa 2026</Link>
            </Button>
            {user ? <UserNav /> : (
              <>
                <Button variant="ghost" asChild className="font-bold uppercase text-[10px] tracking-widest">
                  <Link href="/login">{t('home.login')}</Link>
                </Button>
                <Button asChild className="bg-secondary text-white font-black uppercase italic text-[10px] tracking-widest rounded-full px-6 shadow-lg">
                  <Link href="/cadastro">{t('home.signup')}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-primary text-white text-center">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/60 via-primary/40 to-primary" />
        </div>
        <div className="container mx-auto px-4 relative z-10 py-20">
          <div className="max-w-5xl mx-auto space-y-10 flex flex-col items-center">
            <Link href="/copa-do-mundo">
              <Badge className="bg-[#ffdf00] text-[#002776] border-none px-4 py-1.5 rounded-full font-black uppercase text-[10px] tracking-widest w-fit flex items-center gap-2 animate-pulse cursor-pointer">
                <Trophy className="w-3.5 h-3.5 fill-current" /> Onde assistir à Copa do Mundo 2026
              </Badge>
            </Link>
            <h1 className="text-6xl md:text-9xl font-black uppercase italic tracking-tighter leading-[0.8]">
              {t('home.hero_title_1')} <span className="text-secondary">{t('home.hero_title_2')}</span>
            </h1>
            <p className="text-lg md:text-2xl font-medium opacity-80 max-w-2xl leading-relaxed">
              {t('home.hero_subtitle')}
            </p>

            <Card className="bg-white/10 backdrop-blur-2xl border-white/10 rounded-[3rem] p-6 md:p-8 shadow-2xl mt-12 w-full text-left">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-4 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input 
                    placeholder={t('home.search_placeholder')} 
                    className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white placeholder:text-white/30"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                  />
                </div>
                <div className="md:col-span-4 relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                  <Input 
                    placeholder={t('home.where_placeholder')} 
                    className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white placeholder:text-white/30"
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                  />
                </div>
                <div className="md:col-span-4">
                   <Button onClick={() => window.scrollTo({top: 800, behavior:'smooth'})} className="w-full h-14 bg-secondary text-white font-black uppercase italic rounded-2xl shadow-xl">
                      Explorar Agora
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
            <h2 className="text-5xl font-black uppercase italic tracking-tighter text-primary">{t('home.upcoming_title')}</h2>
            <p className="text-muted-foreground font-medium text-lg">{t('home.upcoming_subtitle')}</p>
          </div>
        </div>

        {isInitialLoad ? (
          <div className="py-32 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-secondary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {processedEvents.events.map((event, idx) => (
              <EventCard key={event.id} event={event} userLocation={userLocation} />
            ))}
          </div>
        )}
      </section>
      <Footer />
    </div>
  )
}
