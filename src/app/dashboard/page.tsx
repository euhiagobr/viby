"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, doc, query, where, limit } from "firebase/firestore"
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
  Clock,
  Zap,
  FilterX
} from "lucide-react"
import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getCurrentLocation, type Coordinates } from "@/lib/location-utils"
import { calculateEventScore, isEventVisible } from "@/lib/event-scoring-utils"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"
import { cn } from "@/lib/utils"
import Footer from "@/components/layout/Footer"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck className={cn("w-5 h-5 fill-blue-500 text-white", className)} />
  )
}

export default function ExplorarPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [radiusKm, setRadiusKm] = useState('50')
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
    return query(collection(db, "events"), where("status", "==", "Ativo"), limit(200))
  }, [db])

  const { data: events, loading: eventsLoading } = useCollection<any>(eventsQuery)

  const adsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "ads"), where("status", "==", "Ativo"))
  }, [db])
  const { data: activeAds } = useCollection<any>(adsQuery)

  useEffect(() => {
    getCurrentLocation()
      .then(setUserLocation)
      .catch(() => {
        console.warn("GPS negado. Lógica de score usará fallback neutro.");
      });
  }, []);

  const filteredAndSortedEvents = React.useMemo(() => {
    if (!events) return []
    
    let result = events.filter(e => {
      if (!isEventVisible(e)) return false
      
      const matchesSearch = !search || 
        e.title?.toLowerCase().includes(search.toLowerCase()) ||
        e.description?.toLowerCase().includes(search.toLowerCase());
      
      if (!matchesSearch) return false;

      // Filtro da Tab
      if (activeTab === 'today') {
        const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        return d.toDateString() === new Date().toDateString();
      }

      return true;
    });

    // Score inteligente híbrido
    return result.map(e => ({
      ...e,
      _score: calculateEventScore(e, {
        userLocation,
        maxRadiusKm: radiusKm === 'unlimited' ? 500 : parseInt(radiusKm)
      })
    })).sort((a, b) => b._score - a._score);
  }, [events, search, activeTab, userLocation, radiusKm])

  const interleavedContent = React.useMemo(() => {
    const now = new Date()
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
          return { ...fullEvent, isSponsored: true, adId: ad.id, _isAdObject: false };
        }
        return { ...ad, isSponsored: true, adId: ad.id, _isAdObject: true };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (b._remainingBudget || 0) - (a._remainingBudget || 0));

    const organic = filteredAndSortedEvents.map(e => ({ ...e, isSponsored: false, _isAdObject: false }));
    const result = [];
    const sponsoredEventIds = new Set(sponsoredPool.filter(s => !s._isAdObject).map(s => s.id));
    const finalOrganic = organic.filter(e => !sponsoredEventIds.has(e.id));

    let organicIdx = 0;
    let adIdx = 0;

    while (organicIdx < finalOrganic.length || adIdx < sponsoredPool.length) {
      const interval = 4;
      const chunk = finalOrganic.slice(organicIdx, organicIdx + interval);
      result.push(...chunk);
      organicIdx += interval;

      if (adIdx < sponsoredPool.length) {
        result.push(sponsoredPool[adIdx]);
        adIdx++;
      }
    }
    return result;
  }, [filteredAndSortedEvents, activeAds, events])

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Explorar Experiências</h1>
            {isAdmin && (
              <Button asChild variant="destructive" size="sm" className="gap-2 font-bold rounded-full h-8 px-4 uppercase text-[9px] tracking-widest">
                <Link href="/admin">
                  <ShieldCheck className="w-4 h-4" /> Painel Admin
                </Link>
              </Button>
            )}
          </div>
          <p className="text-muted-foreground font-medium uppercase text-[11px] tracking-widest">Ordenação híbrida por proximidade e cronologia.</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar tema ou local..." 
              className="pl-10 h-11 rounded-xl" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <Select value={radiusKm} onValueChange={setRadiusKm}>
            <SelectTrigger className="w-40 h-11 rounded-xl border-dashed">
               <div className="flex items-center gap-2 font-bold text-xs uppercase">
                  <Navigation className="w-3.5 h-3.5 text-secondary" />
                  <SelectValue />
               </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
               <SelectItem value="5" className="text-xs font-bold uppercase">Raio 5km</SelectItem>
               <SelectItem value="10" className="text-xs font-bold uppercase">Raio 10km</SelectItem>
               <SelectItem value="25" className="text-xs font-bold uppercase">Raio 25km</SelectItem>
               <SelectItem value="50" className="text-xs font-bold uppercase">Raio 50km</SelectItem>
               <SelectItem value="100" className="text-xs font-bold uppercase">Raio 100km</SelectItem>
               <SelectItem value="unlimited" className="text-xs font-bold uppercase">Ilimitado</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="rounded-xl h-11 border-dashed" onClick={() => { setSearch(""); setRadiusKm("50"); setActiveTab("all"); }}>
            <FilterX className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border pb-0">
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-transparent h-auto p-0 gap-8">
            <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-secondary data-[state=active]:border-b-4 data-[state=active]:border-secondary rounded-none px-0 py-3 font-black uppercase text-[10px] tracking-widest opacity-50 data-[state=active]:opacity-100">Geral</TabsTrigger>
            <TabsTrigger value="today" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-secondary data-[state=active]:border-b-4 data-[state=active]:border-secondary rounded-none px-0 py-3 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 opacity-50 data-[state=active]:opacity-100">
              <Zap className="w-3.5 h-3.5 fill-current" /> Acontecendo Hoje
            </TabsTrigger>
            <TabsTrigger value="organizadores" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-secondary data-[state=active]:border-b-4 data-[state=active]:border-secondary rounded-none px-0 py-3 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 opacity-50 data-[state=active]:opacity-100">
              <Building2 className="w-3.5 h-3.5" /> Marcas
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {eventsLoading ? (
        <div className="py-32 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-secondary" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Sincronizando experiências...</p>
        </div>
      ) : interleavedContent.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {interleavedContent.map((item: any, idx: number) => (
            item._isAdObject ? (
              <AdCard key={`ad-${item.adId}-${idx}`} ad={item} />
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
      ) : (
        <div className="py-40 text-center bg-white rounded-[3rem] border-2 border-dashed border-border shadow-inner">
           <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <FilterX className="w-8 h-8 text-muted-foreground opacity-20" />
           </div>
           <h3 className="text-xl font-black uppercase italic tracking-tighter">Nenhum evento no seu radar</h3>
           <p className="text-muted-foreground font-bold uppercase tracking-widest text-[9px] mt-1">Tente aumentar o raio de busca ou limpar os filtros.</p>
        </div>
      )}
      <Footer />
    </div>
  )
}
