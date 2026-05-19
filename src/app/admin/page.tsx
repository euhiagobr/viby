"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tag, Users, Loader2, LayoutDashboard, BarChart3, AlertTriangle } from "lucide-react"

export default function AdminDashboardPage() {
  const db = useFirestore()
  
  // Consultas reais para o dashboard
  const eventsQuery = useMemoFirebase(() => db ? collection(db, "events") : null, [db])
  const usersQuery = useMemoFirebase(() => db ? collection(db, "users") : null, [db])
  const categoriesQuery = useMemoFirebase(() => db ? collection(db, "categories") : null, [db])
  const reportsQuery = useMemoFirebase(() => db ? collection(db, "reports") : null, [db])

  const { data: events, loading: eventsLoading } = useCollection<any>(eventsQuery)
  const { data: users, loading: usersLoading } = useCollection<any>(usersQuery)
  const { data: categories, loading: categoriesLoading } = useCollection<any>(categoriesQuery)
  const { data: reports, loading: reportsLoading } = useCollection<any>(reportsQuery)

  const stats = [
    { 
      title: "Eventos Totais", 
      value: eventsLoading ? "..." : events?.length || "0", 
      icon: LayoutDashboard, 
      color: "text-blue-500", 
      bg: "bg-blue-50" 
    },
    { 
      title: "Usuários Ativos", 
      value: usersLoading ? "..." : users?.length || "0", 
      icon: Users, 
      color: "text-purple-500", 
      bg: "bg-purple-50" 
    },
    { 
      title: "Categorias", 
      value: categoriesLoading ? "..." : categories?.length || "0", 
      icon: Tag, 
      color: "text-orange-500", 
      bg: "bg-orange-50" 
    },
    { 
      title: "Denúncias", 
      value: reportsLoading ? "..." : reports?.length || "0", 
      icon: AlertTriangle, 
      color: "text-red-500", 
      bg: "bg-red-50" 
    },
  ]

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Visão Geral do Sistema</h1>
        <p className="text-muted-foreground">Monitoramento em tempo real da plataforma Viby Club.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm overflow-hidden group">
             <CardContent className="p-6">
                <div className="flex items-center justify-between">
                   <div className={stat.bg + " p-3 rounded-2xl group-hover:scale-110 transition-transform"}>
                      <stat.icon className={stat.color + " w-6 h-6"} />
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{stat.title}</p>
                      <p className="text-2xl font-black">{stat.value}</p>
                   </div>
                </div>
             </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="overview" className="gap-2 rounded-lg font-bold">
            <BarChart3 className="w-4 h-4" />
            Métricas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/20">
            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground font-medium italic">Gráficos de atividade em tempo real ativos.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}