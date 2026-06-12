
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, where, updateDoc, doc, limit } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Users, 
  Loader2, 
  Search, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Mail, 
  Instagram,
  Building2,
  FilterX,
  RefreshCw,
  TrendingUp,
  Inbox,
  ChevronRight,
  MoreVertical
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function AdminLeadsPage() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null)

  const leadsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "organizer_leads"), orderBy("createdAt", "desc"), limit(200))
  }, [db])

  const { data: leads, loading } = useCollection<any>(leadsQuery)

  const filteredLeads = React.useMemo(() => {
    if (!leads) return []
    return leads.filter(l => {
      const matchSearch = !search || 
        l.nome?.toLowerCase().includes(search.toLowerCase()) || 
        l.email?.toLowerCase().includes(search.toLowerCase()) ||
        l.empresa?.toLowerCase().includes(search.toLowerCase());
      
      const matchStatus = statusFilter === 'all' || l.status === statusFilter;
      
      return matchSearch && matchStatus;
    })
  }, [leads, search, statusFilter])

  const handleUpdateStatus = async (leadId: string, status: string) => {
    if (!db) return
    setIsUpdating(leadId)
    try {
      await updateDoc(doc(db, "organizer_leads", leadId), { status, updatedAt: new Date() })
      toast({ title: "Status atualizado!" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar" })
    } finally {
      setIsUpdating(null)
    }
  }

  const metrics = React.useMemo(() => {
    if (!leads) return { total: 0, new: 0, converted: 0, rate: 0 }
    const total = leads.length
    const news = leads.filter((l:any) => l.status === 'novo').length
    const converted = leads.filter((l:any) => l.status === 'convertido').length
    const rate = total > 0 ? (converted / total) * 100 : 0
    return { total, new: news, converted, rate }
  }, [leads])

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Users className="w-8 h-8 text-secondary" />
          Leads de Organizadores
        </h1>
        <p className="text-muted-foreground font-medium">Gestão de potenciais clientes captados via landing page.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <MetricCard label="Total de Leads" value={metrics.total} icon={Inbox} color="blue" />
         <MetricCard label="Novos Hoje" value={metrics.new} icon={Clock} color="orange" />
         <MetricCard label="Convertidos" value={metrics.converted} icon={CheckCircle2} color="green" />
         <MetricCard label="Taxa de Conversão" value={`${metrics.rate.toFixed(1)}%`} icon={TrendingUp} color="secondary" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, e-mail ou empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-12 rounded-xl" />
        </div>
        <div className="flex items-center gap-3">
           <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 h-12 rounded-xl border-dashed border-secondary/30">
                 <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                 <SelectItem value="all">Todos os Status</SelectItem>
                 <SelectItem value="novo">Novos</SelectItem>
                 <SelectItem value="contatado">Contatados</SelectItem>
                 <SelectItem value="negociando">Negociando</SelectItem>
                 <SelectItem value="convertido">Convertidos</SelectItem>
                 <SelectItem value="encerrado">Encerrados</SelectItem>
              </SelectContent>
           </Select>
           <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => { setSearch(""); setStatusFilter("all"); }}><FilterX className="w-4 h-4" /></Button>
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Lead / Empresa</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest">Contato</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest">Evento / Público</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Status</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] tracking-widest p-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
            ) : filteredLeads.length > 0 ? (
              filteredLeads.map((lead) => (
                <TableRow key={lead.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="p-6">
                    <div className="flex flex-col">
                       <span className="font-black text-sm uppercase italic text-primary">{lead.nome}</span>
                       <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                          <Building2 className="w-3 h-3" /> {lead.empresa || "Pessoa Física"}
                       </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                       <div className="flex items-center gap-2 text-[10px] font-medium"><Mail className="w-3 h-3 text-secondary" /> {lead.email}</div>
                       <div className="flex items-center gap-2 text-[10px] font-medium"><Phone className="w-3 h-3 text-green-600" /> {lead.whatsapp}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                       <Badge variant="outline" className="text-[8px] font-black uppercase w-fit h-4 border-primary/20 text-primary">{lead.tipoEvento}</Badge>
                       <span className="text-[9px] font-bold text-muted-foreground uppercase mt-1 italic">{lead.publicoMedio} pessoas</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                     <Select 
                       disabled={isUpdating === lead.id}
                       value={lead.status} 
                       onValueChange={(val) => handleUpdateStatus(lead.id, val)}
                     >
                        <SelectTrigger className={cn(
                          "h-7 rounded-lg text-[9px] font-black uppercase px-2 w-28 mx-auto",
                          lead.status === 'novo' ? "bg-orange-50 text-orange-600 border-orange-200" :
                          lead.status === 'convertido' ? "bg-green-50 text-green-600 border-green-200" : "bg-muted border-none"
                        )}>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                           <SelectItem value="novo" className="text-[10px] font-bold">NOVO</SelectItem>
                           <SelectItem value="contatado" className="text-[10px] font-bold">CONTATADO</SelectItem>
                           <SelectItem value="negociando" className="text-[10px] font-bold">NEGOCIANDO</SelectItem>
                           <SelectItem value="convertido" className="text-[10px] font-bold">CONVERTIDO</SelectItem>
                           <SelectItem value="encerrado" className="text-[10px] font-bold">ENCERRADO</SelectItem>
                        </SelectContent>
                     </Select>
                  </TableCell>
                  <TableCell className="p-6 text-right">
                    <Button variant="ghost" size="icon" className="rounded-full" title="Ver Detalhes">
                       <ChevronRight className="w-4 h-4 opacity-30" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="py-32 text-center opacity-30 italic"><Inbox className="w-12 h-12 mx-auto mb-4" />Nenhum lead localizado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, color }: any) {
   const colors: any = { 
     blue: "bg-blue-50 text-blue-600 border-blue-100", 
     orange: "bg-orange-50 text-orange-600 border-orange-100", 
     green: "bg-green-50 text-green-600 border-green-100", 
     secondary: "bg-secondary/5 text-secondary border-secondary/10" 
   };
   return (
      <Card className={cn("border-none shadow-sm rounded-[1.5rem] bg-white border-l-4", colors[color])}>
         <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
               <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
               <Icon className="w-4 h-4 opacity-40" />
            </div>
            <div className="text-2xl font-black text-primary">{value}</div>
         </CardContent>
      </Card>
   )
}
