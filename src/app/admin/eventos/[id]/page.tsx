"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useFirestore, useDoc, useCollection, useMemoFirebase, useAuth, useUser } from "@/firebase"
import { 
  doc, 
  collection, 
  query, 
  where, 
  orderBy 
} from "firebase/firestore"
import { 
  Loader2, 
  ExternalLink, 
  Search, 
  CalendarDays, 
  Trash2, 
  Edit2, 
  MapPin, 
  Clock, 
  RefreshCw, 
  AlertTriangle, 
  Ticket,
  ArrowLeft,
  Layers,
  Building2,
  ShieldCheck,
  TicketPercent,
  RotateCcw,
  CheckCircle2
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import { RefundDialog } from "@/components/tickets/RefundDialog"

const EventTicketsSection = ({ eventId }: { eventId: string }) => {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const [search, setSearch] = React.useState("")
  const [ticketToRefund, setTicketToRefund] = React.useState<any>(null)

  const registrationsQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(
      collection(db, "registrations"),
      where("eventId", "==", eventId),
      orderBy("timestamp", "desc")
    )
  }, [db, eventId])

  const { data: registrations, loading: isLoadingRegistrations } = useCollection<any>(registrationsQuery)

  const filteredRegistrations = React.useMemo(() => {
    if (!registrations) return []
    return registrations.filter(reg => 
      (reg.userName?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (reg.userEmail?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (reg.ticketCode?.toLowerCase() || "").includes(search.toLowerCase())
    )
  }, [registrations, search])

  if (isLoadingRegistrations) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  return (
    <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
      <CardHeader className="bg-white border-b pb-6 px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-secondary" />
              Gestão de Ingressos
            </CardTitle>
            <CardDescription>Total de {registrations?.length || 0} registros encontrados.</CardDescription>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Nome, e-mail ou código..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl h-11"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[250px] font-bold px-8">Participante</TableHead>
              <TableHead className="font-bold">Ingresso / Lote</TableHead>
              <TableHead className="font-bold text-center">Status</TableHead>
              <TableHead className="font-bold text-right">Valor</TableHead>
              <TableHead className="text-right font-bold px-8">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRegistrations.length > 0 ? (
              filteredRegistrations.map((reg) => {
                const isRefunded = reg.status === 'refunded' || reg.paymentStatus === 'Estornado' || reg.status === 'cancelled';
                const isCheckedIn = reg.checkedIn === true;

                return (
                  <TableRow key={reg.id} className={cn("hover:bg-muted/10 transition-colors", isRefunded && "opacity-50 grayscale bg-red-50/5")}>
                    <TableCell className="px-8">
                      <div className="flex flex-col">
                        <span className={cn("font-bold text-sm", isRefunded && "line-through")}>{reg.userName}</span>
                        <span className="text-[10px] font-mono text-secondary uppercase">{reg.ticketCode}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                         <span className="text-xs font-bold uppercase">{reg.ticketTypeName || "Geral"}</span>
                         <span className="text-[9px] text-muted-foreground font-black uppercase">{reg.batchName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "text-[9px] font-black uppercase h-5 px-2",
                        isRefunded ? "bg-red-500 text-white" : isCheckedIn ? "bg-green-600 text-white" : "bg-blue-500 text-white"
                      )}>
                        {isRefunded ? 'Estornado' : isCheckedIn ? 'Utilizado' : 'Ativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-black text-xs text-primary">
                      {formatCurrency(reg.price || 0)}
                    </TableCell>
                    <TableCell className="text-right px-8">
                      {!isRefunded && !isCheckedIn && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-red-50 rounded-full"
                          onClick={() => setTicketToRefund(reg)}
                          title="Estornar Ingresso"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      )}
                      {isCheckedIn && (
                        <div className="flex justify-end px-2" title="Check-in realizado">
                           <CheckCircle2 className="w-4 h-4 text-green-600 opacity-40" />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                  Nenhum registro localizado para este evento.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <RefundDialog 
        registration={ticketToRefund}
        isOpen={!!ticketToRefund}
        onOpenChange={(open) => !open && setTicketToRefund(null)}
        userRole="admin"
        executorUid={user?.uid || ''}
      />
    </Card>
  )
}

const EventCouponsSection = ({ eventId }: { eventId: string }) => {
  const db = useFirestore()

  const couponsQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(
      collection(db, "coupons"), 
      where("eventId", "==", eventId),
      orderBy("createdAt", "desc")
    )
  }, [db, eventId])

  const { data: coupons, loading } = useCollection<any>(couponsQuery)

  if (loading) return <div className="py-10 flex justify-center"><Loader2 className="animate-spin" /></div>

  return (
    <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
      <CardHeader className="bg-white border-b pb-6 px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
              <CardTitle className="text-xl">Cupons Ativos</CardTitle>
              <CardDescription>Códigos de desconto vinculados a este evento.</CardDescription>
           </div>
           <Button asChild className="bg-secondary text-white font-bold rounded-xl h-10">
              <Link href={`/dashboard/evento/${eventId}/cupons`}>Gerenciar Cupons</Link>
           </Button>
        </div>
      </CardHeader>
      <CardContent className="p-8">
         {coupons && coupons.length > 0 ? (
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {coupons.map((c: any) => (
                <div key={c.id} className="p-4 bg-muted/20 rounded-2xl border border-dashed border-border/60 flex justify-between items-center">
                   <div className="space-y-1">
                      <p className="font-black text-sm text-primary uppercase italic">{c.code}</p>
                      <p className="text-[10px] font-bold text-secondary uppercase">{c.discountType === 'percentage' ? `${c.discountValue}% OFF` : `R$ ${c.discountValue} OFF`}</p>
                   </div>
                   <Badge variant="outline" className="text-[9px] font-black">{c.currentUses || 0} usos</Badge>
                </div>
              ))}
           </div>
         ) : (
           <div className="py-10 text-center opacity-30 italic text-sm">Nenhum cupom cadastrado.</div>
         )}
      </CardContent>
    </Card>
  )
}

function DetailItem({ label, value, icon: Icon }: any) {
  return (
    <div className="flex items-center gap-3">
       <div className="p-2 bg-muted rounded-lg text-secondary"><Icon className="w-4 h-4" /></div>
       <div>
          <p className="text-[8px] font-black uppercase opacity-40 leading-none mb-1">{label}</p>
          <p className="text-xs font-bold text-primary truncate max-w-[180px]">{value}</p>
       </div>
    </div>
  )
}

export default function AdminEventoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const db = useFirestore()

  const eventRef = React.useMemo(() => {
    if (!db || !id) return null
    return doc(db, "events", id)
  }, [db, id])

  const { data: event, loading } = useDoc<any>(eventRef)

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "---";
    try {
      let d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return "---"; }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertTriangle className="w-12 h-12 text-destructive opacity-30" />
        <h2 className="text-xl font-bold">Evento não encontrado</h2>
        <Button asChild><Link href="/admin/eventos">Voltar para Listagem</Link></Button>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
           <Button variant="ghost" size="icon" asChild className="rounded-full">
             <Link href="/admin/eventos"><ArrowLeft className="w-5 h-5" /></Link>
           </Button>
           <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">
              Gestão: {event.title}
           </h1>
        </div>
        <p className="text-muted-foreground font-medium ml-14">
          Monitoramento administrativo de vendas e cupons para este projeto.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
           <Tabs defaultValue="tickets" className="w-full">
              <TabsList className="bg-muted/50 p-1 rounded-xl h-12 mb-6">
                <TabsTrigger value="tickets" className="rounded-lg px-8 font-bold gap-2"><Ticket className="w-4 h-4" /> Ingressos</TabsTrigger>
                <TabsTrigger value="coupons" className="rounded-lg px-8 font-bold gap-2"><TicketPercent className="w-4 h-4" /> Cupons</TabsTrigger>
              </TabsList>
              
              <TabsContent value="tickets" className="mt-0">
                <EventTicketsSection eventId={id} />
              </TabsContent>
              
              <TabsContent value="coupons" className="mt-0">
                <EventCouponsSection eventId={id} />
              </TabsContent>
           </Tabs>
        </div>

        <aside className="lg:col-span-4 space-y-6">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
              <div className="space-y-4">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b pb-2">Detalhes do Evento</h3>
                 <div className="grid grid-cols-1 gap-4">
                    <DetailItem label="Data" value={formatDate(event.date)} icon={Clock} />
                    <DetailItem label="Local" value={event.city || "---"} icon={MapPin} />
                    <DetailItem label="Categoria" value={event.categoryName || "Geral"} icon={Layers} />
                    <DetailItem label="Organizador" value={event.organizer?.name || "N/A"} icon={Building2} />
                 </div>
              </div>
              
              <div className="pt-4 space-y-3">
                 <Button variant="outline" asChild className="w-full h-11 rounded-xl font-bold uppercase text-[10px] border-secondary text-secondary">
                    <Link href={`/${event.organizer?.username || 'evento'}/${event.id}`} target="_blank">
                       <ExternalLink className="w-4 h-4 mr-2" /> Visualizar Página Pública
                    </Link>
                 </Button>
                 <Button variant="secondary" asChild className="w-full h-11 rounded-xl font-bold uppercase text-[10px]">
                    <Link href={`/dashboard/evento/${event.id}/editar`}>
                       <Edit2 className="w-4 h-4 mr-2" /> Editar no Dashboard
                    </Link>
                 </Button>
              </div>
           </Card>

           <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
              <ShieldCheck className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary italic">Auditoria Admin</h4>
                 <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase">
                    Este painel exibe dados brutos da coleção de registros. Alterações feitas aqui impactam diretamente o faturamento da plataforma.
                 </p>
              </div>
           </div>
        </aside>
      </div>
    </div>
  )
}