"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { Eye, MousePointer2, Share2, TrendingUp } from "lucide-react"

const chartData = [
  { name: 'Seg', valor: 2400 },
  { name: 'Ter', valor: 1300 },
  { name: 'Qua', valor: 3600 },
  { name: 'Qui', valor: 4800 },
  { name: 'Sex', valor: 3500 },
  { name: 'Sab', valor: 5900 },
  { name: 'Dom', valor: 1200 },
]

export default function ResultadosPage() {
  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Resultados de Divulgação</h1>
        <p className="text-muted-foreground">Analise o impacto das suas campanhas e o alcance dos seus eventos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: "Visualizações", value: "128.4K", icon: Eye, color: "text-blue-500" },
          { title: "Cliques no Link", value: "12.2K", icon: MousePointer2, color: "text-purple-500" },
          { title: "Compartilhamentos", value: "854", icon: Share2, color: "text-green-500" },
          { title: "Taxa de Conversão", value: "4.8%", icon: TrendingUp, color: "text-orange-500" },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-[10px] text-muted-foreground mt-1 text-green-500">+15% vs mês anterior</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Visualizações Diárias</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis hide />
                <Tooltip
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 5 ? 'hsl(var(--secondary))' : 'hsl(var(--primary))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm flex flex-col justify-center p-8">
          <div className="space-y-6">
            <h3 className="text-xl font-bold">Origem do Tráfego</h3>
            <div className="space-y-4">
              {[
                { label: 'Instagram', value: '45%', color: 'bg-purple-500' },
                { label: 'Google Search', value: '30%', color: 'bg-blue-500' },
                { label: 'Direto / Viby', value: '15%', color: 'bg-secondary' },
                { label: 'Outros', value: '10%', color: 'bg-gray-400' },
              ].map((source) => (
                <div key={source.label} className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span>{source.label}</span>
                    <span>{source.value}</span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div className={cn("h-full", source.color)} style={{ width: source.value }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
