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
  XCircle
} from "lucide-react"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency, calculateRefundAmount } from "@/lib/financial-utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { processTicketRefundClient } from "@/lib/finance-service"

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
    if (!db || !eventId || !event?.organizationId) return null
    return query(
      collection(db, "registrations"), 
      where("eventId", "==", eventId)
    )
  }, [db, eventId, event?.organizationId])

  const { data: registrations, loading: registrationsLoading } = useCollection<any>(registrationsQuery)
  const [search, setSearch] = React.useState("")
  const [ticketToRefund, setTicketToRefund] = React.useState<any>(null)
  const [isRefunding, setIsRefunding] = React.useState(false)

  const stats = React.useMemo(() => {
    const total = registrations?.filter((r: any) => r.status !== 'cancelled').length || 0;
    const present = registrations?.filter((r: any) => r.checkedIn).length || 0;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, percentage };
  }, [registrations]);

  const filteredRegistrations = React.useMemo(() => {
    if (!registrations) return []
    return registrations
      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
      .filter(reg => 
        (reg.userName?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (reg.ticketCode?.toLowerCase() || "").includes(search.toLowerCase())
      )
  }, [registrations, search])

  const canAction = ['owner', 'admin'].includes(userRole || '');

  const handleRefund = async () => {
    if (!db || !ticketToRefund || !currentUser) return;
    setIsRefunding(true);
    try {
      const result = await processTicketRefundClient(db, ticketToRefund.id, currentUser.uid, "Cancelamento solicitado pelo Organizador.");
      if (result.success) {
        toast({ title: "Ingresso Estornado!", description: result.isFree ? "Reserva gratuita cancelada." : `R$ ${result.refundAmount?.toFixed(2)} devolvidos ao usuário.` });
        setTicketToRefund(null);
      } else {
        toast({ variant: "destructive", title: "Erro", description: result.error });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro no servidor" });
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/dashboard/projetos"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div><h1 className="text-3xl font-bold tracking-tight">Gestão de Público</h1><p className="text-muted-foreground line-clamp-1">{event.title}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-40">Inscritos Ativos</CardTitle></CardHeader><CardContent><div className="text-3xl font-black">{stats.total}</div></CardContent></Card>
        <Card className="border-none shadow-sm border-l-4 border-green-500"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-40">Presenças Confirmadas</CardTitle></CardHeader><CardContent><div className="flex items-baseline gap-3"><div className="text-3xl font-black text-green-600">{stats.present}</div><Badge variant="secondary">{stats.percentage}%</Badge></div></CardContent></Card>
        <Card className="border-none shadow-sm bg-secondary/10"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-secondary">Aviso</CardTitle></CardHeader><CardContent><p className="text-[9px] text-primary font-bold uppercase leading-tight">Cancelamentos devolvem o saldo líquido ao usuário. Taxas operacionais de gateway são retidas.</p></CardContent></Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden rounded-[2rem]">
        <CardHeader className="bg-white border-b pb-6 px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-xl flex items-center gap-2"><Users className="w-5 h-5 text-secondary" /> Lista de Ingressos</CardTitle>
            <div className="relative w-full md:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl" /></div>
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
              {filteredRegistrations.map((reg) => {
                const isCanceled = reg.status === 'cancelled' || reg.paymentStatus === 'refunded_wallet';
                return (
                  <TableRow key={reg.id} className={cn("hover:bg-muted/10", reg.checkedIn && "bg-green-50/20", isCanceled && "opacity-50 grayscale")}>
                    <TableCell className="px-8"><div className="flex flex-col"><span className={cn("font-bold text-sm", isCanceled && "line-through")}>{reg.userName}</span><span className="text-[9px] font-mono text-secondary uppercase">{reg.ticketCode}</span></div></TableCell>
                    <TableCell><div className="flex flex-col"><span className="text-xs font-bold">{reg.ticketTypeName}</span><span className="text-[10px] text-muted-foreground uppercase">{reg.batchName}</span></div></TableCell>
                    <TableCell>
                      {reg.checkedIn ? (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 uppercase"><Clock className="w-3 h-3" /> {formatTimestamp(reg.checkedInAt)}</div>
                      ) : <span className="text-[10px] font-bold opacity-30 uppercase">{isCanceled ? 'ESTORNADO' : 'AGUARDANDO'}</span>}
                    </TableCell>
                    <TableCell className="text-right font-black text-xs">{formatCurrency(reg.producerNetAmount || 0)}</TableCell>
                    <TableCell className="px-8 text-right">
                      {canAction && !isCanceled && !reg.checkedIn && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-50" onClick={() => setTicketToRefund(reg)} title="Estornar Ingresso"><RotateCcw className="w-4 h-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MODAL DE ESTORNO */}
      <AlertDialog open={!!ticketToRefund} onOpenChange={(o) => !o && setTicketToRefund(null)}>
        <AlertDialogContent className="rounded-[2.5rem]">
          <AlertDialogHeader>
            <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4 text-destructive mx-auto"><AlertTriangle className="w-6 h-6" /></div>
            <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter text-center">Confirmar Estorno Manual?</AlertDialogTitle>
            <AlertDialogDescription className="text-center font-medium">
               O ingresso de <strong>{ticketToRefund?.userName}</strong> será invalidado imediatamente. O valor líquido (R$ {calculateRefundAmount(ticketToRefund?.price || 0).toFixed(2)}) será devolvido à carteira dele. 
               <br/><br/>
               <span className="text-xs font-bold uppercase text-destructive italic">Taxas financeiras operacionais não são reembolsáveis.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-4">
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Não</AlertDialogCancel>
            <AlertDialogAction onClick={handleRefund} disabled={isRefunding} className="bg-destructive text-white rounded-xl font-black uppercase text-[10px] px-8">
              {isRefunding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Sim, Estornar Agora"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}