
"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Plus, MoreHorizontal, Globe, Loader2, Calendar as CalendarIcon, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"

export default function MeusEventosPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  const myEventsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "events"), where("organizerId", "==", user.uid))
  }, [db, user])

  const { data: events, loading } = useCollection<any>(myEventsQuery)

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Eventos</h1>
          <p className="text-muted-foreground">Gerencie seus anúncios e veja quem está interessado.</p>
        </div>
        
        <Button asChild className="gap-2 bg-secondary text-white hover:bg-secondary/90">
          <Link href="/dashboard/projetos/novo">
            <Plus className="w-4 h-4" />
            Novo Evento
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events?.map((event: any) => (
            <Card key={event.id} className="overflow-hidden border-border hover:border-secondary/50 transition-all group shadow-sm">
              <div className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <Badge variant={event.status === 'Concluído' ? 'secondary' : 'default'} className="rounded-full">
                    {event.status || "Ativo"}
                  </Badge>
                  <button className="text-muted-foreground">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-bold text-lg leading-tight group-hover:text-secondary transition-colors">{event.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">{event.shortDescription || event.description}</p>
                </div>

                <div className="flex items-center gap-4 py-2 border-y border-border">
                  <div className="flex items-center gap-1 text-xs font-semibold">
                    <CalendarIcon className="w-3.5 h-3.5 text-secondary" />
                    <span>{event.startDate ? new Date(event.startDate).toLocaleDateString('pt-BR') : 'Data não definida'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold">
                    <MapPin className="w-3.5 h-3.5 text-secondary" />
                    <span>{event.city || "Local não definido"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button variant="outline" size="sm" className="text-xs h-8">Editar Anúncio</Button>
                  <Button variant="secondary" size="sm" className="text-xs h-8">Ver Público</Button>
                </div>
              </div>
            </Card>
          ))}

          <Link 
            href="/dashboard/projetos/novo"
            className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-secondary/50 hover:text-secondary transition-all"
          >
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-bold">Novo Evento</span>
          </Link>
        </div>
      )}
    </div>
  )
}
