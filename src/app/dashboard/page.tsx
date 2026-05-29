
"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, doc, query, where, limit, orderBy } from "firebase/firestore"
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
  FilterX,
  TrendingUp,
  Sparkles,
  History
} from "lucide-react"
import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getCurrentLocation, type Coordinates } from "@/lib/location-utils"
import { calculateEventScore, isEventVisible } from "@/lib/event-scoring-utils"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"
import { cn, normalizeText } from "@/lib/utils"
import Footer from "@/components/layout/Footer"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EVENT_CATEGORIES } from "@/lib/constants"

export default function ExplorarPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [radiusKm, setRadiusKm] = useState('50')
  const [selectedCategory, setSelectedCategory] = useState("all")
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
    return query(collection(db, "events"), where("status", "==", "Ativo"))
  }, [db])

  const { data: allEvents, loading: eventsLoading } = useCollection<any>(eventsQuery)

  const adsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "ads"), where("status", "==", "Ativo"))
  }, [db])
  const { data: activeAds } = useCollection<any>(adsQuery)

  useEffect(() => {
    getCurrentLocation()
      .then(setUserLocation)
      .catch(() => console.warn("GPS negado. Fallback ativado."));
  }, []);

  const filteredAndSortedEvents = React.useMemo(() => {
    if (!allEvents) return []
    
    let result = allEvents.filter(e => {
      if (!isEventVisible(e)) return false
      
      const searchNorm = normalizeText(search);
      const matchesSearch = !search || 
        normalizeText(e.title || "").includes(searchNorm) ||
        normalizeText(e.description || "").includes(searchNorm) ||
        normalizeText(e.city || "").includes(searchNorm) ||
        normalizeText(e.organizer?.name || "").includes(searchNorm) ||
        (e.searchKeywords && e.searchKeywords.some((k: string) => k.includes(searchNorm)));

      const matchesCategory = selectedCategory === 'all' || 
        e.categoryId === selectedCategory || 
        (e.categories && e.categories.includes(selectedCategory));
      
      return matchesSearch && matchesCategory;
    });

    if (activeTab === 'recent') {
      return result.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }

    if (activeTab === 'trending') {
      return result.sort((a, b) => {
        const scoreA = (a.viewsCount || 0) + (a.interestedCount || 0) * 2;
        const scoreB = (b.viewsCount || 0) + (b.interestedCount || 0) * 2;
        return scoreB - scoreA;
      });
    }

    // Default Score (Híbrido)
    return result.map(e => ({
      ...e,
      _score: calculateEventScore(e, { userLocation, maxRadiusKm: radiusKm === 'unlimited' ? 500 : parseInt(radiusKm) })
    })).sort((a, b) => b._score - a._score);
  }, [allEvents, search, activeTab, userLocation, radiusKm, selectedCategory])

  const interleavedContent = React.useMemo(() => {
    if (!filteredAndSortedEvents) return []
    const sponsoredPool = (activeAds || [])
      .map((ad: any) => {
        const fullEvent = allEvents?.find((e: any) => e.id === ad.eventId);
        if (ad.type === 'evento' && fullEvent) return { ...fullEvent, isSponsored: true, adId: ad.id, _isAdObject: false };
        return { ...ad, isSponsored: true, adId: ad.id, _isAdObject: true };
      })
      .filter(ad => ad.status === 'Ativo');

    const organic = filteredAndSortedEvents.map(e => ({ ...e, isSponsored: false, _isAdObject: false }));
    const result = [];
    let organicIdx = 0;
    let adIdx = 0;

    while (organicIdx < organic.length || adIdx < sponsoredPool.length) {
      const chunk = organic.slice(organicIdx, organicIdx + 4);
      result.push(...chunk);
      organicIdx += 4;
      if (adIdx < sponsoredPool.length) { result.push(sponsoredPool[adIdx]); adIdx++; }
    }
    return result;
  }, [filteredAndSortedEvents, activeAds, allEvents])

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Discovery</h1>
            {isAdmin && <Button asChild variant="destructive" size="sm" className="rounded-full h-8 px-4 uppercase text-[9px] tracking-widest"><Link href="/admin"><ShieldCheck className="w-4 h-4" /> Admin</Link></Button>}
          </div>
          <p className="text-muted-foreground font-medium uppercase text-[11px] tracking-widest">Explore experiências por relevância e proximidade.</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Show, cidade, artista..." className="pl-10 h-11 rounded-xl" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={radiusKm} onValueChange={setRadiusKm}>
            <SelectTrigger className="w-32 h-11 rounded-xl border-dashed">
               <div className="flex items-center gap-2 font-bold text-xs"><Navigation className="w-3 h-3" /><SelectValue /></div>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
               <SelectItem value="10">10km</SelectItem><SelectItem value="50">50km</SelectItem><SelectItem value="unlimited">Ilimitado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="rounded-xl h-11 border-dashed" onClick={() => { setSearch(""); setRadiusKm("50"); setSelectedCategory("all"); setActiveTab("all"); }}><FilterX className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-hide pb-2">
         <div className="flex gap-2">
            <Button variant={selectedCategory === 'all' ? 'secondary' : 'outline'} className="rounded-full h-10 px-6 font-black uppercase text-[10px] tracking-widest" onClick={() => setSelectedCategory('all')}>Todos</Button>
            {EVENT_CATEGORIES.map(cat => (
              <Button key={cat} variant={selectedCategory === cat ? 'secondary' : 'outline'} className="rounded-full h-10 px-6 font-black uppercase text-[10px] tracking-widest whitespace-nowrap" onClick={() => setSelectedCategory(cat)}>{cat}</Button>
            ))}
         </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/30 p-1 rounded-2xl h-14 w-full md:w-fit">
          <TabsTrigger value="all" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest gap-2">Geral</TabsTrigger>
          <TabsTrigger value="trending" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest gap-2"><TrendingUp className="w-4 h-4" /> Em Alta</TabsTrigger>
          <TabsTrigger value="recent" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest gap-2"><History className="w-4 h-4" /> Recentes</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-8">
           {eventsLoading ? (
             <div className="py-32 flex flex-col items-center justify-center gap-4"><Loader2 className="w-12 h-12 animate-spin text-secondary" /><p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Cruzando dados...</p></div>
           ) : interleavedContent.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {interleavedContent.map((item: any, idx: number) => (
                  item._isAdObject ? <AdCard key={`ad-${item.adId}-${idx}`} ad={item} /> : <EventCard key={`ev-${item.id}-${idx}`} event={item} userLocation={userLocation} isSponsored={item.isSponsored} />
                ))}
             </div>
           ) : (
             <div className="py-40 text-center bg-white rounded-[3rem] border-2 border-dashed opacity-40"><p className="text-xs font-black uppercase tracking-widest">Nenhum resultado encontrado.</p></div>
           )}
        </TabsContent>
      </Tabs>
      <Footer />
    </div>
  )
}
