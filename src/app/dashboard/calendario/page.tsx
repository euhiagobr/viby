"use client"

import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import { MOCK_EVENTS } from "@/lib/mock-data"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarIcon, Clock, MapPin } from "lucide-react"

export default function CalendarioPage() {
  const [date, setDate] = React.useState<Date | undefined>(new Date())

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Calendário</h1>
        <p className="text-muted-foreground">Visão temporal de todos os seus eventos planejados.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 bg-card rounded-xl border border-border p-6 shadow-sm h-fit">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md border-none"
            classNames={{
              day_selected: "bg-secondary text-white hover:bg-secondary focus:bg-secondary",
              day_today: "bg-muted text-foreground font-bold"
            }}
          />
        </div>

        <div className="lg:col-span-8 space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            Próximos Eventos
          </h2>
          <div className="space-y-4">
            {MOCK_EVENTS.map(event => (
              <Card key={event.id} className="p-4 flex flex-col md:flex-row gap-6 border-border hover:border-secondary/30 transition-all group shadow-sm">
                <div className="flex-shrink-0 w-full md:w-32 flex flex-col items-center justify-center bg-muted rounded-lg p-4 group-hover:bg-secondary/10 transition-colors">
                  <span className="text-xs font-bold text-muted-foreground uppercase">{event.date.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                  <span className="text-3xl font-bold">{event.date.getDate()}</span>
                </div>
                <div className="flex-grow space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold">{event.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 18:00</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {event.location}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-secondary text-secondary">{event.type}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {event.batches.map(batch => (
                      <Badge key={batch.id} variant="secondary" className="text-[10px] font-bold">
                        {batch.name}: R$ {batch.price}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
