"use client"

import { ContributionGraph } from "@/components/productivity/ContributionGraph"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MOCK_STATS } from "@/lib/mock-data"
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
import { Flame, MessageSquare, Zap, Star } from "lucide-react"

const chartData = [
  { name: 'Seg', valor: 400 },
  { name: 'Ter', valor: 300 },
  { name: 'Qua', valor: 600 },
  { name: 'Qui', valor: 800 },
  { name: 'Sex', valor: 500 },
  { name: 'Sab', valor: 900 },
  { name: 'Dom', valor: 200 },
]

export default function EstatisticasPage() {
  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Estatísticas</h1>
        <p className="text-muted-foreground">Analise sua produtividade e o engajamento dos seus eventos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: "Conversas Hoje", value: MOCK_STATS.conversasHoje, icon: MessageSquare, color: "text-blue-500" },
          { title: "Tokens Usados", value: MOCK_STATS.tokensUtilizados, icon: Zap, color: "text-yellow-500" },
          { title: "Satisfação", value: MOCK_STATS.satisfacao, icon: Star, color: "text-orange-500" },
          { title: "Streak Dias", value: MOCK_STATS.streaks, icon: Flame, color: "text-red-500" },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-[10px] text-muted-foreground mt-1">+12% em relação a ontem</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Interações da IA</CardTitle>
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
                    <Cell key={`cell-${index}`} fill={index === 5 ? '#007bff' : '#000000'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <ContributionGraph />
          <Card className="bg-primary text-primary-foreground border-none overflow-hidden relative shadow-lg">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-2">Meta de Vendas</h3>
              <p className="opacity-80 mb-6">Você atingiu 85% da sua meta mensal de vendas de ingressos.</p>
              <div className="w-full bg-white/20 h-4 rounded-full overflow-hidden mb-4">
                <div className="bg-secondary h-full transition-all duration-1000" style={{ width: '85%' }} />
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span>R$ 42.500</span>
                <span>R$ 50.000</span>
              </div>
              <Zap className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 rotate-12" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
