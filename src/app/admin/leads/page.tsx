
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, doc, getDocs } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Users, 
  Loader2, 
  Search, 
  CheckCircle2, 
  Clock, 
  Building2,
  FilterX,
  TrendingUp,
  Inbox,
  ChevronRight,
  AlertTriangle,
  AtSign,
  User,
  Calendar,
  DollarSign
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
import { cn } from "@/lib/utils"
import Link from "next/link"
import { formatCurrency } from "@/lib/financial-utils"

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  novo: { label: 'NOVO', color: 'bg-blue-500' },
  sem_contato: { label: 'SEM CONTATO', color: 'bg-slate-500' },
  contatado: { label: 'CONTATADO', color: 'bg-cyan-500' },
  negociando: { label: 'NEGOCIANDO', color: 'bg-orange-500' },
  aguardando_retorno: { label: 'AGUARDANDO RETORNO', color: 'bg-purple-500' },
  convertido: { label: 'CONVERTIDO', color: 'bg-green-600' },
  perdido: { label: 'PERDIDO', color: 'bg-red-500' },
  arquivado: { label: 'ARQUIVADO', color: 'bg-slate-300' }
};

export default function AdminLeadsCRM() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")

  const leadsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "organizer_leads"), orderBy("createdAt", "desc"), limit(500))
  }, [db])

  const { data: leads, loading } = useCollection<any>(leadsQuery)

  const filteredLeads = React.useMemo(() => {
    if (!leads) return []
    return leads.filter(l => {
      const s = search.toLowerCase();
      const matchSearch = !search || 
        l.nome?.toLowerCase().includes(s) || 
        l.email?.toLowerCase().includes(s) ||
        l.empresa?.toLowerCase().includes(s) ||
        l.whatsapp?.includes(s) ||
        l.instagram?.toLowerCase().includes(s);
      
      const matchStatus = statusFilter === 'all' || l.status === statusFilter;
      
      return matchSearch && matchStatus;
    })
  }, [leads, search, statusFilter])

  const metrics = React.useMemo(() => {
    if (!leads) return { total: 0, noContact: 0, contacted: 0, negotiating: 0, converted: 0, lost: 0, rate: 0 };
    const total = leads.length;
    const noContact = leads.filter((l:any) => l.status === 'sem_contato' || l.status === 'novo').length;
    const contacted = leads.filter((l:any) => l.status === 'contatado').length;
    const negotiating = leads.filter((l:any) => l.status === 'negociando').length;
    const converted = leads.filter((l:any) => l.status === 'convertido').length;
    const lost = leads.filter((l:any) => l.status === 'perdido').length;
    const rate = total > 0 ? (converted / total) * 100 : 0;
    return { total, noContact, contacted, negotiating, converted, lost, rate };
  }, [leads]);

  const now = new Date();
  const overdueFollowUps = leads?.filter((l:any) => {
    if (!l.proximoFollowUp) return false;
    const d = l.proximoFollowUp.toDate ? l.proximoFollowUp.toDate() : new Date(l.proximoFollowUp);
    return d < now && l.status !== 'convertido' && l.status !== 'perdido' && l.status !== 'arquivado';
  }).length || 0;

  if (loading) return <div className="py-32 flex flex-col items-center gap-4"><Loader2 className="animate-spin text-secondary w-12 h-12" /><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Carregando CRM...</p></div>

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-secondary" />
          CRM Comercial Viby
        </h1>
        <p className="text-muted-foreground font-medium">Gestão de funil de vendas e conversão de organizadores.</p>
      </div>

      {overdueFollowUps > 0 && (
        <Card className="border-none shadow-sm bg-orange-50 border-l-8 border-orange-500 rounded-2xl animate-in zoom-in-95">
           <CardContent className="p-6 flex items-center gap-4">
              <AlertTriangle className="w-8 h-8 text-orange-600" />
              <div className="space-y-0.5">
                 <h3 className="text-sm font-black uppercase text-orange-800 italic">Atenção Comercial</h3>
                 <p className="text-xs font-medium text-orange-700 uppercase">Você possui {overdueFollowUps} follow-ups vencidos aguardando ação imediata.</p>
              </div>
           </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
         <KPICard label="Total" value={metrics.total} color="blue" />
         <KPICard label="Novos/S.Contato" value={metrics.noContact} color="slate" />
         <KPICard label="Contatados" value={metrics.contacted} color="cyan" />
         <KPICard label="Negociando" value={metrics.negotiating} color="orange" />
         <KPICard label="Convertidos" value={metrics.converted} color="green" />
         <KPICard label="Perdidos" value={metrics.lost} color="red" />
         <KPICard label="Taxa" value={`${metrics.rate.toFixed(1)}%`} color="secondary" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Nome, Empresa, WhatsApp, E-mail..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-12 rounded-xl" />
        </div>
        <div className="flex items-center gap-2">
           <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 h-12 rounded-xl border-dashed border-secondary/30">
                 <SelectValue placeholder="Status do Funil" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                 <SelectItem value="all">Todos os Leads</SelectItem>
                 {Object.entries(STATUS_CONFIG).map(([val, conf]) => (
                   <SelectItem key={val} value={val}>{conf.label}</SelectItem>
                 ))}
              </SelectContent>
           </Select>
           <Button variant="ghost" size="icon" className="rounded-xl h-11 w-11" onClick={() => { setSearch(""); setStatusFilter("all"); }}><FilterX className="w-4 h-4" /></Button>
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[9px] tracking-widest p-6">Lead / Empresa</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest">Contato</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Status / Resp.</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Follow-up</TableHead>
              <TableHead className="text-right font-black uppercase text-[9px] tracking-widest p-6">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length > 0 ? filteredLeads.map((lead) => {
              const status = STATUS_CONFIG[lead.status] || { label: lead.status || 'NOVO', color: 'bg-slate-400' };
              const followUp = lead.proximoFollowUp?.toDate ? lead.proximoFollowUp.toDate() : (lead.proximoFollowUp ? new Date(lead.proximoFollowUp) : null);
              const isOverdue = followUp && followUp < now && lead.status !== 'convertido';
              
              return (
                <TableRow key={lead.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="p-6">
                    <div className="flex flex-col">
                       <span className="font-black text-sm uppercase italic text-primary">{lead.nome}</span>
                       <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                          <Building2 className="w-3 h-3" /> {lead.empresa || "Pessoa Física"}
                       </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                       <div className="flex items-center gap-2 text-[10px] font-medium"><AtSign className="w-3 h-3 text-secondary" /> {lead.instagram || lead.email}</div>
                       <div className="flex items-center gap-2 text-[10px] font-bold text-primary"><Users className="w-3 h-3 text-green-600" /> {lead.whatsapp}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                     <div className="flex flex-col items-center gap-1">
                        <Badge className={cn("text-[8px] font-black uppercase h-5 px-2", status.color)}>{status.label}</Badge>
                        <span className="text-[8px] font-bold text-muted-foreground uppercase">{lead.responsavel || "Sem Resp."}</span>
                     </div>
                  </TableCell>
                  <TableCell className="text-center">
                     {followUp ? (
                       <div className={cn(
                         "flex flex-col items-center gap-0.5",
                         isOverdue ? "text-red-500" : "text-muted-foreground"
                       )}>
                          <Clock className="w-3 h-3" />
                          <span className="text-[9px] font-black">{followUp.toLocaleDateString('pt-BR')}</span>
                       </div>
                     ) : <span className="text-[8px] opacity-20 uppercase font-bold">Não agendado</span>}
                  </TableCell>
                  <TableCell className="p-6 text-right">
                    <Button asChild variant="secondary" size="sm" className="h-9 rounded-xl font-black uppercase italic text-[10px] gap-2">
                       <Link href={`/admin/leads/${lead.id}`}>Ver Lead <ChevronRight className="w-3.5 h-3.5" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow><TableCell colSpan={5} className="py-32 text-center opacity-30 italic"><Inbox className="w-12 h-12 mx-auto mb-4" />Nenhum lead localizado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

function KPICard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    blue: "text-blue-500 bg-blue-50",
    slate: "text-slate-600 bg-slate-50",
    cyan: "text-cyan-600 bg-cyan-50",
    orange: "text-orange-500 bg-orange-50",
    green: "text-green-600 bg-green-50",
    red: "text-red-500 bg-red-50",
    secondary: "text-secondary bg-secondary/5"
  };
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white flex flex-col items-center justify-center p-3 text-center">
       <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest mb-1">{label}</p>
       <div className={cn("px-2 py-0.5 rounded-lg text-lg font-black italic", colors[color])}>{value}</div>
    </Card>
  );
}
