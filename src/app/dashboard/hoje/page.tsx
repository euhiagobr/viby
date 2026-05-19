"use client"

import { MOCK_EVENTS } from "@/lib/mock-data"
import { EventCard } from "@/components/events/EventCard"
import { Progress } from "@/components/ui/progress"
import { Megaphone, Users, MousePointer2, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DestaquesPage() {
  const featuredEvents = MOCK_EVENTS.slice(0, 2)

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Destaques da Semana</h1>
        <p className="text-muted-foreground">Eventos com maior engajamento e potencial de público.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-secondary" />
              Promoções Ativas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {featuredEvents.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </section>

          <section className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Performance de Divulgação</h3>
              <span className="text-xs font-bold text-secondary">Alcance Orgânico: +24%</span>
            </div>
            <div className="space-y-6">
              {[
                { label: "Engajamento nas Redes", value: 75, icon: Users },
                { label: "Cliques em Ingressos", value: 45, icon: MousePointer2 },
                { label: "Conversão de Leads", value: 60, icon: TrendingUp },
              ].map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </span>
                    <span className="font-bold">{item.value}%</span>
                  </div>
                  <Progress value={item.value} className="h-2" />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-lg bg-primary text-primary-foreground overflow-hidden relative">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Dica de Divulgação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <p className="text-sm opacity-90 leading-relaxed">
                "Eventos com descrições geradas por IA e imagens de alta qualidade têm 3.5x mais cliques que a média."
              </p>
              <button className="w-full py-2 bg-white text-primary rounded-lg font-bold text-sm hover:bg-opacity-90 transition-all">
                Otimizar Meus Eventos
              </button>
            </CardContent>
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-secondary/20 rounded-full blur-3xl" />
          </Card>

          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h3 className="font-bold mb-4">Canais de Divulgação</h3>
            <div className="space-y-4">
              {['Instagram Ads', 'Google Search', 'Viby Public Feed', 'E-mail Marketing'].map((canal) => (
                <div key={canal} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                  <span className="text-sm font-medium">{canal}</span>
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
