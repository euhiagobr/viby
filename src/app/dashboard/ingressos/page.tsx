
"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc, getDoc, updateDoc, getDocs, or, serverTimestamp } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { 
  Loader2, 
  Ticket, 
  Calendar, 
  MapPin, 
  Clock, 
  ExternalLink, 
  QrCode, 
  User as UserIcon,
  Save,
  CheckCircle2,
  Share2,
  UserCheck,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Info,
  Undo2,
  Search
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { encryptDeterministic, decryptData } from "@/lib/crypto-utils"
import { formatCurrency } from "@/lib/financial-utils"

export default function MeusIngressosPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  // Consultar ingressos onde o usuário é o comprador OU onde ele é o destinatário compartilhado
  const registrationsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(
      collection(db, "registrations"), 
      or(
        where("userId", "==", user.uid),
        where("sharedWithUid", "==", user.uid)
      )
    )
  }, [db, user])

  const { data: registrations, loading: regLoading } = useCollection<any>(registrationsQuery)

  if (regLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  // Filtros de estados do ingresso
  const pendingIncoming = (registrations || []).filter(r => r.sharedWithUid === user?.uid && r.transferStatus === 'pending');
  const myOwned = (registrations || []).filter(r => (r.userId === user?.uid && !r.sharedWithUid) || (r.sharedWithUid === user?.uid && r.transferStatus === 'accepted'));
  const mySent = (registrations || []).filter(r => r.userId === user?.uid && r.sharedWithUid && r.transferStatus === 'pending');

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Meus Ingressos</h1>
        <p className="text-muted-foreground font-medium">Sua coleção de experiências e acessos confirmados.</p>
      </div>

      {/* SEÇÃO 1: CONVITES PARA VOCÊ ACEITAR */}
      {pendingIncoming.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-black uppercase tracking-widest text-secondary flex items-center gap-2">
               <UserCheck className="w-4 h-4" /> Convites Recebidos ({pendingIncoming.length})
            </h2>
            <p className="text-[10px] text-muted-foreground font-medium">Outros usuários vincularam estes ingressos ao seu CPF. Aceite para visualizar o voucher.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pendingIncoming.map((reg) => (
              <TicketListItem key={reg.id} registration={reg} isIncoming />
            ))}
          </div>
        </div>
      )}

      {(!registrations || registrations.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-border gap-6 shadow-sm">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
            <Ticket className="w-10 h-10 text-muted-foreground opacity-30" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-bold">Nenhum ingresso por aqui ainda.</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Explore os eventos e garanta sua presença nos melhores momentos.</p>
          </div>
          <Button asChild className="bg-secondary text-white font-black px-10 h-12 rounded-full shadow-lg hover:scale-105 transition-transform">
            <Link href="/dashboard">Explorar Eventos</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-12">
           {/* SEÇÃO 2: SEUS INGRESSOS (COMPRADOS OU ACEITOS) */}
           {myOwned.length > 0 && (
             <div className="space-y-4">
               <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Ticket className="w-4 h-4" /> Seus Ingressos Ativos
               </h2>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {myOwned.map((reg) => (
                   <TicketListItem key={reg.id} registration={reg} />
                 ))}
               </div>
             </div>
           )}

           {/* SEÇÃO 3: INGRESSOS QUE VOCÊ ENVIOU PARA OUTROS */}
           {mySent.length > 0 && (
             <div className="space-y-4">
               <div className="flex flex-col gap-1">
                 <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Share2 className="w-4 h-4" /> Nomeados para Terceiros ({mySent.length})
                 </h2>
                 <p className="text-[10px] text-muted-foreground font-medium">Estes ingressos foram vinculados a outros CPFs e aguardam o aceite do destinatário.</p>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {mySent.map((reg) => (
                   <TicketListItem key={reg.id} registration={reg} isSent />
                 ))}
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  )
}

function TicketListItem({ registration, isIncoming = false, isSent = false }: { registration: any, isIncoming?: boolean, isSent?: boolean }) {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile } = useDoc<any>(userDocRef)

  const [event, setEvent] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(!registration.eventTitle)
  const [isNameModalOpen, setIsNameModalOpen] = React.useState(false)
  const [attendeeName, setAttendeeName] = React.useState(registration.attendeeName || "")
  const [attendeeCPF, setAttendeeCPF] = React.useState(registration.attendeeCPF || "")
  const [isSaving, setIsSaving] = React.useState(false)
  const [isSearchingUser, setIsSearchingUser] = React.useState(false)

  React.useEffect(() => {
    if (!db || !registration.eventId) return
    
    const fetchEvent = async () => {
      try {
        const eventDoc = await getDoc(doc(db, "events", registration.eventId))
        if (eventDoc.exists()) {
          setEvent({ ...eventDoc.data(), id: eventDoc.id })
        }
      } catch (e) {
        console.error("Erro ao carregar evento:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchEvent()
  }, [db, registration.eventId])

  // Lógica de Autocomplete por CPF
  React.useEffect(() => {
    const lookupUser = async () => {
      const cleanCPF = attendeeCPF.replace(/\D/g, "");
      if (cleanCPF.length === 11 && db) {
        setIsSearchingUser(true);
        try {
          const encryptedCpfSearch = encryptDeterministic(cleanCPF);
          const q = query(collection(db, "users"), where("cpf", "==", encryptedCpfSearch));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const foundUser = snap.docs[0].data();
            setAttendeeName(foundUser.name || "");
            toast({ title: "Usuário encontrado!", description: `Nome preenchido: ${foundUser.name}` });
          }
        } catch (e) {
          console.error("Erro ao buscar usuário por CPF:", e);
        } finally {
          setIsSearchingUser(false);
        }
      }
    };

    const timer = setTimeout(lookupUser, 300);
    return () => clearTimeout(timer);
  }, [attendeeCPF, db]);

  const formatCPF = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    if (v.length > 3) return v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    return v;
  }

  const handleUseMyData = () => {
    if (profile) {
      setAttendeeName(profile.name || "")
      setAttendeeCPF(profile.cpf ? decryptData(profile.cpf) : "")
    }
  }

  const handleNameTicket = async () => {
    if (!db || !registration.id) return
    setIsSaving(true)
    try {
      let sharedWithUid = null;
      let transferStatus = null;

      if (attendeeCPF) {
        const encryptedCpfSearch = encryptDeterministic(attendeeCPF.trim());
        const q = query(collection(db, "users"), where("cpf", "==", encryptedCpfSearch));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const targetUid = snap.docs[0].id;
          if (targetUid !== user?.uid) {
            sharedWithUid = targetUid;
            transferStatus = 'pending';
          }
        }
      }

      await updateDoc(doc(db, "registrations", registration.id), {
        attendeeName,
        attendeeCPF, 
        sharedWithUid,
        transferStatus,
        namedAt: serverTimestamp()
      })

      toast({ 
        title: sharedWithUid ? "Ingresso compartilhado!" : "Dados salvos!", 
        description: sharedWithUid ? "O destinatário precisa aceitar o ingresso." : "Nome do participante atualizado." 
      })
      setIsNameModalOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAcceptTicket = async () => {
    if (!db || !registration.id) return
    setIsSaving(true)
    try {
      await updateDoc(doc(db, "registrations", registration.id), {
        transferStatus: 'accepted',
        acceptedAt: serverTimestamp()
      })
      toast({ title: "Ingresso aceito!", description: "Ele agora está disponível na sua lista ativa." })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao aceitar" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRejectTicket = async () => {
    if (!db || !registration.id) return
    setIsSaving(true)
    try {
      await updateDoc(doc(db, "registrations", registration.id), {
        sharedWithUid: null,
        transferStatus: null,
        attendeeCPF: "",
        attendeeName: ""
      })
      toast({ title: "Convite recusado" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao recusar" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelNomination = async () => {
    if (!db || !registration.id) return

    setIsSaving(true)
    try {
      await updateDoc(doc(db, "registrations", registration.id), {
        sharedWithUid: null,
        transferStatus: null,
        attendeeCPF: "",
        attendeeName: ""
      })
      toast({ title: "Nomeação cancelada!", description: "O ingresso voltou para sua lista ativa." })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao cancelar" })
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "A definir";
    try {
      let d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      if (isNaN(d.getTime())) return "A definir";
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch (e) { return "---"; }
  }

  const formatTime = (dateValue: any) => {
    if (!dateValue) return "";
    try {
      let d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ""; }
  }

  const getStatusBadge = () => {
    if (isIncoming) return <Badge className="bg-secondary animate-pulse text-white uppercase text-[9px] font-black h-5 px-2">Aguardando Você</Badge>;
    if (isSent) return <Badge variant="outline" className="text-orange-500 border-orange-200 uppercase text-[9px] font-black h-5 px-2">Pendente Aceite</Badge>;
    
    const status = registration.paymentStatus || (registration.price === 0 ? "Disponível" : "Pendente");
    switch (status) {
      case "Disponível": return <Badge className="bg-green-500 text-white border-none text-[10px] font-black uppercase px-3">Válido</Badge>;
      case "Pago": return <Badge className="bg-secondary text-white border-none text-[10px] font-black uppercase px-3">Confirmado</Badge>;
      case "Pendente": return <Badge variant="outline" className="text-orange-500 border-orange-500 text-[10px] font-black uppercase px-3">Pendente</Badge>;
      default: return <Badge variant="secondary" className="text-[10px] font-black uppercase px-3">{status}</Badge>;
    }
  }

  if (loading && !registration.eventTitle) {
    return <Card className="h-40 border-none shadow-sm animate-pulse bg-white rounded-[1.5rem]" />
  }

  const displayTitle = event?.title || registration.eventTitle || "Evento";
  const displayImage = event?.image || registration.eventImage || "https://picsum.photos/seed/event/600/400";
  const displayDate = event?.date || registration.eventDate;

  return (
    <Card className={cn(
      "overflow-hidden border-none shadow-sm hover:shadow-md transition-all rounded-[1.5rem] bg-white flex flex-col sm:flex-row group",
      isIncoming && "ring-2 ring-secondary/30",
      isSent && "opacity-70 grayscale"
    )}>
      <div className="relative w-full sm:w-44 h-40 sm:h-auto bg-muted">
        <Image src={displayImage} alt={displayTitle} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3">{getStatusBadge()}</div>
      </div>
      
      <CardContent className="p-6 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <h3 className="font-black text-lg leading-tight line-clamp-1 uppercase italic tracking-tighter group-hover:text-secondary transition-colors">
            {displayTitle}
          </h3>
          
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-tight">
              <Calendar className="w-3.5 h-3.5 text-secondary" />
              <span>{formatDate(displayDate)}</span>
              <span className="opacity-20">|</span>
              <Clock className="w-3.5 h-3.5 text-secondary" />
              <span>{formatTime(displayDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase">
              <UserIcon className="w-3 h-3 text-muted-foreground" />
              <span>{registration.attendeeName || "Ingresso não nomeado"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-dashed border-border/60">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{registration.batchName || "Lote Único"}</span>
            <span className="text-sm font-black text-primary mt-1">
              {registration.price === 0 ? "GRÁTIS" : formatCurrency(registration.price)}
            </span>
          </div>
          
          <div className="flex gap-2">
            {isIncoming ? (
              <>
                <Button size="sm" variant="outline" onClick={handleRejectTicket} disabled={isSaving} className="h-9 px-3 text-[10px] font-black uppercase rounded-xl border-destructive text-destructive hover:bg-destructive/10">
                   <XCircle className="w-3.5 h-3.5 mr-1" /> Recusar
                </Button>
                <Button size="sm" onClick={handleAcceptTicket} disabled={isSaving} className="h-9 px-3 text-[10px] font-black uppercase rounded-xl bg-green-600 text-white shadow-lg">
                   {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />} Aceitar
                </Button>
              </>
            ) : isSent ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={isSaving} className="h-9 px-3 text-[10px] font-black uppercase rounded-xl border-orange-500 text-orange-600 hover:bg-orange-50">
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5 mr-1" />} Cancelar Nomeação
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2rem]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter">Cancelar Nomeação?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O convite enviado para o CPF informado será invalidado e o ingresso voltará a ficar disponível para você nomear novamente ou utilizar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px] tracking-widest">Manter Nomeação</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleCancelNomination}
                      className="bg-orange-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-orange-700"
                    >
                      Confirmar Cancelamento
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <>
                <Dialog open={isNameModalOpen} onOpenChange={setIsNameModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-9 px-3 text-[10px] font-black uppercase rounded-xl border-dashed border-secondary text-secondary">
                      <UserIcon className="w-3.5 h-3.5 mr-1.5" /> Nomear
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[2rem] max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-black italic uppercase tracking-tighter">Nomear Ingresso</DialogTitle>
                      <DialogDescription>O CPF permite compartilhar o ingresso com outro usuário.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <Button variant="secondary" onClick={handleUseMyData} className="w-full rounded-xl font-bold gap-2 text-xs h-12">
                         <UserCheck className="w-4 h-4" /> Usar Meus Dados
                      </Button>
                      <Separator />
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60">CPF do Participante</Label>
                        <div className="relative">
                          <Input 
                            value={attendeeCPF} 
                            onChange={(e) => setAttendeeCPF(formatCPF(e.target.value))} 
                            placeholder="000.000.000-00" 
                            className={cn("rounded-xl", isSearchingUser && "pr-10")} 
                          />
                          {isSearchingUser && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                          <Search className="w-3 h-3" /> Digite o CPF completo para buscar o usuário.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60">Nome Completo</Label>
                        <Input value={attendeeName} onChange={(e) => setAttendeeName(e.target.value)} placeholder="Nome do participante" className="rounded-xl" />
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg flex gap-2">
                        <Info className="w-4 h-4 text-secondary shrink-0" />
                        <p className="text-[9px] text-muted-foreground leading-tight">Se o CPF pertencer a outro usuário, o ingresso aparecerá no painel dele para aceite.</p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleNameTicket} disabled={isSaving || !attendeeName} className="w-full bg-secondary text-white font-black h-12 rounded-xl">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar e Compartilhar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button size="sm" className="h-9 px-4 text-[10px] font-black uppercase rounded-xl bg-primary text-white" asChild>
                  <Link href={`/dashboard/ingressos/${registration.id}/voucher`}><QrCode className="w-3.5 h-3.5 mr-1.5" /> Voucher</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
