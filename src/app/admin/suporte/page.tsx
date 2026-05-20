
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  LifeBuoy, 
  Loader2, 
  MessageSquare, 
  Clock, 
  ChevronRight,
  User,
  Filter,
  Inbox,
  CheckCircle2,
  Archive,
  Search
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function AdminSuportePage() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")

  const ticketsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "support_tickets"), orderBy("updatedAt", "desc"))
  }, [db])

  const { data: tickets, loading } = useCollection<any>(ticketsQuery)

  const filteredTickets = React.useMemo(() => {
    if (!tickets) return []
    return tickets.filter(t => 
      (t.subject?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (t.userName?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (t.protocol || "").includes(search)
    )
  }, [tickets, search])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Não lida': return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">Não lida</Badge>
      case 'Em tratamento': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Em tratamento</Badge>
      case 'Respondida': return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Respondida</Badge>
      case 'Encerrada': return <Badge variant="secondary" className="opacity-50">Encerrada</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const pendingTickets = filteredTickets.filter(t => t.status === 'Não lida' || t.status === 'Em tratamento')
  const respondedTickets = filteredTickets.filter(t => t.status === 'Respondida')
  const closedTickets = filteredTickets.filter(t => t.status === 'Encerrada')

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Suporte</h1>
        <p className="text-muted-foreground">Monitore e responda às solicitações de ajuda dos usuários.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por protocolo, assunto ou usuário..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="font-bold py-1.5 px-4 rounded-full">{tickets?.length || 0} Total</Badge>
          <Badge className="bg-orange-500 font-bold py-1.5 px-4 rounded-full">
            {tickets?.filter((t:any) => t.status === 'Não lida').length || 0} Pendentes
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12">
          <TabsTrigger value="pending" className="rounded-lg px-6 font-bold gap-2">
            <Clock className="w-4 h-4" />
            Pendentes ({pendingTickets.length})
          </TabsTrigger>
          <TabsTrigger value="responded" className="rounded-lg px-6 font-bold gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Respondidos ({respondedTickets.length})
          </TabsTrigger>
          <TabsTrigger value="closed" className="rounded-lg px-6 font-bold gap-2">
            <Archive className="w-4 h-4" />
            Encerrados ({closedTickets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="animate-in fade-in duration-300">
           <TicketList tickets={pendingTickets} loading={loading} getStatusBadge={getStatusBadge} />
        </TabsContent>

        <TabsContent value="responded" className="animate-in fade-in duration-300">
           <TicketList tickets={respondedTickets} loading={loading} getStatusBadge={getStatusBadge} />
        </TabsContent>

        <TabsContent value="closed" className="animate-in fade-in duration-300">
           <TicketList tickets={closedTickets} loading={loading} getStatusBadge={getStatusBadge} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TicketList({ tickets, loading, getStatusBadge }: { tickets: any[], loading: boolean, getStatusBadge: (s: string) => React.ReactNode }) {
  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
  
  if (tickets.length === 0) {
    return (
      <Card className="border-none shadow-sm rounded-2xl bg-white p-12 text-center">
        <Inbox className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
        <p className="text-muted-foreground font-medium italic">Nenhum ticket encontrado nesta categoria.</p>
      </Card>
    )
  }

  return (
    <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
      <div className="divide-y">
        {tickets.map((ticket: any) => (
          <Link key={ticket.id} href={`/admin/suporte/${ticket.id}`} className="block hover:bg-muted/30 transition-colors">
            <div className="p-6 flex items-center justify-between">
              <div className="flex gap-4">
                <div className={cn(
                  "w-1 h-12 rounded-full",
                  ticket.status === 'Não lida' ? "bg-orange-500" : 
                  ticket.status === 'Respondida' ? "bg-green-500" : "bg-muted"
                )} />
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-muted-foreground tracking-widest">#{ticket.protocol}</span>
                    {getStatusBadge(ticket.status)}
                  </div>
                  <h3 className="font-bold text-base leading-tight">{ticket.subject}</h3>
                  <div className="flex items-center gap-4 text-[10px] font-bold uppercase text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {ticket.userName}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Atualizado {ticket.updatedAt?.toDate?.()?.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
            </div>
          </Link>
        ))}
      </div>
    </Card>
  )
}
