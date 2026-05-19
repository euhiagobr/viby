
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
  Filter
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function AdminSuportePage() {
  const db = useFirestore()

  const ticketsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "support_tickets"), orderBy("updatedAt", "desc"))
  }, [db])

  const { data: tickets, loading } = useCollection<any>(ticketsQuery)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Não lida': return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">Não lida</Badge>
      case 'Em tratamento': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Em tratamento</Badge>
      case 'Respondida': return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Respondida</Badge>
      case 'Encerrada': return <Badge variant="secondary" className="opacity-50">Encerrada</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Suporte</h1>
        <p className="text-muted-foreground">Monitore e responda às solicitações de ajuda dos usuários.</p>
      </div>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b pb-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-secondary" />
              Fila de Chamados
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="font-bold">{tickets?.length || 0} Total</Badge>
              <Badge className="bg-orange-500 font-bold">{tickets?.filter((t:any) => t.status === 'Não lida').length || 0} Pendentes</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
          ) : !tickets || tickets.length === 0 ? (
            <div className="p-20 text-center text-muted-foreground italic">Nenhum ticket encontrado.</div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
