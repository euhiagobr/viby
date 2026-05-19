"use client"

import { MOCK_EVENTS } from "@/lib/mock-data"
import { EventCard } from "@/components/events/EventCard"
import { Button } from "@/components/ui/button"
import { PlusCircle, Filter } from "lucide-react"
import { useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function DashboardInbox() {
  const [filter, setFilter] = useState('all')

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
          <p className="text-muted-foreground">Gerencie seus rascunhos e descubra novos eventos.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </Button>
          <Button className="gap-2 bg-primary">
            <PlusCircle className="w-4 h-4" />
            Novo Evento
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border pb-2">
        <Tabs defaultValue="all" onValueChange={setFilter} className="w-full">
          <TabsList className="bg-transparent h-auto p-0 gap-8">
            <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-2">Todos Eventos</TabsTrigger>
            <TabsTrigger value="drafts" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-2">Rascunhos</TabsTrigger>
            <TabsTrigger value="archived" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-2">Arquivados</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_EVENTS.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {MOCK_EVENTS.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <Inbox className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold">Nada por aqui ainda</h3>
          <p className="text-muted-foreground max-w-xs mx-auto">
            Comece criando seu primeiro evento ou explore a galeria pública.
          </p>
          <Button className="bg-primary">Criar Evento</Button>
        </div>
      )}
    </div>
  )
}
