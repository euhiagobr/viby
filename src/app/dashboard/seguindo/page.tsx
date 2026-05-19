"use client"

import * as React from "react"
import { useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, orderBy, limit } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { Loader2, Heart, Users } from "lucide-react"
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

  // 2. Buscar eventos desses organizadores
  const eventsQuery = useMemoFirebase(() => {
    if (!db || followedIds.length === 0) return null
    // Firestore limit: 'in' query supports up to 30 items
    const slicedIds = followedIds.slice(0, 30)
    return query(
      collection(db, "events"), 
      where("organizerId", "in", slicedIds),
      where("status", "!=", "Excluído"),
      orderBy("status"), // Necessário por causa do filtro de desigualdade
      orderBy("createdAt", "desc"),
      limit(50)
    )
  }, [db, followedIds])

  const { data: events, loading: eventsLoading } = useCollection<any>(eventsQuery)

  if (followsLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Heart className="w-8 h-8 text-secondary fill-secondary" />
          Tenho Interesse
        </h1>
        <p className="text-muted-foreground font-medium">
          Feed exclusivo com eventos dos organizadores que você segue.
        </p>
      </div>

      {followedIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-border gap-6 shadow-sm">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
            <Users className="w-10 h-10 text-muted-foreground opacity-30" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-bold">Você ainda não segue ninguém.</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Siga seus produtores favoritos para ver as novidades deles aqui primeiro.
            </p>
          </div>
          <Button asChild className="bg-secondary text-white font-black px-10 h-12 rounded-full shadow-lg hover:scale-105 transition-transform">
            <Link href="/dashboard">Explorar Organizadores</Link>
          </Button>
        </div>
      ) : eventsLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
      ) : !events || events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-border gap-6 shadow-sm">
          <div className="text-center space-y-2">
            <p className="text-xl font-bold">Nenhum evento novo por enquanto.</p>
            <p className="text-sm text-muted-foreground">
              Os organizadores que você segue ainda não publicaram eventos recentes.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event: any) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
