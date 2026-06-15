"use client"

import * as React from "react"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, writeBatch, getDocs, limit, updateDoc, serverTimestamp } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Plus, 
  MoreHorizontal, 
  Loader2, 
  Calendar as CalendarIcon, 
  MapPin, 
  Clock, 
  Building2, 
  AlertCircle, 
  Edit2, 
  Eye, 
  Users,
  Trash2,
  TicketPercent,
  Megaphone,
  RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { format, startOfToday, addDays } from "date-fns"
import { cn } from "@/lib/utils"

export default function MeusEventosPage() {
  const db = useFirestore()
  const { currentOrg, userRole, loading: orgLoading } = useCurrentOrganization()
  const [now, setNow] = React.useState<Date | null>(null)

  React.useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const myEventsQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null
    return query(collection(db, "events"), where("organizationId", "==", currentOrg.id))
  }, [db, currentOrg?.id])

  const { data: rawEvents, loading: eventsLoading } = useCollection<any>(myEventsQuery)

  // Pipeline de Ocorrências para eventos recorrentes
  const occurrencesQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null
    const yesterdayStr = format(addDays(startOfToday(), -1), 'yyyy-MM-dd')
    return query(
      collection(db, "recurring_occurrences"), 
      where("organizationId", "==", currentOrg.id),
      where("status", "==", "active"),
      where("date", ">=", yesterdayStr)
    )
  }, [db, currentOrg?.id])
  const { data: allOccurrences } = useCollection<any>(occurrencesQuery)

  const events = React.useMemo(() => {
    if (!rawEvents) return [];
    
    return rawEvents.map(e => {
      let effectiveDate = e.date;
      if (e.isRecurring && allOccurrences && now) {
        const myOccs = allOccurrences.filter((o: any) => o.parentId === e.id) || [];
        if (myOccs.length > 0) {
          const sorted = [...myOccs]
            .map(o => ({ ...o, _dt: new Date(o.date + 'T' + (o.startTime || '00:00') + ':00') }))
            .sort((a, b) => a._dt.getTime() - b._dt.getTime());
          
          const nextValid = sorted.find(o => {
            const endThreshold = new Date(o._dt.getTime() + 6 * 60 * 60 * 1000);
            return now < endThreshold;
          });

          if (nextValid) {
            effectiveDate = nextValid.date + 'T' + (nextValid.startTime || '19:00') + ':00';
          }
        }
      }
      return { ...e, date: effectiveDate };
    }).filter((e: any) => e.status !== 'Excluído')
      .sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });
  }, [rawEvents, allOccurrences, now]);

  const [eventToDelete, setEventToDelete] = React.useState<{id: string, title: string} | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "A definir";
    try {
      let d: Date;
      if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
        d = dateValue.toDate();
      } else if (dateValue instanceof Date) {
        d = dateValue;
      } else {
        d = new Date(dateValue);
      }
      return isNaN(d.getTime()) ? "A definir" : d.toLocaleDateString('pt-BR');
    } catch (e) {
      return "A definir";
    }
  };

  const formatTime = (dateValue: any) => {
    if (!dateValue) return "";
    try {
      let d: Date;
      if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
        d = dateValue.toDate();
      } else if (dateValue instanceof Date) {
        d = dateValue;
      } else {
        d = new Date(dateValue);
      }
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return "";
    }
  };

  const confirmDelete = async () => {
    if (!db || !eventToDelete) return

    setIsDeleting(true)
    try {
      const salesQuery = query(
        collection(db, "registrations"),
        where("eventId", "==", eventToDelete.id),
        where("paymentStatus", "in", ["Pago", "Disponível"]),
        limit(1)
      );
      const salesSnap = await getDocs(salesQuery);
      const eventRef = doc(db, "events", eventToDelete.id);

      if (!salesSnap.empty) {
        await updateDoc(eventRef, { 
          status: "Oculto", 
          updatedAt: serverTimestamp() 
        });
        toast({ 
          title: "Evento Ocultado", 
          description: "Como já existem ingressos vendidos, o evento foi ocultado em vez de excluído para preservar os vouchers." 
        });
      } else {
        const batch = writeBatch(db);
        batch.update(eventRef, { status: "Excluído", updatedAt: serverTimestamp() });
        
        const regsQuery = query(collection(db, "registrations"), where("eventId", "==", eventToDelete.id));
        const regsSnap = await getDocs(regsQuery);
        regsSnap.forEach((regDoc) => batch.delete(regDoc.ref));
        
        await batch.commit();
        toast({ title: "Evento removido" });
      }
    } catch (error: any) {
      errorEmitter.emit("permission-error", new FirestorePermissionError({
        path: `events/${eventToDelete?.id}`,
        operation: "update",
      }))
    } finally {
      setIsDeleting(false)
      setEventToDelete(null)
    }
  }

  if (orgLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
  }

  if (!currentOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-border gap-6 shadow-sm">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
          <Building2 className="w-10 h-10 text-muted-foreground opacity-30" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-xl font-bold">Nenhuma organização selecionada.</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">Para gerenciar eventos, selecione ou crie um perfil de marca.</p>
        </div>
        <div className="flex gap-3">
           <Button asChild variant="outline" className="rounded-full px-8 h-12 font-bold">
              <Link href="/dashboard/organizacoes">Ver Minhas Marcas</Link>
           </Button>
           <Button asChild className="bg-secondary text-white font-black px-10 h-12 rounded-full shadow-lg">
             <Link href="/dashboard/organizacoes/new">Criar Marca</Link>
           </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Eventos da Marca</h1>
          <p className="text-muted-foreground font-medium">Gestão de publicações de <strong>{currentOrg.name}</strong>.</p>
        </div>
        
        {isAtLeastEditor && (
          <Button asChild className="gap-2 bg-secondary text-white hover:bg-secondary/90 font-black rounded-full px-8 h-12 shadow-lg hover:scale-105 transition-transform uppercase italic">
            <Link href="/dashboard/projetos/novo">
              <Plus className="w-5 h-5" />
              Novo Evento
            </Link>
          </Button>
        )}
      </div>

      {!isAtLeastEditor && (
        <Alert className="bg-orange-50 border-orange-200">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="font-bold text-orange-800">Visualização Limitada</AlertTitle>
          <AlertDescription className="text-orange-700">
            Seu cargo nesta organização ({userRole}) permite apenas a visualização de eventos. Para criar ou editar, solicite permissão de <strong>Editor</strong> ao proprietário.
          </AlertDescription>
        </Alert>
      )}

      {eventsLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events?.map((event: any) => {
            const time = formatTime(event.date);
            const username = currentOrg.username;
            const eventLink = `/${username}/${event.id}`;
            
            return (
              <Card key={event.id} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all group rounded-[1.5rem] bg-white">
                <div className="relative h-40 bg-muted">
                   {event.image ? (
                     <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                   ) : (
                     <div className="flex items-center justify-center h-full opacity-20"><Megaphone className="w-10 h-10" /></div>
                   )}
                   <div className="absolute top-3 right-3">
                      <Badge className="bg-white/90 text-primary font-black uppercase text-[8px] h-5 shadow-sm border-none">
                        {event.status || "Ativo"}
                      </Badge>
                   </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                       <h4 className="font-bold text-base leading-tight line-clamp-1">{event.title}</h4>
                       {event.isRecurring && <Badge className="bg-secondary text-white text-[7px] font-black uppercase h-3.5"><RefreshCw className="w-2 h-2 mr-1 animate-spin-slow" /> Série Recorrente</Badge>}
                    </div>
                    {isAtLeastEditor && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full shrink-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-48">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/evento/${event.id}/editar`} className="flex items-center gap-2 py-2 cursor-pointer">
                              <Edit2 className="w-4 h-4" /> Editar Evento
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={eventLink} target="_blank" className="flex items-center gap-2 py-2 cursor-pointer">
                              <Eye className="w-4 h-4" /> Ver Anúncio
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/evento/${event.id}/cupons`} className="flex items-center gap-2 py-2 cursor-pointer">
                              <TicketPercent className="w-4 h-4 text-secondary" /> Cupons
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="flex items-center gap-2 text-destructive focus:text-destructive py-2 cursor-pointer"
                            onSelect={() => setEventToDelete({ id: event.id, title: event.title })}
                          >
                            <Trash2 className="w-4 h-4" /> Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-dashed">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                      <CalendarIcon className="w-3.5 h-3.5 text-secondary" />
                      <span>{formatDate(event.date)}</span>
                      {time && (
                        <><span className="mx-1 opacity-30">|</span><Clock className="w-3.5 h-3.5 text-secondary" /><span>{time}</span></>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                      <MapPin className="w-3.5 h-3.5 text-secondary" />
                      <span className="line-clamp-1">{event.city || "Local não definido"}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button variant="outline" size="sm" className="text-[10px] font-black uppercase h-9 rounded-xl gap-1.5 border-secondary text-secondary hover:bg-secondary/5" asChild>
                      <Link href={eventLink} target="_blank">Visualizar</Link>
                    </Button>
                    <Button variant="secondary" size="sm" className="text-[10px] font-black uppercase h-9 rounded-xl gap-1.5" asChild>
                      <Link href={`/dashboard/evento/${event.id}/publico`}>
                        <Users className="w-3.5 h-3.5" /> Público
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
          {isAtLeastEditor && (
            <Link 
              href="/dashboard/projetos/novo"
              className="border-2 border-dashed border-secondary/20 rounded-[1.5rem] p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-secondary/50 hover:text-secondary hover:bg-secondary/5 transition-all min-h-[250px] group"
            >
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center group-hover:bg-secondary group-hover:text-white transition-colors"><Plus className="w-6 h-6" /></div>
              <span className="font-black uppercase text-xs tracking-widest italic">Publicar Novo Evento</span>
            </Link>
          )}
        </div>
      )}

      <AlertDialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black italic uppercase italic tracking-tighter">Remover este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se existirem ingressos vendidos, o evento será apenas ocultado para preservar os vouchers. Caso contrário, será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px] tracking-widest">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90 rounded-xl font-black uppercase text-[10px] tracking-widest"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
