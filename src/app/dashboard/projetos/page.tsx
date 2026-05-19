"use client"

import { MOCK_EVENTS, Event } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Plus, MoreHorizontal } from "lucide-react"

export default function ProjetosPage() {
  const columns: { title: Event['status']; events: Event[] }[] = [
    { title: 'A fazer', events: MOCK_EVENTS.filter(e => e.status === 'A fazer') },
    { title: 'Em progresso', events: MOCK_EVENTS.filter(e => e.status === 'Em progresso') },
    { title: 'Concluído', events: MOCK_EVENTS.filter(e => e.status === 'Concluído') },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Projetos</h1>
        <p className="text-muted-foreground">Organize o fluxo de trabalho de cada evento em etapas.</p>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide min-h-[600px]">
        {columns.map((column) => (
          <div key={column.title} className="flex-shrink-0 w-80 space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">{column.title}</h3>
                <Badge variant="secondary" className="rounded-full">{column.events.length}</Badge>
              </div>
              <button className="text-muted-foreground hover:text-foreground">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {column.events.map((event) => (
                <Card key={event.id} className="p-4 cursor-grab active:cursor-grabbing border-border hover:border-secondary/50 transition-colors shadow-sm">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <Badge className={
                        event.type === 'Governo' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                        event.type === 'Privado' ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' :
                        'bg-orange-100 text-orange-700 hover:bg-orange-100'
                      }>
                        {event.type}
                      </Badge>
                      <button className="text-muted-foreground">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                    <h4 className="font-bold leading-tight">{event.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex -space-x-2">
                        {[1, 2].map((i) => (
                          <div key={i} className="w-6 h-6 rounded-full border-2 border-background bg-secondary flex items-center justify-center text-[10px] font-bold text-white">
                            {String.fromCharCode(64 + i)}
                          </div>
                        ))}
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground">{event.city}</span>
                    </div>
                  </div>
                </Card>
              ))}
              <button className="w-full py-3 border-2 border-dashed border-border rounded-xl text-muted-foreground text-sm font-medium hover:border-secondary/50 hover:text-secondary transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Adicionar Card
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
