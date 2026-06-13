
"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, query, limit, doc, where, orderBy, getDocs, startAfter, DocumentSnapshot } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, MapPin, Loader2, Inbox, Trophy } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { normalizeText } from "@/lib/utils"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"
import { getCurrentLocation, type Coordinates } from "@/lib/location-utils"
import { isEventVisible, calculateDistanceMeters } from "@/lib/event-scoring-utils"
import Footer from "@/components/layout/Footer"
import Image from "next/image"
import { UserNav } from "@/components/layout/UserNav"
import { format, startOfToday, addDays } from "date-fns"
import { useTranslation } from "@/i18n/i18n-context"
import { useState, useEffect, useCallback } from "react"

export default function LandingPageClient({ initialEvents = [] }: { initialEvents?: any[] }) {
  const { t } = useTranslation()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  const [searchName, setSearchName] = React.useState("")
  const [searchCity, setSearchCity] = React.useState("")
  const [userLocation, setUserLocation] = React.useState<Coordinates | null>(null)
  
  const [rawEvents, setRawEvents] = useState<any[]>(initialEvents)
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = useState(initialEvents.length >= 12)
  const [isFetching, setIsFetching] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(initialEvents.length === 0)

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)

  // Ocorrências para eventos recorrentes
  const occurrencesQuery = useMemoFirebase(() => {
    if (!db) return null
    const yesterdayStr = format(addDays(startOfToday(), -1), 'yyyy-MM-dd')
    return query(collection(db, "recurring_occurrences"), where("status", "==", "active"), where("date", ">=", yesterdayStr))
  }, [db])
  const { data: allOccurrences } = useCollection<any>(occurrencesQuery)

  const fetchEvents = useCallback(async (isInitial = false) => {
    if (!db || isFetching || (!isInitial && !hasMore)) return
    
    setIsFetching(true)
    try {
      const q = query(
        collection(db, "events"),
        where("status", "==", "Ativo"),
        orderBy("date", "asc"),
        ...(isInitial ? [limit(12)] : [startAfter(lastVisible), limit(6)])
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
      setHasMore(snapshot.docs.length >= (isInitial ? 12 : 6))
    } catch (e) {
      console.error("[Landing Pagination Error]", e)
    } finally {
      setIsFetching(false)
      setIsInitialLoad(false)
    }
  }, [db, lastVisible, isFetching, hasMore])

  useEffect(() => {
    if (initialEvents.length === 0) {
      fetchEvents(true);
    } else {
      setIsInitialLoad(false);
    }
    getCurrentLocation().then(loc => { if (loc) setUserLocation(loc); }).catch(() => {})
  }, [initialEvents.length, fetchEvents])

  const processedEvents = React.useMemo(() => {
    const now = new Date();
    
    const baseFiltered = rawEvents.map(e => {
      let effectiveDate = e.date;
      if (e.isRecurring && allOccurrences) {
        const myOccs = allOccurrences.filter((o: any) => o.parentId === e.id) || [];
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
      // Visibilidade básica
      if (e.isRecurring && (!allOccurrences || allOccurrences.length === 0)) return true;
      if (!isEventVisible(e)) return false;
      
      // Filtros de busca
      const nameNorm = normalizeText(searchName);
      if (searchName && !normalizeText(e.title || "").includes(nameNorm)) return false;
      
      const cityNorm = normalizeText(searchCity);
      if (searchCity && !normalizeText(`${e.city || ""} ${e.state || ""}`).includes(cityNorm)) return false;
      
      return true;
    }).map(e => {
      let distMeters = Infinity;
      if (userLocation && e.latitude && e.longitude) {
        distMeters = calculateDistanceMeters(userLocation, { latitude: e.latitude, longitude: e.longitude });
      }
      const startDateTime = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      return { ...e, _distanceMeters: distMeters, _startDateTime: isNaN(startDateTime.getTime()) ? new Date() : startDateTime };
    });

    baseFiltered.sort((a, b) => a._startDateTime.getTime() - b._startDateTime.getTime());
    return { events: baseFiltered, isFallback: false };
  }, [rawEvents, allOccurrences, searchName, searchCity, userLocation])

  const siteName = settings?.siteName || "Viby"

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            {settings?.logoUrl ? (
              <Image 
                src={settings.logoUrl} 
                alt={siteName} 
                width={120} 
                height={40} 
                style={{ height: 'auto' }}
                className="h-10 w-auto object-contain transition-transform group-hover:scale-105" 
                priority 
                unoptimized 
              />
            ) : (
              <span className="text-xl font-black italic uppercase text-primary ml-1">{siteName}</span>
            )}
          </Link>
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" className="hidden md:flex rounded-full h-9 border-[#ffdf00] bg-[#ffdf00]/10 text-[#002776] font-black uppercase text-[9px] gap-2">
               <Link href="/copa-do-mundo"><Trophy className="w-3.5 h-3.5" /> Copa 2026</Link>
            </Button>
            {user ? <UserNav /> : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" asChild className="font-bold uppercase text-[10px] tracking-widest px-2 sm:px-4">
                  <Link href="/login">{t('home.login')}</Link>
                </Button>
                <Button asChild className="bg-secondary text-white font-black uppercase italic text-[10px] tracking-widest rounded-full px-4 sm:px-6 shadow-lg">
                  <Link href="/cadastro">{t('home.signup')}</Link>
                </Button>
              </div>
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
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
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
            <p className="text-[10px] font-black uppercase tracking-widest animate-pulse opacity-40">Sincronizando experiências...</p>
          </div>
        ) : processedEvents.events.length === 0 ? (
          <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-border flex flex-col items-center gap-4 opacity-40">
             <Inbox className="w-12 h-12" />
             <p className="text-sm font-black uppercase tracking-widest">Nenhum evento ativo localizado.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {processedEvents.events.map((event) => (
                <EventCard key={event.id} event={event} userLocation={userLocation} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-16 flex justify-center">
                <Button variant="outline" onClick={() => fetchEvents(false)} disabled={isFetching} className="rounded-full px-10 h-12 font-bold uppercase border-secondary text-secondary">
                  {isFetching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Carregar Mais
                </Button>
              </div>
            )}
          </>
        )}
      </section>
      <Footer />
    </div>
  )
}
