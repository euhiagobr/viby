"use client"

import { MOCK_EVENTS } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Plus, MoreHorizontal, Eye, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function MeusEventosPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Eventos</h1>
          <p className="text-muted-foreground">Gerencie a visibilidade e o status de publicação dos seus eventos.</p>
        </div>
        <Button className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90">
          <Plus className="w-4 h-4" />
          Criar Novo Evento
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_EVENTS.map((event) => (
          <Card key={event.id} className="overflow-hidden border-border hover:border-secondary/50 transition-all group shadow-sm">
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-start">
                <Badge variant={event.status === 'Concluído' ? 'secondary' : 'default'} className="rounded-full">
                  {event.status === 'Concluído' ? 'Publicado' : 'Rascunho'}
                </Badge>
                <button className="text-muted-foreground">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-bold text-lg leading-tight group-hover:text-secondary transition-colors">{event.title}</h4>
                <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
              </div>

              <div className="flex items-center gap-4 py-2 border-y border-border">
                <div className="flex items-center gap-1 text-xs font-semibold">
                  <Eye className="w-3.5 h-3.5 text-secondary" />
                  <span>2.4K</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold">
                  <Globe className="w-3.5 h-3.5 text-secondary" />
                  <span>São Paulo, SP</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" size="sm" className="text-xs h-8">Editar Listagem</Button>
                <Button variant="secondary" size="sm" className="text-xs h-8">Ver Público</Button>
              </div>
            </div>
          </Card>
        ))}

        <button className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-secondary/50 hover:text-secondary transition-all">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
            <Plus className="w-6 h-6" />
          </div>
          <span className="font-bold">Anunciar novo evento</span>
        </button>
      </div>
    </div>
  )
}
