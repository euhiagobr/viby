"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, doc, query, where, limit, orderBy } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
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

  // Consulta de Anúncios Ativos
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
    
    let result = events.filter((e: any) => {
      const isNotDeleted = e.status !== 'Excluído';
      const matchesSearch = e.title?.toLowerCase().includes(search.toLowerCase()) ||
                          e.description?.toLowerCase().includes(search.toLowerCase());
      return isNotDeleted && matchesSearch;
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

  // Lógica de Intercalação de ADS para o Dashboard com verificação de data
  const interleavedContent = React.useMemo(() => {
    if (!filteredEvents || filteredEvents.length === 0) return []
    
    const now = new Date()
    now.setHours(0, 0, 0, 0) // Normaliza data

    const sponsoredPool = (activeAds || [])
      .map((ad: any) => {
        const start = ad.startDate ? new Date(ad.startDate) : null
        const end = ad.endDate ? new Date(ad.endDate) : null
        
        if (start) start.setHours(0, 0, 0, 0)
        if (end) end.setHours(23, 59, 59, 999)

        const isDateValid = (!start || now >= start) && (!end || now <= end)
        if (!isDateValid) return null

        const fullEvent = events?.find((e: any) => e.id === ad.eventId)
        return fullEvent ? { ...fullEvent, isSponsored: true, adId: ad.id } : null
      })
      .filter(Boolean)

    if (sponsoredPool.length === 0) {
      return filteredEvents.map(e => ({ ...e, isSponsored: false }))
    }

    const result = []
    const sponsoredEventIds = new Set(sponsoredPool.map(s => s.id));
    const organic = filteredEvents.filter(e => !sponsoredEventIds.has(e.id));

    // 1. Sempre o primeiro é um ADS
    result.push(sponsoredPool[0])

    let organicIdx = 0
    let adIdx = 1

    while (organicIdx < organic.length) {
      // 2. Intervalo aleatório entre 5 e 9 postagens
      const interval = Math.floor(Math.random() * (9 - 5 + 1)) + 5
      const chunk = organic.slice(organicIdx, organicIdx + interval)
      result.push(...chunk.map(e => ({ ...e, isSponsored: false })))
      organicIdx += interval

      if (organicIdx < organic.length) {
        result.push(sponsoredPool[adIdx % sponsoredPool.length])
        adIdx++
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
              onChange={(e) => setSearch(searchName => e.target.value)}
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

      {error && (
        <div className="p-8 text-center bg-destructive/10 text-destructive rounded-xl border border-destructive/20 font-medium">
          Erro ao carregar eventos: {error.message}
        </div>
      )}

      {!loading && !error && interleavedContent.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-border shadow-sm">
          <p className="text-muted-foreground font-medium uppercase text-[10px] font-black tracking-widest">Nenhum evento ativo encontrado.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {interleavedContent.map((item: any, idx: number) => (
          <EventCard 
            key={`${item.id}-${idx}`} 
            event={item} 
            userLocation={userLocation} 
            isSponsored={item.isSponsored}
          />
        ))}
      </div>
    </div>
  )
}
