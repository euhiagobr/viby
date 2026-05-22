"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, doc, query, where, limit, orderBy } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { AdCard } from "@/components/ads/AdCard"
import { Button } from "@/components/ui/button"
import { Search, Filter, Loader2, ShieldCheck, Navigation } from "lucide-react"
import { useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { getCurrentLocation, calculateDistance, type Coordinates } from "@/lib/location-utils"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"

export default function ExplorarPage() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null)
  
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  
  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile } = useDoc<any>(userDocRef)
  
  const isAdmin = profile?.role === 'admin'

  const eventsQuery = React.useMemo(() => {
    if (!db) return null
    return query(collection(db, "events"), limit(100))
  }, [db])

  const { data: events, loading, error } = useCollection<any>(eventsQuery)

  const adsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "ads"), where("status", "==", "Ativo"))
  }, [db])
  const { data: activeAds } = useCollection<any>(adsQuery)

  React.useEffect(() => {
    if (filter === 'nearby' && !userLocation) {
      getCurrentLocation()
        .then(setUserLocation)
        .catch(() => setFilter('all'))
    }
  }, [filter, userLocation])

  const filteredEvents = React.useMemo(() => {
    if (!events) return []
    
    const now = new Date();

    let result = events.filter((e: any) => {
      const isNotDeleted = e.status !== 'Excluído';
      
      // Filtrar apenas eventos futuros para a página de explorar
      const start = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      const end = e.endDate?.toDate ? e.endDate.toDate() : (e.endDate ? new Date(e.endDate) : new Date(start.getTime() + 4 * 60 * 60 * 1000));
      const isEnded = end < now;

      const matchesSearch = e.title?.toLowerCase().includes(search.toLowerCase()) ||
                          e.description?.toLowerCase().includes(search.toLowerCase());
      return isNotDeleted && !isEnded && matchesSearch;
    })

    if (filter === 'nearby' && userLocation) {
       result = result.map((e: any) => ({
         ...e,
         _dist: e.latitude && e.longitude ? calculateDistance(userLocation, { latitude: e.latitude, longitude: e.longitude }) : Infinity
       })).sort((a, b) => a._dist - b._dist);
    } else if (filter === 'new') {
       result.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
       });
    }

    return result;
  }, [events, search, filter, userLocation])

  const interleavedContent = React.useMemo(() => {
    const now = new Date()

    const parseAdDate = (val: any) => {
      if (!val) return null;
      if (typeof val.toDate === 'function') return val.toDate();
      return new Date(val);
    };

    const sponsoredPool = (activeAds || [])
      .map((ad: any) => {
        const start = parseAdDate(ad.startDate);
        const end = parseAdDate(ad.endDate);
        
        const isDateValid = (!start || now >= start) && (!end || now <= end)
        const hasBudget = (ad.remainingBudget || 0) > 0

        if (!isDateValid || !hasBudget) return null

        if (ad.type === 'evento') {
          const fullEvent = events?.find((e: any) => e.id === ad.eventId)
          if (!fullEvent) return null;

          const evStart = fullEvent.date?.toDate ? fullEvent.date.toDate() : new Date(fullEvent.date);
          const evEnd = fullEvent.endDate?.toDate ? fullEvent.endDate.toDate() : (fullEvent.endDate ? new Date(fullEvent.endDate) : new Date(evStart.getTime() + 4 * 60 * 60 * 1000));
          if (evEnd < now) return null;

          return { ...fullEvent, isSponsored: true, adId: ad.id, _remainingBudget: ad.remainingBudget, _isAdObject: false }
        }

        // Marcas, Banners e Links
        return { ...ad, isSponsored: true, adId: ad.id, _remainingBudget: ad.remainingBudget, _isAdObject: true }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (b._remainingBudget || 0) - (a._remainingBudget || 0))

    const organic = (filteredEvents || []).map(e => ({ ...e, isSponsored: false, _isAdObject: false }))

    if (organic.length === 0) return sponsoredPool
    if (sponsoredPool.length === 0) return organic

    const result = []
    const sponsoredEventIds = new Set(sponsoredPool.filter(s => !s._isAdObject).map(s => s.id));
    const filteredOrganic = organic.filter(e => !sponsoredEventIds.has(e.id));

    let organicIdx = 0
    let adIdx = 0

    while (organicIdx < filteredOrganic.length || adIdx < sponsoredPool.length) {
      const interval = Math.floor(Math.random() * 3) + 3
      const chunk = filteredOrganic.slice(organicIdx, organicIdx + interval)
      result.push(...chunk)
      organicIdx += interval

      if (adIdx < sponsoredPool.length) {
        result.push(sponsoredPool[adIdx])
        adIdx++
      } else if (sponsoredPool.length > 0 && organicIdx < filteredOrganic.length) {
        const topWeightedIdx = Math.floor(Math.random() * Math.min(3, sponsoredPool.length))
        result.push(sponsoredPool[topWeightedIdx])
      }
    }

    return result
  }, [filteredEvents, activeAds, events])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Explorar Eventos</h1>
            {isAdmin && (
              <Button asChild variant="destructive" size="sm" className="gap-2 font-bold rounded-full h-8 px-4">
                <Link href="/admin">
                  <ShieldCheck className="w-4 h-4" />
                  Painel Admin
                </Link>
              </Button>
            )}
          </div>
          <p className="text-muted-foreground">Descubra o que está acontecendo e como divulgar melhor seus eventos.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por tema..." 
              className="pl-10" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border pb-2">
        <Tabs defaultValue="all" onValueChange={setFilter} className="w-full">
          <TabsList className="bg-transparent h-auto p-0 gap-8">
            <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary rounded-none px-0 py-2 font-bold uppercase text-[10px] tracking-widest">Geral</TabsTrigger>
            <TabsTrigger value="nearby" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary rounded-none px-0 py-2 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
              <Navigation className="w-3 h-3" /> Perto de Você
            </TabsTrigger>
            <TabsTrigger value="new" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary rounded-none px-0 py-2 font-bold uppercase text-[10px] tracking-widest">Recém Lançados</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
      )}

      {!loading && interleavedContent.length === 0 && (
        <div className="py-24 text-center">
          <p className="text-muted-foreground font-medium italic">Nenhum evento ou anúncio disponível no momento.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {interleavedContent.map((item: any, idx: number) => (
          item._isAdObject ? (
            <AdCard key={`ad-${item.id || item.adId}-${idx}`} ad={item} />
          ) : (
            <EventCard 
              key={`event-${item.id}-${idx}`} 
              event={item} 
              userLocation={userLocation} 
              isSponsored={item.isSponsored}
            />
          )
        ))}
      </div>
    </div>
  )
}
