
"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, doc, query, where, limit, orderBy, getDoc } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { AdCard } from "@/components/ads/AdCard"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  Filter, 
  Loader2, 
  ShieldCheck, 
  Navigation, 
  Building2, 
  BadgeCheck, 
  ChevronRight,
  Users 
} from "lucide-react"
import { useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/tabs"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getCurrentLocation, calculateDistance, type Coordinates } from "@/lib/location-utils"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"
import { cn } from "@/lib/utils"
import Footer from "@/components/layout/Footer"

function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck className={cn("w-5 h-5 fill-blue-500 text-white", className)} />
  )
}

export default function ExplorarPage() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null)
  
  const router = useRouter()
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

  const { data: events, loading } = useCollection<any>(eventsQuery)

  const adsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "ads"), where("status", "==", "Ativo"))
  }, [db])
  const { data: activeAds } = useCollection<any>(adsQuery)

  React.useEffect(() => {
    if ((filter === 'nearby' || filter === 'organizadores') && !userLocation) {
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

  const nearbyOrganizers = React.useMemo(() => {
    if (!events || !userLocation) return []
    
    const eventsWithDistance = events
      .filter((e: any) => e.status !== 'Excluído' && e.latitude && e.longitude)
      .map((e: any) => ({
        ...e,
        _dist: calculateDistance(userLocation, { latitude: e.latitude, longitude: e.longitude })
      }))
      .sort((a, b) => a._dist - b._dist);

    const uniqueOrgs: any[] = [];
    const seenIds = new Set();

    eventsWithDistance.forEach((event: any) => {
      if (event.organizationId && !seenIds.has(event.organizationId)) {
        seenIds.add(event.organizationId);
        // Prioriza dados do objeto organizer se existirem, senão tenta o ID
        const orgAvatar = event.organizer?.avatar || event.avatar || "";
        uniqueOrgs.push({
          id: event.organizationId,
          name: event.organizer?.name || "Marca",
          username: event.organizer?.username || "marca",
          avatar: orgAvatar,
          isVerified: event.organizer?.isVerified || event.organizer?.verified || false
        });
      }
    });

    return uniqueOrgs;
  }, [events, userLocation]);

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

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  const siteName = settings?.siteName || "Viby"

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
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
          <p className="text-muted-foreground font-medium">Descubra o que está acontecendo e quem são as marcas por trás das experiências.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por tema..." 
              className="pl-10 h-11 rounded-xl" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" className="gap-2 rounded-xl h-11 border-dashed">
            <Filter className="w-4 h-4" />
            Filtros
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border pb-2 bg-white/40 backdrop-blur-md rounded-xl p-1">
        <Tabs defaultValue="all" value={filter} onValueChange={setFilter} className="w-full">
          <TabsList className="bg-transparent h-auto p-0 gap-8">
            <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary rounded-none px-0 py-2 font-bold uppercase text-[10px] tracking-widest opacity-50 data-[state=active]:opacity-100">Geral</TabsTrigger>
            <TabsTrigger value="nearby" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary rounded-none px-0 py-2 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 opacity-50 data-[state=active]:opacity-100">
              <Navigation className="w-3 h-3" /> Perto de Você
            </TabsTrigger>
            <TabsTrigger value="new" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary rounded-none px-0 py-2 font-bold uppercase text-[10px] tracking-widest opacity-50 data-[state=active]:opacity-100">Recém Lançados</TabsTrigger>
            <TabsTrigger value="organizadores" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary rounded-none px-0 py-2 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 opacity-50 data-[state=active]:opacity-100">
              <Building2 className="w-3 h-3" /> Organizadores
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
      )}

      {!loading && filter !== 'organizadores' && interleavedContent.length === 0 && (
        <div className="py-24 text-center border-2 border-dashed rounded-[3rem] bg-white/20">
          <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Nenhum evento disponível no momento.</p>
        </div>
      )}

      {filter === 'organizadores' && nearbyOrganizers.length === 0 && !loading && (
        <div className="py-24 text-center border-2 border-dashed rounded-[3rem] bg-white/20">
          <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Habilite sua localização para ver organizadores próximos.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filter === 'organizadores' ? (
          nearbyOrganizers.map((org) => (
            <Card 
              key={org.id} 
              className="group overflow-hidden border-none shadow-lg bg-white transition-all hover:-translate-y-1 hover:shadow-xl rounded-[2rem] cursor-pointer"
              onClick={() => router.push(`/${org.username}`)}
            >
              <CardContent className="p-8 flex items-center gap-6">
                <div className="relative">
                  <Avatar className="h-20 w-20 border-2 border-secondary/10 p-0.5 shadow-sm">
                    <AvatarImage src={org.avatar} alt={org.name} className="object-cover rounded-full" />
                    <AvatarFallback className="font-bold text-xl bg-muted text-muted-foreground">
                       {org.name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {org.isVerified && (
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                      <VerifiedBadge />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary leading-tight line-clamp-1">{org.name}</h3>
                  <p className="text-[10px] font-black text-secondary uppercase tracking-widest">@{org.username}</p>
                </div>
                <ChevronRight className="w-6 h-6 text-muted-foreground opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </CardContent>
            </Card>
          ))
        ) : (
          interleavedContent.map((item: any, idx: number) => (
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
          ))
        )}
      </div>
    </div>
  )
}
