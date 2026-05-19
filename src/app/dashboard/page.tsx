
"use client"

import * as React from "react"
import { useCollection, useFirestore } from "@/firebase"
import { collection } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { Button } from "@/components/ui/button"
import { Search, Filter, Loader2 } from "lucide-react"
import { useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Event } from "@/lib/mock-data"

export default function ExplorarPage() {
  const [filter, setFilter] = useState('all')
  const db = useFirestore()
  
  // Hook para buscar eventos em tempo real do Firestore
  const { data: events, loading, error } = useCollection<Event>(
    db ? collection(db, "events") : null
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Explorar Eventos</h1>
          <p className="text-muted-foreground">Descubra o que está acontecendo e como divulgar melhor seus eventos.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por tema..." className="pl-10" />
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
            <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary rounded-none px-0 py-2">Tendências</TabsTrigger>
            <TabsTrigger value="nearby" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary rounded-none px-0 py-2">Perto de Você</TabsTrigger>
            <TabsTrigger value="new" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary rounded-none px-0 py-2">Recém Lançados</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
      )}

      {error && (
        <div className="p-8 text-center bg-destructive/10 text-destructive rounded-xl border border-destructive/20">
          Erro ao carregar eventos: {error.message}
        </div>
      )}

      {!loading && !error && events?.length === 0 && (
        <div className="text-center py-20 bg-muted/50 rounded-2xl border-2 border-dashed border-border">
          <p className="text-muted-foreground font-medium">Nenhum evento encontrado no Firestore.</p>
          <p className="text-xs text-muted-foreground mt-1">Certifique-se de adicionar documentos na coleção 'events'.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events?.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  )
}
