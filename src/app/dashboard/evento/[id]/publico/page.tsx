
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where, orderBy, updateDoc, deleteDoc } from "firebase/firestore"
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
  Calendar,
  Download,
  Search,
  CheckCircle2,
  Trash2,
  User as UserIcon,
  Ticket,
  Clock
} from "lucide-react"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function EventoPublicoPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const db = useFirestore()
  
  const eventRef = React.useMemo(() => (db && eventId) ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const registrationsQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(
      collection(db, "registrations"), 
      where("eventId", "==", eventId),
      orderBy("timestamp", "desc")
    )
  }, [db, eventId])

  const { data: registrations, loading: registrationsLoading } = useCollection<any>(registrationsQuery)
  const [search, setSearch] = React.useState("")

  const filteredRegistrations = React.useMemo(() => {
    if (!registrations) return []
    return registrations.filter(reg => 
      reg.userName?.toLowerCase().includes(search.toLowerCase()) ||
      reg.userEmail?.toLowerCase().includes(search.toLowerCase())
    )
  }, [registrations, search])

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "---";
    try {
      const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return "---";
    }
  }

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    try {
      const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return "";
    }
  }

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return "---";
    try {
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return isNaN(age) ? "---" : `${age} anos`;
    } catch (e) {
      return "---";
    }
  }

  const getStatusBadge = (reg: any) => {
    const isFree = reg.price === 0;
    const status = reg.paymentStatus || (isFree ? "Disponível" : "Pendente");

    switch (status) {
      case "Disponível":
        return <Badge className="bg-green-500 text-white hover:bg-green-600">Disponível</Badge>;
      case "Pago":
        return <Badge className="bg-secondary text-white hover:bg-secondary/90">Pago</Badge>;
      case "Expirado":
        return <Badge variant="destructive">Expirado</Badge>;
      case "Pendente":
      default:
        return <Badge variant="outline" className="text-orange-500 border-orange-500">Pendente</Badge>;
    }
  }

  const handleCheckIn = async (regId: string, currentStatus: boolean) => {
    if (!db) return
    try {
      await updateDoc(doc(db, "registrations", regId), {
        checkedIn: !currentStatus
      })
      toast({ title: !currentStatus ? "Check-in realizado!" : "Check-in removido." })
    } catch (error) {
      toast({ variant: "destructive", title: "Erro no check-in", description: "Verifique suas permissões." })
    }
  }

  const handleDeleteRegistration = async (regId: string, userName: string) => {
    if (!db) return
    if (!confirm(`Deseja realmente cancelar o ingresso de ${userName}?`)) return
    
    try {
      await deleteDoc(doc(db, "registrations", regId))
      toast({ title: "Ingresso cancelado com sucesso." })
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao cancelar", description: "Ocorreu um problema ao remover a inscrição." })
    }
  }

  if (eventLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <h2 className="text-2xl font-bold">Evento não encontrado</h2>
        <Button onClick={() => router.push('/dashboard/projetos')}>Voltar</Button>
      </div>
    )
  }

  const stats = {
    total: registrations?.length || 0,
    present: registrations?.filter((r: any) => r.checkedIn).length || 0
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/projetos"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Público</h1>
          <p className="text-muted-foreground line-clamp-1">{event.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Inscritos Totais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-card border-l-4 border-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Presenças (Check-in)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-green-600">{stats.present}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="pb-2 text-right">
             <Button variant="outline" className="rounded-xl font-bold gap-2 text-xs" onClick={() => alert("Exportação em breve!")}>
               <Download className="w-3.5 h-3.5" />
               Exportar Lista
             </Button>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden rounded-[2rem]">
        <CardHeader className="bg-white border-b pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Users className="w-5 h-5 text-secondary" />
                Controle de Portaria
              </CardTitle>
              <CardDescription>Valide ingressos e gerencie os participantes do evento.</CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar participante..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {registrationsLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[100px] text-center font-bold">Check-in</TableHead>
                  <TableHead className="w-[220px] font-bold">Nome do Participante</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold">Idade</TableHead>
                  <TableHead className="font-bold">Sexo</TableHead>
                  <TableHead className="font-bold">Registro</TableHead>
                  <TableHead className="font-bold">Valor / Lote</TableHead>
                  <TableHead className="text-right font-bold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.length > 0 ? (
                  filteredRegistrations.map((reg) => (
                    <TableRow key={reg.id} className={cn("hover:bg-muted/20 transition-colors", reg.checkedIn && "bg-green-50/30")}>
                      <TableCell className="text-center">
                        <Button 
                          variant={reg.checkedIn ? "default" : "outline"}
                          size="icon"
                          onClick={() => handleCheckIn(reg.id, reg.checkedIn)}
                          className={cn(
                            "h-9 w-9 rounded-full transition-all",
                            reg.checkedIn ? "bg-green-500 hover:bg-green-600 text-white" : "border-muted-foreground/30"
                          )}
                        >
                          <CheckCircle2 className={cn("w-5 h-5", reg.checkedIn ? "text-white" : "text-muted-foreground/20")} />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-foreground">{reg.userName || "---"}</span>
                          <span className="text-[10px] text-muted-foreground font-medium">{reg.userEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(reg)}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-bold text-muted-foreground">
                          {calculateAge(reg.userBirthDate)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tighter">
                          {reg.userGender || "---"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold flex items-center gap-1"><Calendar className="w-3 h-3 text-secondary" /> {formatDate(reg.timestamp)}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(reg.timestamp)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-secondary">
                            {reg.price === 0 ? "GRÁTIS" : `R$ ${parseFloat(reg.price || 0).toFixed(2)}`}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-bold uppercase">{reg.batchName || "Lote Único"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                          onClick={() => handleDeleteRegistration(reg.id, reg.userName)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Users className="w-12 h-12 opacity-10 mb-2" />
                        <p className="font-medium italic">Nenhum participante encontrado.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
