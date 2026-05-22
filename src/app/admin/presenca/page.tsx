
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  UserCheck, 
  Loader2, 
  Search, 
  Calendar, 
  Clock, 
  Ticket, 
  Building2,
  Users,
  CheckCircle2,
  ArrowUpRight,
  FilterX,
  MapPin,
  CircleDot
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export default function AdminPresencaPage() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")

  const regsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, "registrations"), 
      orderBy("timestamp", "desc"),
      limit(200)
    )
  }, [db])

  const { data: registrations, loading } = useCollection<any>(regsQuery)

  const filteredRegs = React.useMemo(() => {
    if (!registrations) return []
    return registrations.filter(reg => 
      (reg.userName?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (reg.eventTitle?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (reg.ticketCode?.toLowerCase() || "").includes(search.toLowerCase())
    )
  }, [registrations, search])

  const stats = React.useMemo(() => {
    if (!registrations) return { total: 0, checkedIn: 0, today: 0 }
    
    const now = new Date()
    const todayStr = now.toDateString()

    return registrations.reduce((acc, reg) => {
      const regDate = reg.timestamp?.toDate ? reg.timestamp.toDate() : new Date(reg.timestamp)
      if (regDate.toDateString() === todayStr) acc.today++
      if (reg.checkedIn) acc.checkedIn++
      acc.total++
      return acc
    }, { total: 0, checkedIn: 0, today: 0 })
  }, [registrations])

  const formatTime = (ts: any) => {
    if (!ts) return "---"
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts)
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    } catch (e) { return "---" }
  }

  const formatDate = (ts: any) => {
    if (!ts) return "---"
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts)
      return d.toLocaleDateString('pt-BR')
    } catch (e) { return "---" }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <UserCheck className="w-8 h-8 text-secondary" />
          Monitoramento de Presença
        </h1>
        <p className="text-muted-foreground font-medium">Acompanhe as entradas e o fluxo de público em todos os eventos da plataforma.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-white border-l-4 border-secondary">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">Total de Check-ins (Histórico)<CheckCircle2 className="w-3 h-3 text-secondary" /></CardTitle></CardHeader>
          <CardContent>
             <div className="text-3xl font-black text-primary">{stats.checkedIn}</div>
             <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Participantes que já entraram</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest flex justify-between">Movimentação Hoje<CircleDot className="w-3 h-3 text-secondary animate-pulse" /></CardTitle></CardHeader>
          <CardContent>
             <div className="text-3xl font-black">{stats.today}</div>
             <p className="text-[9px] font-bold opacity-40 uppercase mt-1">Novas interações registradas hoje</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-l-4 border-green-500">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">Taxa de Comparecimento<ArrowUpRight className="w-3 h-3 text-green-500" /></CardTitle></CardHeader>
          <CardContent>
             <div className="text-3xl font-black text-green-600">{stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0}%</div>
             <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Entradas vs Total de Ingressos</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por participante, evento ou código..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>
        <Button 
          variant="outline" 
          className="h-12 rounded-xl border-dashed"
          onClick={() => setSearch("")}
        >
          <FilterX className="w-4 h-4 mr-2" /> Limpar
        </Button>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
          ) : filteredRegs.length > 0 ? (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Participante</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Evento / Marca</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Status</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Entrada em</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-right p-6">Código</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegs.map((reg) => (
                  <TableRow key={reg.id} className={cn("hover:bg-muted/10 transition-colors", reg.checkedIn && "bg-green-50/20")}>
                    <TableCell className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-black">
                           {reg.userName?.charAt(0) || "U"}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-xs">{reg.userName}</span>
                          <span className="text-[9px] text-muted-foreground">{reg.userEmail}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-black text-[10px] text-primary uppercase italic truncate max-w-[200px]">{reg.eventTitle}</span>
                        <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground uppercase">
                           <Building2 className="w-2.5 h-2.5" />
                           {reg.organizer?.name || "Organização"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "text-[9px] font-black uppercase px-2 h-5",
                        reg.checkedIn ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                      )}>
                        {reg.checkedIn ? "Presente" : "Aguardando"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                         <span className="text-[10px] font-bold text-primary">{reg.checkedIn ? formatDate(reg.checkedInAt) : "---"}</span>
                         <span className="text-[9px] font-black text-secondary">{reg.checkedIn ? formatTime(reg.checkedInAt) : ""}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right p-6">
                      <span className="text-[10px] font-mono font-bold text-muted-foreground">{reg.ticketCode}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-24 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-10" />
              <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-xs">Nenhuma presença registrada.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
