"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth } from "@/firebase"
import { collection, query, limit, where, orderBy, getDocs, startAfter, DocumentSnapshot } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { AdsRenderer } from "@/components/ads/AdsRenderer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, MapPin, Loader2, Inbox, Trophy } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { normalizeText } from "@/lib/utils"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"
import { getCurrentLocation, type Coordinates } from "@/lib/location-utils"
import { calculateDistanceMeters } from "@/lib/event-scoring-utils"
import Footer from "@/components/layout/Footer"
import { format, startOfToday, addDays } from "date-fns"
import { useTranslation } from "@/i18n/i18n-context"
import { useState, useEffect, useCallback } from "react"
import { PublicHeader } from "@/components/layout/PublicHeader"

export default function LandingPageClient({ initialEvents = [] }: { initialEvents?: any[] }) {
  const { t } = useTranslation()
  const db = useFirestore()
  const auth = useAuth()

  // --- ESTADOS ---
  const [searchName, setSearchName] = useState("")
  const [searchCity, setSearchCity] = useState("")
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null)
  const [now, setNow] = useState<Date | null>(null)
  const [rawEvents, setRawEvents] = useState<any[]>(initialEvents)
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = useState(initialEvents.length >= 12)
  const [isFetching, setIsFetching] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(initialEvents.length === 0)

  // --- CICLO DE VIDA ---
  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 60000)
    getCurrentLocation().then(loc => { if (loc) setUserLocation(loc); }).catch(() => {})
    return () => clearInterval(timer)
  }, [])

  // --- QUERIES ---
  const occurrencesQuery = useMemoFirebase(() => {
    if (!db) return null
    const yesterdayStr = format(addDays(startOfToday(), -1), 'yyyy-MM-dd')
    return query(
      collection(db, "recurring_occurrences"), 
      where("status", "==", "active"), 
      where("date", ">=", yesterdayStr)
    )
  }, [db])
  const { data: allOccurrences } = useCollection<any>(occurrencesQuery)

  const fetchEvents = useCallback(async (isInitial = false) => {
    if (!db || isFetching || (!isInitial && !hasMore)) return
    
    setIsFetching(true)
    try {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 12);
      const dateThreshold = yesterday.toISOString();

      const q = query(
        collection(db, "events"),
        where("status", "==", "Ativo"),
        where("date", ">=", dateThreshold),
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
  }, [initialEvents.length, fetchEvents])

  // --- PIPELINE DE PROCESSAMENTO ---
  
  const processedData = React.useMemo(() => {
    // 1. Log de Entrada
    console.log("[PIPELINE-LANDING] Input:", { rawEvents: rawEvents.length, occurrences: allOccurrences?.length || 0 });

    const refTime = now || new Date();

    // 2. Resolução de Recorrência (Eager Resolution)
    const merged = rawEvents.map(e => {
      let effectiveDate = e.date;
      if (e.isRecurring && allOccurrences) {
        const myOccs = allOccurrences.filter((o: any) => o.parentId === e.id) || [];
        if (myOccs.length > 0) {
          const sorted = [...myOccs]
            .map(o => ({ ...o, _dt: new Date(o.date + 'T' + (o.startTime || '00:00') + ':00') }))
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
    });

    console.log("[PIPELINE-LANDING] Post-Merge:", merged.length);

    // 3. Filtros (Busca e Visibilidade)
    const filtered = merged.filter(e => {
      // Regra de Visibilidade Viby (Unificada)
      const startMs = new Date(e.date).getTime();
      if (isNaN(startMs)) return false;
      const endMs = e.endDate ? new Date(e.endDate).getTime() : (startMs + 6 * 60 * 60 * 1000);
      
      // Durante hidratação (now == null), permitimos ver o evento se o endMs for futuro em relação ao servidor
      if (now && now.getTime() >= endMs) return false;

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
      const startDateTime = new Date(e.date);
      return { ...e, _distanceMeters: distMeters, _startDateTime: isNaN(startDateTime.getTime()) ? new Date() : startDateTime };
    });

    console.log("[PIPELINE-LANDING] Post-Filter:", filtered.length);

    // 4. Separação de Destaques e Patrocínios
    const featured = filtered.filter(e => e.isFeatured === true);
    const sponsored = filtered.filter(e => e.isSponsored === true || e.curationType === 'curadoria');
    const standard = filtered.filter(e => !e.isFeatured && !e.isSponsored && e.curationType !== 'curadoria');

    // 5. Ordenação (Próximos Primeiro)
    standard.sort((a, b) => a._startDateTime.getTime() - b._startDateTime.getTime());

    // 6. Construção do Feed Unificado
    const finalFeed: any[] = [];
    let eventCounter = 0;
    let adIndex = 0;

    // Adiciona Patrocinados no Topo
    sponsored.forEach(ev => finalFeed.push({ type: 'event', data: ev }));

    // Intercala Standard com Ads
    standard.forEach(ev => {
      finalFeed.push({ type: 'event', data: ev });
      eventCounter++;
      if (eventCounter % 6 === 0) {
        finalFeed.push({ type: 'ad', adIndex: adIndex++ });
      }
    });

    return { 
      feed: finalFeed, 
      featuredCount: featured.length, 
      totalVisible: filtered.length 
    };
  }, [rawEvents, allOccurrences, searchName, searchCity, userLocation, now])

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <PublicHeader />

      {/* HERO SECTION */}
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

      {/* FEED PRINCIPAL */}
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
        ) : processedData.feed.length === 0 ? (
          <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-border flex flex-col items-center gap-4 opacity-40">
             <Inbox className="w-12 h-12" />
             <p className="text-sm font-black uppercase tracking-widest">Nenhum evento localizado para estes filtros.</p>
             <Button variant="link" onClick={() => { setSearchName(""); setSearchCity(""); }} className="font-bold uppercase text-xs">Limpar busca</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {processedData.feed.map((item: any, idx: number) => (
                item.type === 'ad' ? (
                  <AdsRenderer 
                    key={`ad-${idx}`} 
                    location="home" 
                    index={item.adIndex} 
                    googleSlotId="home-feed-slot" 
                  />
                ) : (
                  <EventCard 
                    key={item.data.id} 
                    event={item.data} 
                    userLocation={userLocation} 
                    isSponsored={item.data.isSponsored || item.data.curationType === 'curadoria'}
                  />
                )
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
