
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

  // Lógica de Intercalação de ADS com Prioridade por Orçamento e Horário
  const interleavedContent = React.useMemo(() => {
    if (!filteredEvents || filteredEvents.length === 0) return []
    
    const now = new Date()

    // 1. Criar o Pool de anúncios válidos e ordenar por maior orçamento restante
    const sponsoredPool = (activeAds || [])
      .map((ad: any) => {
        const start = ad.startDate ? new Date(ad.startDate) : null
        const end = ad.endDate ? new Date(ad.endDate) : null
        const isDateValid = (!start || now >= start) && (!end || now <= end)
        const hasBudget = (ad.remainingBudget || 0) > 0

        if (!isDateValid || !hasBudget) return null

        if (ad.type === 'evento') {
          const fullEvent = events?.find((e: any) => e.id === ad.eventId)
          if (!fullEvent) return null
          return { ...fullEvent, isSponsored: true, adId: ad.id, _remainingBudget: ad.remainingBudget, _isAdObject: false }
        }

        return { ...ad, isSponsored: true, _remainingBudget: ad.remainingBudget, _isAdObject: true }
      })
      .filter(Boolean)
      .sort((a, b) => (b._remainingBudget || 0) - (a._remainingBudget || 0)) // Prioridade: Maior orçamento no topo

    const organic = filteredEvents.map(e => ({ ...e, isSponsored: false, _isAdObject: false }))

    if (sponsoredPool.length === 0) return organic

    const result = []
    const sponsoredEventIds = new Set(sponsoredPool.filter(s => !s._isAdObject).map(s => s.id));
    const filteredOrganic = organic.filter(e => !sponsoredEventIds.has(e.id));

    let organicIdx = 0
    let adIdx = 0

    while (organicIdx < filteredOrganic.length || adIdx < sponsoredPool.length) {
      // Adiciona bloco orgânico (intervalo aleatório entre 4 e 7)
      const interval = Math.floor(Math.random() * 4) + 4
      const chunk = filteredOrganic.slice(organicIdx, organicIdx + interval)
      result.push(...chunk)
      organicIdx += interval

      // Insere anúncio respeitando a ordem de prioridade de orçamento
      if (adIdx < sponsoredPool.length) {
        result.push(sponsoredPool[adIdx])
        adIdx++
      } else if (sponsoredPool.length > 0 && organicIdx < filteredOrganic.length) {
        // Repetição: Anúncios com maior orçamento continuam aparecendo mais vezes
        // Usamos uma lógica que favorece a primeira metade (maior orçamento) do pool ordenado
        const topWeightedIdx = Math.floor(Math.random() * Math.ceil(sponsoredPool.length / 2))
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
    </div>
  )
}
