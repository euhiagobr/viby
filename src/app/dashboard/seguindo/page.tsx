
"use client"

import * as React from "react"
import { useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, limit } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { Loader2, Heart, Users, Sparkles, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { format, startOfToday, addDays } from "date-fns"
import { isEventVisible } from "@/lib/event-scoring-utils"

export default function TenhoInteressePage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const [now, setNow] = React.useState<Date | null>(null)

  React.useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // 1. Buscar quem o usuário segue
  const followsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "follows"), where("followerId", "==", user.uid))
  }, [db, user])

  const { data: follows, loading: followsLoading } = useCollection<any>(followsQuery)

  const followedIds = React.useMemo(() => {
    if (!follows) return []
    return follows.map((f: any) => f.followingId)
  }, [follows])

  // 2. Pipeline de Ocorrências para eventos recorrentes
  const occurrencesQuery = useMemoFirebase(() => {
    if (!db) return null
    const yesterdayStr = format(addDays(startOfToday(), -1), 'yyyy-MM-dd')
    return query(collection(db, "recurring_occurrences"), where("status", "==", "active"), where("date", ">=", yesterdayStr))
  }, [db])
  const { data: allOccurrences } = useCollection<any>(occurrencesQuery)

  // 3. Buscar eventos dessas organizações
  const eventsQuery = useMemoFirebase(() => {
    if (!db || followedIds.length === 0) return null
    
    // Limite do Firestore para o operador 'in' é de 30 itens
    const slicedIds = followedIds.slice(0, 30)
    
    return query(
      collection(db, "events"), 
      where("organizationId", "in", slicedIds),
      where("status", "==", "Ativo"),
      limit(50)
    )
  }, [db, followedIds])

  const { data: rawEvents, loading: eventsLoading } = useCollection<any>(eventsQuery)

  const events = React.useMemo(() => {
    if (!rawEvents) return []
    
    return rawEvents.map(e => {
      let effectiveDate = e.date;
      if (e.isRecurring && allOccurrences && now) {
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
      return isEventVisible(e, now);
    }).sort((a, b) => {
      const tA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
      const tB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
      return tB - tA;
    });
  }, [rawEvents, allOccurrences, now])

  if (followsLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  return (
    <div className="space-y-12 pb-20 max-w-2xl mx-auto">
      <div className="flex flex-col gap-3 text-center md:text-left md:flex-row md:items-end md:justify-between px-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight uppercase italic text-primary flex items-center justify-center md:justify-start gap-3">
            <Sparkles className="w-10 h-10 text-secondary fill-secondary" />
            Feed Cultural
          </h1>
          <p className="text-muted-foreground font-medium">
            As melhores experiências das marcas que você escolheu acompanhar.
          </p>
        </div>
      </div>

      {followedIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-border gap-6 shadow-sm mx-4">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
            <Users className="w-10 h-10 text-muted-foreground opacity-30" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-bold">Seu feed está vazio.</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Siga seus produtores favoritos para ver as publicações deles aqui.
            </p>
          </div>
          <Button asChild className="bg-secondary text-white font-black px-10 h-12 rounded-full shadow-lg hover:scale-105 transition-transform uppercase italic">
            <Link href="/dashboard">Explorar Marcas</Link>
          </Button>
        </div>
      ) : (eventsLoading && !rawEvents) ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
      ) : !events || events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-border gap-6 shadow-sm mx-4">
          <div className="text-center space-y-2">
            <Inbox className="w-10 h-10 mx-auto opacity-10" />
            <p className="text-xl font-bold">Tudo em dia!</p>
            <p className="text-sm text-muted-foreground">
              As marcas que você segue ainda não publicaram eventos novos.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-10 px-4">
          {events.map((event: any) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
