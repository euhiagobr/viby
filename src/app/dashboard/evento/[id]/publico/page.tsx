
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useDoc, useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from "@/firebase"
import { 
  doc, 
  collection, 
  query, 
  where, 
  updateDoc, 
  serverTimestamp, 
} from "firebase/firestore"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Users, 
  ArrowLeft, 
  Loader2, 
  Search, 
  ScanQrCode, 
  RotateCcw,
  Clock,
  UserCheck
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { processGamificationEvent } from "@/lib/gamification-service"
import { RefundDialog } from "@/components/tickets/RefundDialog"

export default function EventoPublicoPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const db = useFirestore()
  const auth = useAuth()
  const { user: currentUser } = useUser(auth)
  const { userRole } = useCurrentOrganization()
  
  const eventRef = React.useMemo(() => (db && eventId) ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const registrationsQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(
      collection(db, "registrations"), 
      where("eventId", "==", eventId)
    )
  }, [db, eventId])

  const { data: registrations, loading: registrationsLoading } = useCollection<any>(registrationsQuery)
  
  const [search, setSearch] = React.useState("")
  const [activeTab, setActiveTab] = React.useState("all")
  const [ticketToRefund, setTicketToRefund] = React.useState<any>(null)
  const [isActionLoading, setIsActionLoading] = React.useState<string | null>(null)

  const stats = React.useMemo(() => {
    const total = registrations?.filter((r: any) => r.status !== 'refunded' && r.status !== 'cancelled').length || 0;
    const present = registrations?.filter((r: any) => r.checkedIn).length || 0;
    const pendingRefunds = registrations?.filter((r: any) => r.refundStatus === 'requested').length || 0;
    return { total, present, pendingRefunds };
  }, [registrations]);

  const filteredRegistrations = React.useMemo(() => {
    if (!registrations) return []
    let list = registrations;

    if (activeTab === 'requests') {
      list = list.filter(r => r.refundStatus === 'requested');
    } else if (activeTab === 'present') {
      list = list.filter(r => r.checkedIn);
    }

    return list
      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
      .filter(reg => 
        (reg.userName?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (reg.ticketCode?.toLowerCase() || "").includes(search.toLowerCase())
      )
  }, [registrations, search, activeTab])

  const canAction = ['owner', 'admin', 'editor', 'checkin'].includes(userRole || '');
  const canRefund = ['owner', 'admin', 'editor'].includes(userRole || '');

  const handleManualCheckIn = async (reg: any) => {
    if (!db || !currentUser || !canAction) return
    setIsActionLoading(reg.id)
    try {
      const regRef = doc(db, "registrations", reg.id)
      await updateDoc(regRef, {
        checkedIn: true,
        checkedInAt: serverTimestamp(),
        checkedInBy: currentUser.uid,
        status: "Utilizado"
      })

      await processGamificationEvent(db, reg.userId, 'on_checkin', {
        eventId: reg.eventId,
        eventTitle: reg.eventTitle,
        orgName: reg.organizer?.name
      }, reg.id);

      toast({ title: "Check-in realizado!", description: `${reg.userName} agora consta como presente.` })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro no check-in" })
    } finally {
      setIsActionLoading(null)
    }
  }

  const formatTimestamp = (ts: any) => {
    if (!ts) return "---";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('pt-BR');
  }

  if (eventLoading) return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="animate-spin" /></div>

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard/projetos"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div><h1 className="text-3xl font-bold tracking-tight">Gestão de Público</h1><p className="text-muted-foreground line-clamp-1">{event.title}</p></div>
        </div>
        <div className="flex gap-2">
           <Button asChild className="bg-primary text-white font-black rounded-full px-8 h-12 shadow-lg gap-2 uppercase italic">
              <Link href="/admin/scanner">
                 <ScanQrCode className="w-5 h-5" /> Abrir Scanner
              </Link>
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-40">Participantes</CardTitle></CardHeader><CardContent><div className="text-3xl font-black">{stats.total}</div></CardContent></Card>
        <Card className="border-none shadow-sm border-l-4 border-green-500"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-40">No Evento</CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-green-600">{stats.present}</div></CardContent></Card>
        <Card className={cn("border-none shadow-sm border-l-4 transition-all", stats.pendingRefunds > 0 ? "border-orange-500 bg-orange-50" : "border-muted")}>
           <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-40">Solicitações de Estorno</CardTitle></CardHeader>
           <CardContent><div className={cn("text-3xl font-black", stats.pendingRefunds > 0 ? "text-orange-600" : "text-muted-foreground/30")}>{stats.pendingRefunds}</div></CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden rounded-[2rem] bg-white">
        <CardHeader className="border-b pb-6 px-8">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-fit">
                <TabsList className="bg-muted/50 p-1 rounded-xl">
                   <TabsTrigger value="all" className="rounded-lg font-bold text-xs uppercase px-4">Todos</TabsTrigger>
                   <TabsTrigger value="present" className="rounded-lg font-bold text-xs uppercase px-4">Presentes</TabsTrigger>
                   <TabsTrigger value="requests" className="rounded-lg font-bold text-xs uppercase px-4 gap-2">
                     Solicitações {stats.pendingRefunds > 0 && <Badge className="h-4 px-1.5 bg-orange-500 text-white border-none text-[8px]">{stats.pendingRefunds}</Badge>}
                   </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative w-full md:w-80">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                 <Input placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl h-11" />
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[200px] font-bold px-8">Participante</TableHead>
                <TableHead className="font-bold">Ingresso</TableHead>
                <TableHead className="font-bold">Entrada</TableHead>
                <TableHead className="font-bold text-right">Líquido</TableHead>
                <TableHead className="text-right font-bold px-8">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrationsLoading ? (
                <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-secondary" /></TableCell></TableRow>
              ) : filteredRegistrations.length > 0 ? (
                filteredRegistrations.map((reg) => {
                  const isRefunded = reg.status === 'refunded' || reg.paymentStatus === 'Estornado';
                  const isRequest = reg.refundStatus === 'requested';
                  
                  return (
                    <TableRow key={reg.id} className={cn("hover:bg-muted/10 transition-colors", reg.checkedIn && "bg-green-50/20", isRefunded && "opacity-50 grayscale")}>
                      <TableCell className="px-8">
                        <div className="flex flex-col">
                          <span className={cn("font-bold text-sm", isRefunded && "line-through")}>{reg.userName}</span>
                          <span className="text-[9px] font-mono text-secondary uppercase">{reg.ticketCode}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold">{reg.ticketTypeName}</span>
                          <Badge variant="outline" className="text-[8px] uppercase font-black w-fit mt-1">{reg.batchName}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {reg.checkedIn ? (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 uppercase">
                            <Clock className="w-3 h-3" /> {formatTimestamp(reg.checkedInAt)}
                          </div>
                        ) : isRequest ? (
                          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-orange-600 animate-pulse">
                            <AlertCircle className="w-3 h-3" /> Estorno Solicitado
                          </div>
                        ) : <span className="text-[10px] font-bold opacity-30 uppercase">{isRefunded ? 'ESTORNADO' : 'AGUARDANDO'}</span>}
                      </TableCell>
                      <TableCell className="text-right font-black text-xs">{formatCurrency(reg.producerNetAmount || 0)}</TableCell>
                      <TableCell className="px-8 text-right">
                        {!isRefunded && (
                          <div className="flex items-center justify-end gap-2">
                             {!reg.checkedIn && !isRequest && canAction && (
                               <Button size="sm" variant="outline" className="h-8 rounded-lg text-[9px] font-black uppercase gap-1.5 border-secondary text-secondary hover:bg-secondary/5" onClick={() => handleManualCheckIn(reg)} disabled={isActionLoading === reg.id}>
                                  {isActionLoading === reg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                                  Check-in
                               </Button>
                             )}
                             {canRefund && !reg.checkedIn && (
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/30 hover:text-destructive hover:bg-red-50" onClick={() => setTicketToRefund(reg)} title="Estornar Ingresso">
                                  <RotateCcw className="w-4 h-4" />
                               </Button>
                             )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow><TableCell colSpan={5} className="py-20 text-center opacity-30 italic">Nenhum participante localizado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RefundDialog 
        registration={ticketToRefund}
        isOpen={!!ticketToRefund}
        onOpenChange={(open) => !open && setTicketToRefund(null)}
        userRole="organizer"
        executorUid={currentUser?.uid || ''}
      />
    </div>
  )
}
