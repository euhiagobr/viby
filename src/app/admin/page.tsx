
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Tag, 
  Users, 
  Loader2, 
  LayoutDashboard, 
  BarChart3, 
  AlertTriangle, 
  EyeOff, 
  Wallet,
  Building2,
  Globe,
  Clock
} from "lucide-react"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"

export default function AdminDashboardPage() {
  const db = useFirestore()
  const { formatPrice, convertValue } = useCurrency()
  
  const eventsQuery = useMemoFirebase(() => db ? collection(db, "events") : null, [db])
  const usersQuery = useMemoFirebase(() => db ? collection(db, "users") : null, [db])
  const orgsQuery = useMemoFirebase(() => db ? collection(db, "organizations") : null, [db])
  const reportsQuery = useMemoFirebase(() => db ? collection(db, "reports") : null, [db])
  const regsQuery = useMemoFirebase(() => db ? collection(db, "registrations") : null, [db])

  const { data: events, loading: eventsLoading } = useCollection<any>(eventsQuery)
  const { data: users, loading: usersLoading } = useCollection<any>(usersQuery)
  const { data: orgs, loading: orgsLoading } = useCollection<any>(orgsQuery)
  const { data: reports, loading: reportsLoading } = useCollection<any>(reportsQuery)
  const { data: regs } = useCollection<any>(regsQuery)

  const stats = React.useMemo(() => {
    const hiddenOrgs = orgs?.filter((o: any) => o.status === 'Desativado' || o.status === 'Exclusão Programada').length || 0;
    
    // Consolidação Ponderada para Repasse Global - Utilizando BRL fixado se disponível
    const totalToPayBRL = regs?.reduce((acc: number, r: any) => {
      if (['Pago', 'Disponível'].includes(r.paymentStatus)) {
        // Prioriza o valor BRL fixado no ato da venda para auditoria correta
        if (r.priceBRL) {
           const netRate = (r.producerNetAmount || 0) / (r.price || 1);
           return acc + (r.priceBRL * netRate);
        }
        const cur = (r.currency || 'BRL') as CurrencyCode;
        return acc + convertValue(r.producerNetAmount || 0, cur, 'BRL');
      }
      return acc;
    }, 0) || 0;

    return [
      { 
        title: "Eventos Totais", 
        value: eventsLoading ? "..." : events?.length || "0", 
        icon: LayoutDashboard, 
        color: "text-blue-500", 
        bg: "bg-blue-50" 
      },
      { 
        title: "Páginas Ocultas", 
        value: orgsLoading ? "..." : hiddenOrgs, 
        icon: EyeOff, 
        color: "text-orange-500", 
        bg: "bg-orange-50" 
      },
      { 
        title: "Total Repasses BRL (Auditoria)", 
        value: formatPrice(totalToPayBRL, 'BRL'), 
        icon: Wallet, 
        color: "text-green-500", 
        bg: "bg-green-50" 
      },
      { 
        title: "Denúncias", 
        value: reportsLoading ? "..." : reports?.length || "0", 
        icon: AlertTriangle, 
        color: "text-red-500", 
        bg: "bg-red-50" 
      },
    ]
  }, [events, users, orgs, reports, regs, eventsLoading, orgsLoading, reportsLoading, convertValue, formatPrice]);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Visão Geral do Sistema</h1>
        <p className="text-muted-foreground">Monitoramento em tempo real (Consolidado Histórico em BRL).</p>
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
                      <p className="text-xl font-black">{stat.value}</p>
                   </div>
                </div>
             </CardContent>
          </Card>
        ))}
      </div>

      <div className="p-4 bg-muted/30 rounded-2xl border border-dashed flex items-center gap-3 max-w-fit">
         <Clock className="w-5 h-5 text-secondary" />
         <p className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">O balanço unificado utiliza as cotações congeladas no ato de cada venda para fins fiscais e imutabilidade.</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="overview" className="gap-2 rounded-lg font-bold">
            <BarChart3 className="w-4 h-4" />
            Métricas de Crescimento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/20">
            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground font-medium italic">Gráficos de atividade em tempo real carregando...</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
