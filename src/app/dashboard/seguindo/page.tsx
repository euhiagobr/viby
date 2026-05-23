
"use client"

import * as React from "react"
import { useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, limit } from "firebase/firestore"
import { EventTimelineCard } from "@/components/events/EventTimelineCard"
import { Loader2, Heart, Users, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function TenhoInteressePage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

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

  // 2. Buscar eventos dessas organizações
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
    return [...rawEvents].sort((a, b) => {
      const dateA = a.createdAt?.seconds || new Date(a.createdAt).getTime() / 1000 || 0
      const dateB = b.createdAt?.seconds || new Date(b.createdAt).getTime() / 1000 || 0
      return dateB - dateA
    })
  }, [rawEvents])

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
              Siga seus produtores favoritos para ver as publicações deles aqui no estilo timeline.
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
            <p className="text-xl font-bold">Tudo em dia!</p>
            <p className="text-sm text-muted-foreground">
              As marcas que você segue ainda não publicaram eventos novos.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-10 px-4">
          {events.map((event: any) => (
            <EventTimelineCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
