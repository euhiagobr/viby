"use client"

import { MOCK_EVENTS } from "@/lib/mock-data"
import { EventCard } from "@/components/events/EventCard"
import { PomodoroTimer } from "@/components/productivity/PomodoroTimer"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Circle } from "lucide-react"

export default function HojePage() {
  const todayEvents = MOCK_EVENTS.slice(0, 2) // Simulating today's events

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Foco de Hoje</h1>
        <p className="text-muted-foreground">Mantenha o ritmo e complete suas metas de produção.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              Eventos Prioritários
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {todayEvents.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </section>

          <section className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Checklist de Produção</h3>
              <span className="text-xs font-bold text-secondary">60% Concluído</span>
            </div>
            <Progress value={60} className="h-2" />
            <div className="space-y-3 mt-4">
              {[
                { title: "Confirmar local com prefeitura", completed: true },
                { title: "Liberar 2º lote de ingressos", completed: true },
                { title: "Gerar descrição com IA", completed: true },
                { title: "Contratar segurança", completed: false },
                { title: "Definir mapa de calor", completed: false },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-all cursor-pointer group">
                  {item.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-secondary" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground group-hover:text-secondary" />
                  )}
                  <span className={item.completed ? "text-muted-foreground line-through" : "font-medium"}>
                    {item.title}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <PomodoroTimer />
          <div className="bg-primary text-primary-foreground rounded-xl p-6 space-y-4 shadow-lg">
            <h3 className="font-bold text-lg">Dica da Viby AI</h3>
            <p className="text-sm opacity-90 leading-relaxed">
              "Você tem 3 eventos agendados para este final de semana. Que tal gerar uma proposta comercial para novos patrocinadores agora?"
            </p>
            <button className="w-full py-2 bg-white text-primary rounded-lg font-bold text-sm hover:bg-opacity-90 transition-all">
              Gerar Proposta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
