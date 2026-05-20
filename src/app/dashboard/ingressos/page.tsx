
"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc, getDoc, updateDoc, getDocs, or, serverTimestamp, arrayUnion } from "firebase/firestore"
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
  Search,
  History,
  ArrowDown,
  Mail
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
} from "@/components/ui/alert-dialog"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { encryptDeterministic, decryptData } from "@/lib/crypto-utils"
import { formatCurrency } from "@/lib/financial-utils"
import { sendTicketEmail } from "@/app/actions/email"

export default function MeusIngressosPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  // Consultar ingressos onde o usuário é o comprador OU onde ele é o destinatário atual
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

  // 1. Convites que eu recebi e ainda não aceitei
  const pendingIncoming = (registrations || []).filter(r => r.sharedWithUid === user?.uid && r.transferStatus === 'pending');
  
  // 2. Ingressos que eu sou o dono ATUAL (Comprei e não transferi OU recebi e aceitei)
  const myOwned = (registrations || []).filter(r => 
    (r.userId === user?.uid && !r.sharedWithUid) || 
    (r.sharedWithUid === user?.uid && r.transferStatus === 'accepted')
  );

  // 3. Ingressos que eu transferi para alguém (Sou o dono original, mas não tenho mais a posse ativa)
  const myHistorical = (registrations || []).filter(r => 
    r.userId === user?.uid && 
    r.sharedWithUid && 
    r.sharedWithUid !== user?.uid
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Meus Ingressos</h1>
        <p className="text-muted-foreground font-medium">Sua coleção de experiências e o rastro de suas participações.</p>
      </div>

      {/* SEÇÃO 1: CONVITES PARA VOCÊ ACEITAR */}
      {pendingIncoming.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-black uppercase tracking-widest text-secondary flex items-center gap-2">
               <UserCheck className="w-4 h-4" /> Convites Recebidos ({pendingIncoming.length})
            </h2>
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
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Explore os eventos e garanta sua presença.</p>
          </div>
          <Button asChild className="bg-secondary text-white font-black px-10 h-12 rounded-full shadow-lg">
            <Link href="/dashboard">Explorar Eventos</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-12">
           {/* SEÇÃO 2: SEUS INGRESSOS ATIVOS */}
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

           {/* SEÇÃO 3: RASTRO DE COMPRAS (HISTÓRICO) */}
           {myHistorical.length > 0 && (
             <div className="space-y-4">
               <div className="flex flex-col gap-1">
                 <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <History className="w-4 h-4" /> Rastro de Transferências ({myHistorical.length})
                 </h2>
                 <p className="text-[10px] text-muted-foreground font-medium uppercase">Ingressos que você comprou e agora estão com outros participantes.</p>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {myHistorical.map((reg) => (
                   <TicketListItem key={reg.id} registration={reg} isHistorical />
                 ))}
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  )
}

function TicketListItem({ registration, isIncoming = false, isHistorical = false }: { registration: any, isIncoming?: boolean, isHistorical?: boolean }) {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile } = useDoc<any>(userDocRef)

  const [isNameModalOpen, setIsNameModalOpen] = React.useState(false)
  const [attendeeName, setAttendeeName] = React.useState(registration.attendeeName || "")
  const [attendeeCPF, setAttendeeCPF] = React.useState(registration.attendeeCPF || "")
  const [isSaving, setIsSaving] = React.useState(false)
  const [isSearchingUser, setIsSearchingUser] = React.useState(false)
  const [isSendingEmail, setIsSendingEmail] = React.useState(false)

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

  const handleResendEmail = async () => {
    if (!registration) return
    setIsSendingEmail(true)
    try {
      const eventDate = registration.eventDate?.toDate ? registration.eventDate.toDate().toLocaleString('pt-BR') : new Date(registration.eventDate).toLocaleString('pt-BR');
      
      const result = await sendTicketEmail({
        to: registration.userEmail,
        userName: registration.attendeeName || registration.userName,
        eventTitle: registration.eventTitle,
        ticketCode: registration.ticketCode,
        eventDate: eventDate,
        eventCity: registration.eventCity || "Local Confirmado",
        voucherUrl: `${window.location.origin}/dashboard/ingressos/${registration.id}/voucher`,
        eventUrl: `https://viby.club/${registration.organizerUsername || 'evento'}/${registration.eventId}`
      });

      if (result.success) {
        toast({ title: "E-mail enviado!", description: `O ingresso foi enviado para ${registration.userEmail}.` })
      } else {
        throw new Error(result.error)
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao enviar e-mail", description: e.message })
    } finally {
      setIsSendingEmail(false)
    }
  }

  const handleNameTicket = async () => {
    if (!db || !registration.id || !user) return
    setIsSaving(true)
    try {
      let sharedWithUid = null;

      const cleanCPF = attendeeCPF.replace(/\D/g, "");
      const encryptedCpfSearch = encryptDeterministic(cleanCPF);
      const q = query(collection(db, "users"), where("cpf", "==", encryptedCpfSearch));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        sharedWithUid = snap.docs[0].id;
      }

      const isTargetSelf = sharedWithUid === user.uid || cleanCPF === decryptData(profile?.cpf || "");

      if (isTargetSelf) {
        // Auto-nomeação ou atualização de dados próprios: ignora fluxo de aceite
        const updateData: any = {
          attendeeName,
          attendeeCPF,
          updatedAt: serverTimestamp()
        };

        // Se o comprador está se nomeando, limpa qualquer compartilhamento anterior
        if (registration.userId === user.uid) {
          updateData.sharedWithUid = null;
          updateData.transferStatus = null;
        } else {
          // Se já era um recebedor, mantém status aceito
          updateData.transferStatus = 'accepted';
        }

        await updateDoc(doc(db, "registrations", registration.id), updateData);
        toast({ title: "Ingresso nomeado!", description: "Seus dados foram vinculados com sucesso." });
      } else if (sharedWithUid) {
        // Transferência real para outro usuário cadastrado
        const historyEntry = {
          fromUid: user.uid,
          fromName: profile?.name || user.displayName || "Titular",
          toUid: sharedWithUid,
          toName: attendeeName,
          timestamp: new Date().toISOString(),
          status: 'pending'
        };

        await updateDoc(doc(db, "registrations", registration.id), {
          attendeeName,
          attendeeCPF, 
          sharedWithUid,
          transferStatus: 'pending',
          transferChain: arrayUnion(historyEntry),
          updatedAt: serverTimestamp()
        });
        toast({ title: "Convite enviado!", description: "O novo titular precisa aceitar no painel dele." });
      } else {
        // Nomeação simples para alguém sem conta (apenas texto no voucher)
        await updateDoc(doc(db, "registrations", registration.id), {
          attendeeName,
          attendeeCPF,
          // Não define sharedWithUid nem muda status, continua na posse do remetente
          updatedAt: serverTimestamp()
        });
        toast({ title: "Ingresso atualizado!", description: "O nome no voucher foi alterado." });
      }

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
      const chain = [...(registration.transferChain || [])];
      if (chain.length > 0) {
        chain[chain.length - 1].status = 'accepted';
        chain[chain.length - 1].acceptedAt = new Date().toISOString();
      }

      await updateDoc(doc(db, "registrations", registration.id), {
        transferStatus: 'accepted',
        transferChain: chain,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Ingresso aceito!", description: "Ele já está disponível na sua lista ativa." })
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
      const chain = [...(registration.transferChain || [])];
      if (chain.length > 0) {
        chain[chain.length - 1].status = 'rejected';
      }

      await updateDoc(doc(db, "registrations", registration.id), {
        sharedWithUid: null,
        transferStatus: null,
        attendeeCPF: "",
        attendeeName: "",
        transferChain: chain,
        updatedAt: serverTimestamp()
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
      const chain = [...(registration.transferChain || [])];
      if (chain.length > 0) {
        chain[chain.length - 1].status = 'cancelled';
      }

      await updateDoc(doc(db, "registrations", registration.id), {
        sharedWithUid: null,
        transferStatus: null,
        attendeeCPF: "",
        attendeeName: "",
        transferChain: chain,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Nomeação cancelada!" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao cancelar" })
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "---";
    try {
      let d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return "---"; }
  }

  const getStatusBadge = () => {
    if (isIncoming) return <Badge className="bg-secondary animate-pulse text-white uppercase text-[9px] font-black h-5 px-2">Aguardando Você</Badge>;
    if (isHistorical) {
       const isPending = registration.transferStatus === 'pending';
       return <Badge variant="outline" className={cn("uppercase text-[9px] font-black h-5 px-2", isPending ? "text-orange-500 border-orange-200" : "text-blue-500 border-blue-200")}>
         {isPending ? "Pendente Aceite" : "Transferido"}
       </Badge>;
    }
    return <Badge className="bg-green-500 text-white border-none text-[10px] font-black uppercase px-3">Ativo</Badge>;
  }

  const displayTitle = registration.eventTitle || "Evento";
  const displayImage = registration.eventImage || "https://picsum.photos/seed/event/600/400";
  const displayDate = registration.eventDate;

  return (
    <Card className={cn(
      "overflow-hidden border-none shadow-sm hover:shadow-md transition-all rounded-[1.5rem] bg-white flex flex-col sm:flex-row group",
      isIncoming && "ring-2 ring-secondary/30",
      isHistorical && "opacity-70 bg-muted/20"
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
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase">
              <UserIcon className="w-3 h-3 text-muted-foreground" />
              <span className="truncate max-w-[150px]">{registration.attendeeName || registration.userName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-dashed border-border/60">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{registration.batchName || "Lote Único"}</span>
            <span className="text-sm font-black text-primary mt-1">
              {formatCurrency(registration.price || 0)}
            </span>
          </div>
          
          <div className="flex gap-2">
            {isIncoming ? (
              <>
                <Button size="sm" variant="outline" onClick={handleRejectTicket} disabled={isSaving} className="h-9 px-3 text-[10px] font-black uppercase rounded-xl border-destructive text-destructive">
                   Recusar
                </Button>
                <Button size="sm" onClick={handleAcceptTicket} disabled={isSaving} className="h-9 px-3 text-[10px] font-black uppercase rounded-xl bg-green-600 text-white shadow-lg">
                   {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Aceitar"}
                </Button>
              </>
            ) : isHistorical ? (
              <div className="flex flex-col items-end gap-2">
                 {registration.transferStatus === 'pending' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive h-8 text-[9px] font-black uppercase">Cancelar Convite</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[2rem]">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-black italic uppercase italic tracking-tighter">Cancelar convite?</AlertDialogTitle>
                          <AlertDialogDescription>O ingresso voltará para sua posse ativa.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Não</AlertDialogCancel>
                          <AlertDialogAction onClick={handleCancelNomination} className="bg-destructive rounded-xl font-bold uppercase text-[10px]">Sim, cancelar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                 )}
                 <Dialog>
                    <DialogTrigger asChild>
                       <Button variant="outline" size="sm" className="h-9 px-4 text-[10px] font-black uppercase rounded-xl border-secondary text-secondary">
                          <History className="w-3.5 h-3.5 mr-1.5" /> Rastro
                       </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md rounded-[2.5rem]">
                       <DialogHeader>
                          <DialogTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                             <History className="w-5 h-5 text-secondary" /> Rastro do Ingresso
                          </DialogTitle>
                          <DialogDescription>Acompanhe por onde este ingresso passou.</DialogDescription>
                       </DialogHeader>
                       <div className="py-6 space-y-6">
                          <div className="flex flex-col gap-4">
                             <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-black">1</div>
                                <div className="space-y-0.5">
                                   <p className="text-xs font-black uppercase">{registration.userName} (Comprador Original)</p>
                                   <p className="text-[10px] text-muted-foreground uppercase">Adquirido em {formatDate(registration.timestamp)}</p>
                                </div>
                             </div>
                             {(registration.transferChain || []).map((step: any, i: number) => (
                                <React.Fragment key={i}>
                                   <div className="flex justify-center ml-4">
                                      <ArrowDown className="w-4 h-4 text-muted-foreground/30" />
                                   </div>
                                   <div className="flex items-center gap-3">
                                      <div className={cn(
                                         "h-8 w-8 rounded-full flex items-center justify-center text-white text-[10px] font-black",
                                         step.status === 'accepted' ? "bg-green-500" : step.status === 'pending' ? "bg-orange-500" : "bg-muted"
                                      )}>{i + 2}</div>
                                      <div className="space-y-0.5">
                                         <p className="text-xs font-black uppercase">Enviado para: {step.toName}</p>
                                         <p className="text-[10px] text-muted-foreground uppercase">
                                            {step.status === 'accepted' ? `Aceito em ${new Date(step.acceptedAt).toLocaleDateString('pt-BR')}` :
                                             step.status === 'pending' ? 'Aguardando aceite...' : 
                                             step.status === 'rejected' ? 'Recusado pelo destinatário' : 'Cancelado pelo remetente'}
                                         </p>
                                      </div>
                                   </div>
                                </React.Fragment>
                             ))}
                          </div>

                          <div className="p-4 bg-muted/50 rounded-2xl border-2 border-dashed border-border flex gap-3">
                             <Info className="w-5 h-5 text-secondary shrink-0" />
                             <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                               O portador atual do ingresso é <strong>{registration.attendeeName || registration.userName}</strong>. Apenas o titular atual tem acesso ao QR Code válido para entrada.
                             </p>
                          </div>
                       </div>
                    </DialogContent>
                 </Dialog>
              </div>
            ) : (
              <>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleResendEmail} 
                  disabled={isSendingEmail}
                  className="h-9 px-3 text-[10px] font-black uppercase rounded-xl border-secondary text-secondary"
                  title="Enviar Ingresso por E-mail"
                >
                  {isSendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                </Button>

                <Dialog open={isNameModalOpen} onOpenChange={setIsNameModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-9 px-3 text-[10px] font-black uppercase rounded-xl border-dashed border-secondary text-secondary">
                      <UserIcon className="w-3.5 h-3.5 mr-1.5" /> Nomear / Enviar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[2rem] max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-black italic uppercase tracking-tighter">Nomear & Enviar</DialogTitle>
                      <DialogDescription>Ao informar o CPF de outra pessoa, o ingresso será enviado para o painel dela.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <Button variant="secondary" onClick={handleUseMyData} className="w-full rounded-xl font-bold gap-2 text-xs h-12">
                         <UserCheck className="w-4 h-4" /> Usar Meus Dados
                      </Button>
                      <Separator />
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60">CPF do Novo Titular</Label>
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
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Salvar e Enviar"}
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
