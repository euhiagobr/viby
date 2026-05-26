
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
  getDocs, 
  limit
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
import { Separator } from "@/components/ui/separator"
import { 
  Users, 
  ArrowLeft, 
  Loader2, 
  Search, 
  CheckCircle2, 
  Ticket, 
  Clock, 
  AlertTriangle, 
  ScanQrCode, 
  RotateCcw,
  XCircle,
  ShieldCheck,
  Check,
  UserCheck
} from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { processTicketRefund } from "@/app/actions/finance"
import { processGamificationEvent } from "@/lib/gamification-service"

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
  const [isRefunding, setIsRefunding] = React.useState(false)
  const [isActionLoading, setIsActionLoading] = React.useState<string | null>(null)

  const stats = React.useMemo(() => {
    const total = registrations?.filter((r: any) => r.status !== 'cancelled' && r.paymentStatus !== 'refunded_wallet').length || 0;
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

      // Gatilho Gamificação
      await processGamificationEvent(db, reg.userId, 'on_checkin', {
        eventId: reg.eventId,
        eventTitle: reg.eventTitle,
        categoryName: reg.categoryName,
        city: reg.eventCity,
        orgName: reg.organizer?.name
      }, reg.id);

      toast({ title: "Check-in realizado!", description: `${reg.userName} agora consta como presente.` })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro no check-in" })
    } finally {
      setIsActionLoading(null)
    }
  }

  const handleApproveRefund = async () => {
    if (!db || !ticketToRefund || !currentUser) return;
    setIsRefunding(true);
    try {
      const result = await processTicketRefund(ticketToRefund.id, currentUser.uid, "Estorno aprovado pelo organizador.");
      if (result.success) {
        toast({ title: "Estorno Concluído!", description: result.isFree ? "Reserva gratuita cancelada." : `R$ ${result.refundAmount?.toFixed(2)} devolvidos ao usuário.` });
        setTicketToRefund(null);
      } else {
        toast({ variant: "destructive", title: "Erro", description: result.error });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro de comunicação" });
    } finally {
      setIsRefunding(false);
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
                  const isCanceled = reg.status === 'cancelled' || reg.paymentStatus === 'refunded_wallet';
                  const isRequest = reg.refundStatus === 'requested';
                  
                  return (
                    <TableRow key={reg.id} className={cn("hover:bg-muted/10 transition-colors", reg.checkedIn && "bg-green-50/20", isCanceled && "opacity-50 grayscale")}>
                      <TableCell className="px-8">
                        <div className="flex flex-col">
                          <span className={cn("font-bold text-sm", isCanceled && "line-through")}>{reg.userName}</span>
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
                            <AlertTriangle className="w-3 h-3" /> Estorno Solicitado
                          </div>
                        ) : <span className="text-[10px] font-bold opacity-30 uppercase">{isCanceled ? 'ESTORNADO' : 'AGUARDANDO'}</span>}
                      </TableCell>
                      <TableCell className="text-right font-black text-xs">{formatCurrency(reg.producerNetAmount || 0)}</TableCell>
                      <TableCell className="px-8 text-right">
                        {!isCanceled && (
                          <div className="flex items-center justify-end gap-2">
                             {!reg.checkedIn && !isRequest && canAction && (
                               <Button size="sm" variant="outline" className="h-8 rounded-lg text-[9px] font-black uppercase gap-1.5 border-secondary text-secondary hover:bg-secondary/5" onClick={() => handleManualCheckIn(reg)} disabled={isActionLoading === reg.id}>
                                  {isActionLoading === reg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                                  Check-in
                               </Button>
                             )}
                             {isRequest && canRefund && (
                               <Button size="sm" className="bg-orange-500 text-white font-black text-[9px] uppercase h-8 rounded-lg gap-1.5 shadow-lg shadow-orange-200" onClick={() => setTicketToRefund(reg)}>
                                  <Check className="w-3 h-3" /> Aprovar Estorno
                               </Button>
                             )}
                             {!reg.checkedIn && !isRequest && canRefund && (
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/30 hover:text-destructive hover:bg-red-50" onClick={() => setTicketToRefund(reg)} title="Estornar Manualmente">
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

      {/* MODAL DE APROVAÇÃO DE ESTORNO */}
      <AlertDialog open={!!ticketToRefund} onOpenChange={(o) => !o && setTicketToRefund(null)}>
        <AlertDialogContent className="rounded-[2.5rem]">
          <AlertDialogHeader>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4 text-orange-600 mx-auto">
               <ShieldCheck className="w-6 h-6" />
            </div>
            <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter text-center">
               {ticketToRefund?.refundStatus === 'requested' ? "Aprovar Solicitação de Estorno?" : "Confirmar Estorno Manual?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center font-medium">
               O ingresso de <strong>{ticketToRefund?.userName}</strong> será invalidado permanentemente. 
               O valor líquido de <strong>{formatCurrency(ticketToRefund?.ticketBasePrice || 0)}</strong> será devolvido à carteira dele.
               <br/><br/>
               <span className="text-xs font-bold uppercase text-destructive italic">As taxas de serviço e gateway não são reembolsáveis.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-4">
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApproveRefund} disabled={isRefunding} className="bg-orange-600 text-white rounded-xl font-black uppercase text-[10px] px-8">
              {isRefunding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Confirmar e Devolver Valor"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
