"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, doc, query, where, limit, orderBy } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { AdsRenderer } from "@/components/ads/AdsRenderer"
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
  History,
  Calendar as CalendarIcon
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EVENT_CATEGORIES } from "@/lib/constants"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format, startOfToday, addDays, endOfWeek, isSameDay } from "date-fns"
import { ptBR } from "date-fns/locale"

export default function ExplorarPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [radiusKm, setRadiusKm] = useState('50')
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null)
  
  const [dateFilter, setDateFilter] = React.useState<"all" | "today" | "tomorrow" | "week" | "custom">("all")
  const [customDate, setCustomDate] = React.useState<Date | undefined>(undefined)

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
      
      // Filtro de Data
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const eventDate = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        const today = startOfToday();
        
        if (dateFilter === 'today') {
          matchesDate = isSameDay(eventDate, today);
        } else if (dateFilter === 'tomorrow') {
          matchesDate = isSameDay(eventDate, addDays(today, 1));
        } else if (dateFilter === 'week') {
          const sunday = endOfWeek(today, { weekStartsOn: 0 });
          matchesDate = eventDate >= today && eventDate <= sunday;
        } else if (dateFilter === 'custom' && customDate) {
          matchesDate = isSameDay(eventDate, customDate);
        }
      }
      
      return matchesSearch && matchesCategory && matchesDate;
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

    return result.map(e => ({
      ...e,
      _score: calculateEventScore(e, { userLocation, maxRadiusKm: radiusKm === 'unlimited' ? 500 : parseInt(radiusKm) })
    })).sort((a, b) => b._score - a._score);
  }, [allEvents, search, activeTab, userLocation, radiusKm, selectedCategory, dateFilter, customDate])

  const unifiedFeed = React.useMemo(() => {
    const result = [];
    let eventCounter = 0;
    let adIndex = 0;

    if (!filteredAndSortedEvents || filteredAndSortedEvents.length === 0) {
      if (!eventsLoading) {
        // Feed unificado de ads para placeholder
        result.push({ type: "ad", adIndex: adIndex++ });
        result.push({ type: "ad", adIndex: adIndex++ });
        result.push({ type: "ad", adIndex: adIndex++ });
      }
      return result;
    }

    for (let i = 0; i < filteredAndSortedEvents.length; i++) {
      result.push({ type: "event", data: filteredAndSortedEvents[i] });
      eventCounter++;

      if (eventCounter === 6) {
        result.push({ type: "ad", adIndex: adIndex++ });
        eventCounter = 0;
      }
    }

    return result;
  }, [filteredAndSortedEvents, eventsLoading])

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

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("rounded-xl h-11 border-dashed gap-2 font-bold text-xs uppercase", dateFilter !== 'all' && "bg-secondary/10 border-secondary text-secondary")}>
                <CalendarIcon className="h-4 w-4" />
                {dateFilter === 'today' ? "Hoje" :
                 dateFilter === 'tomorrow' ? "Amanhã" :
                 dateFilter === 'week' ? "Esta semana" :
                 dateFilter === 'custom' && customDate ? format(customDate, "dd/MM", { locale: ptBR }) :
                 "Data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="end">
              <div className="p-3 border-b grid grid-cols-3 gap-2">
                  <Button variant="ghost" size="sm" className={cn("text-[10px] font-black uppercase rounded-lg", dateFilter === 'today' && "bg-secondary text-white hover:bg-secondary/90")} onClick={() => { setDateFilter('today'); setCustomDate(undefined); }}>Hoje</Button>
                  <Button variant="ghost" size="sm" className={cn("text-[10px] font-black uppercase rounded-lg", dateFilter === 'tomorrow' && "bg-secondary text-white hover:bg-secondary/90")} onClick={() => { setDateFilter('tomorrow'); setCustomDate(undefined); }}>Amanhã</Button>
                  <Button variant="ghost" size="sm" className={cn("text-[10px] font-black uppercase rounded-lg", dateFilter === 'week' && "bg-secondary text-white hover:bg-secondary/90")} onClick={() => { setDateFilter('week'); setCustomDate(undefined); }}>Semana</Button>
              </div>
              <Calendar
                mode="single"
                selected={customDate}
                onSelect={(d) => { if(d) { setCustomDate(d); setDateFilter('custom'); } }}
                initialFocus
                locale={ptBR}
              />
              <div className="p-2 border-t">
                   <Button variant="link" size="sm" className="w-full text-[10px] font-black uppercase text-muted-foreground" onClick={() => { setDateFilter('all'); setCustomDate(undefined); }}>Limpar Data</Button>
              </div>
            </PopoverContent>
          </Popover>

          <Select value={radiusKm} onValueChange={setRadiusKm}>
            <SelectTrigger className="w-32 h-11 rounded-xl border-dashed">
               <div className="flex items-center gap-2 font-bold text-xs"><Navigation className="w-3 h-3" /><SelectValue /></div>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
               <SelectItem value="10">10km</SelectItem><SelectItem value="50">50km</SelectItem><SelectItem value="unlimited">Ilimitado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="rounded-xl h-11 border-dashed" onClick={() => { setSearch(""); setRadiusKm("50"); setSelectedCategory("all"); setActiveTab("all"); setDateFilter("all"); setCustomDate(undefined); }}><FilterX className="w-4 h-4" /></Button>
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
           ) : (
             <>
               {unifiedFeed.length === 0 && !eventsLoading && (
                 <div className="py-40 text-center bg-white rounded-[3rem] border-2 border-dashed opacity-40 mb-10">
                   <p className="text-xs font-black uppercase tracking-widest">Nenhum evento encontrado para este filtro.</p>
                 </div>
               )}

               {unifiedFeed.length > 0 && (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {unifiedFeed.map((item: any, idx: number) => (
                      item.type === 'ad' ? (
                        <AdsRenderer 
                          key={`ad-slot-${item.adIndex}-${idx}`} 
                          location="feed" 
                          index={item.adIndex} 
                          googleSlotId="discovery-feed-slot" 
                        />
                      ) : (
                        <EventCard 
                          key={`event-${item.data.id}-${idx}`} 
                          event={item.data} 
                          userLocation={userLocation} 
                          isSponsored={item.data.isSponsored} 
                        />
                      )
                    ))}
                 </div>
               )}
             </>
           )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
