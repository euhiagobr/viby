'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, writeBatch, getDocs, limit, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Megaphone, 
  Plus, 
  Search, 
  Filter, 
  Loader2, 
  Calendar,
  MapPin,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  TicketPercent,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  Map as MapIcon,
  History,
  Inbox,
  RefreshCw
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { format, startOfToday, addDays } from "date-fns";

export default function OrganizationEventsPage() {
  const { currentOrg, userRole } = useCurrentOrganization();
  const db = useFirestore();
  const [search, setSearch] = React.useState("");
  const [eventToDelete, setEventToDelete] = React.useState<{id: string, title: string} | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [now, setNow] = React.useState<Date>(new Date());

  React.useEffect(() => {
    setNow(new Date());
  }, []);

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return query(
      collection(db, 'events'), 
      where('organizationId', '==', currentOrg.id)
    );
  }, [db, currentOrg?.id]);

  const { data: rawEvents, loading } = useCollection<any>(eventsQuery);

  const occurrencesQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    const yesterdayStr = format(addDays(startOfToday(), -1), 'yyyy-MM-dd');
    return query(
      collection(db, "recurring_occurrences"), 
      where("organizationId", "==", currentOrg.id),
      where("status", "==", "active"),
      where("date", ">=", yesterdayStr)
    );
  }, [db, currentOrg?.id]);

  const { data: allOccurrences } = useCollection<any>(occurrencesQuery);

  const { upcomingEvents, pastEvents } = React.useMemo(() => {
    if (!rawEvents) return { upcomingEvents: [], pastEvents: [] };

    const upcoming: any[] = [];
    const past: any[] = [];

    const filtered = rawEvents.filter(e => 
      e.status !== 'Excluído' && 
      (!search || e.title?.toLowerCase().includes(search.toLowerCase()))
    );

    filtered.forEach(e => {
      let isEventPast = false;
      let effectiveDate = e.date || e.startDate;

      if (e.isRecurring) {
        const myOccs = allOccurrences?.filter((o: any) => o.parentId === e.id) || [];
        if (myOccs.length > 0) {
          const sorted = [...myOccs]
            .map(o => ({ ...o, _dt: new Date(o.date + 'T' + (o.startTime || '00:00') + ':00') }))
            .sort((a, b) => a._dt.getTime() - b._dt.getTime());
          
          const nextValid = sorted.find(o => {
            const endThreshold = new Date(o._dt.getTime() + 6 * 60 * 60 * 1000);
            return now < endThreshold;
          });

          if (nextValid) {
            effectiveDate = nextValid.date + 'T' + (nextValid.startTime || '00:00') + ':00';
            isEventPast = false;
          } else {
            // Se tem ocorrências mas nenhuma é futura ou recente, é passado
            isEventPast = true;
          }
        } else {
          // Se não há ocorrências futuras na lista (query restringida a >= yesterday)
          // Mas o evento é marcado como recorrente, verificamos se a data original já passou
          const start = effectiveDate?.toDate ? effectiveDate.toDate() : new Date(effectiveDate);
          const end = e.endDate?.toDate ? e.endDate.toDate() : (e.endDate ? new Date(e.endDate) : new Date(start.getTime() + 4 * 60 * 60 * 1000));
          isEventPast = end < now;
        }
      } else {
        const start = effectiveDate?.toDate ? effectiveDate.toDate() : new Date(effectiveDate);
        const end = e.endDate?.toDate ? e.endDate.toDate() : (e.endDate ? new Date(e.endDate) : new Date(start.getTime() + 4 * 60 * 60 * 1000));
        isEventPast = end < now;
      }

      const enrichedEvent = { ...e, _effectiveDate: effectiveDate };
      if (isEventPast) {
        past.push(enrichedEvent);
      } else {
        upcoming.push(enrichedEvent);
      }
    });

    // Ordenação: Próximos por data Ascendente, Passados por data Descendente
    upcoming.sort((a, b) => {
      const tA = a._effectiveDate?.toDate ? a._effectiveDate.toDate().getTime() : new Date(a._effectiveDate).getTime();
      const tB = b._effectiveDate?.toDate ? b._effectiveDate.toDate().getTime() : new Date(b._effectiveDate).getTime();
      return tA - tB;
    });

    past.sort((a, b) => {
      const dA = a.date || a.startDate;
      const dB = b.date || b.startDate;
      const tA = dA?.toDate ? dA.toDate().getTime() : new Date(dA).getTime();
      const tB = dB?.toDate ? dB.toDate().getTime() : new Date(dB).getTime();
      return tB - tA;
    });

    return { upcomingEvents: upcoming, pastEvents: past };
  }, [rawEvents, allOccurrences, search, now]);

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');
  const canCheckIn = ['owner', 'admin', 'editor', 'checkin'].includes(userRole || '');

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "A definir";
    try {
      let d: Date;
      if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
        d = dateValue.toDate();
      } else {
        d = new Date(dateValue);
      }
      return isNaN(d.getTime()) ? "A definir" : d.toLocaleDateString('pt-BR');
    } catch (e) { return "A definir"; }
  };

  const formatTime = (dateValue: any) => {
    if (!dateValue) return "";
    try {
      let d: Date;
      if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
        d = dateValue.toDate();
      } else {
        d = new Date(dateValue);
      }
      return isNaN(d.getTime()) ? "" : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ""; }
  };

  const confirmDelete = async () => {
    if (!db || !eventToDelete) return;
    setIsDeleting(true);
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
        await updateDoc(eventRef, { status: "Oculto", updatedAt: serverTimestamp() });
        toast({ title: "Evento Ocultado", description: "Vendas detectadas. O projeto foi retirado do ar mas os vouchers continuam válidos." });
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
      errorEmitter.emit("permission-error", new FirestorePermissionError({ path: `events/${eventToDelete?.id}`, operation: "update" }));
    } finally {
      setIsDeleting(false);
      setEventToDelete(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-secondary" />
            Eventos da Marca
          </h1>
          <p className="text-muted-foreground font-medium">Gerencie suas publicações de <strong>{currentOrg?.name}</strong>.</p>
        </div>
        
        {isAtLeastEditor && (
          <Button asChild className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg hover:scale-105 transition-transform gap-2 uppercase italic">
            <Link href="/dashboard/projetos/novo">
              <Plus className="w-5 h-5" />
              Novo Evento
            </Link>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar eventos da marca..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>
      </div>

      <Tabs defaultValue="upcoming" className="w-full space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12">
          <TabsTrigger value="upcoming" className="rounded-lg px-6 font-bold gap-2 data-[state=active]:bg-white">
            <Calendar className="w-4 h-4" />
            Próximos / Gestão ({upcomingEvents.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="rounded-lg px-8 font-bold gap-2 data-[state=active]:bg-white">
            <History className="w-4 h-4" />
            Passados ({pastEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="m-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
          ) : upcomingEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingEvents.map((event) => (
                <EventRow 
                  key={event.id} 
                  event={event} 
                  currentOrg={currentOrg} 
                  isAtLeastEditor={isAtLeastEditor} 
                  canCheckIn={canCheckIn} 
                  formatDate={formatDate}
                  formatTime={formatTime}
                  setEventToDelete={setEventToDelete}
                />
              ))}
            </div>
          ) : (
            <NoEventsPlaceholder 
              message={search ? "Nenhum evento futuro para esta busca." : "Nenhum evento agendado."} 
              isAtLeastEditor={isAtLeastEditor}
            />
          )}
        </TabsContent>

        <TabsContent value="past" className="m-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
          ) : pastEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastEvents.map((event) => (
                <EventRow 
                  key={event.id} 
                  event={event} 
                  currentOrg={currentOrg} 
                  isAtLeastEditor={isAtLeastEditor} 
                  canCheckIn={canCheckIn} 
                  formatDate={formatDate}
                  formatTime={formatTime}
                  setEventToDelete={setEventToDelete}
                  isPast
                />
              ))}
            </div>
          ) : (
            <NoEventsPlaceholder 
              message={search ? "Nenhum evento passado para esta busca." : "Nenhum evento no histórico."} 
              isAtLeastEditor={false}
              icon={History}
            />
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter">Remover este evento?</AlertDialogTitle>
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
  );
}

function EventRow({ 
  event, 
  currentOrg, 
  isAtLeastEditor, 
  canCheckIn, 
  formatDate, 
  formatTime, 
  setEventToDelete,
  isPast = false 
}: any) {
  const dateValue = event._effectiveDate || event.date || event.startDate;
  const time = formatTime(dateValue);
  const eventLink = `/${currentOrg?.username}/${event.id}`;

  return (
    <Card className={cn(
      "overflow-hidden border-none shadow-sm hover:shadow-md transition-all rounded-[1.5rem] bg-white group",
      isPast && "opacity-75 grayscale-[0.3]"
    )}>
      <div className="relative h-40 bg-muted">
        {event.image ? (
          <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="flex items-center justify-center h-full opacity-20"><Megaphone className="w-12 h-12" /></div>
        )}
        <div className="absolute top-3 right-3">
           <Badge className={cn(
             "uppercase text-[9px] font-black px-2.5 h-6 shadow-sm border-none",
             event.status === 'Ativo' ? 'bg-white/90 text-primary' : 'bg-muted text-muted-foreground'
           )}>
             {event.status || 'Pendente'}
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
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl w-48">
                <DropdownMenuItem asChild>
                   <Link href={`/dashboard/evento/${event.id}/editar`} className="flex items-center gap-2 py-2 cursor-pointer">
                      <Edit className="w-4 h-4" /> Editar Evento
                   </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                   <Link href={`/dashboard/evento/${event.id}/mapa`} className="flex items-center gap-2 py-2 cursor-pointer text-secondary">
                      <MapIcon className="w-4 h-4" /> Mapa de Ingressos
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
            <Calendar className="w-3.5 h-3.5 text-secondary" />
            <span>{event.isRecurring && !isPast ? "Próxima: " : ""}{formatDate(dateValue)}</span>
            {time && (
              <><span className="mx-1 opacity-30">|</span><Clock className="w-3.5 h-3.5 text-secondary" /><span>{time}</span></>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
            <MapPin className="w-3.5 h-3.5 text-secondary" />
            <span className="line-clamp-1">{event.city || event.location || "Local não definido"}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="outline" size="sm" className="text-[10px] font-black uppercase h-9 rounded-xl gap-1.5 border-secondary text-secondary hover:bg-secondary/5" asChild>
            <Link href={eventLink} target="_blank">Visualizar</Link>
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            disabled={!canCheckIn}
            className="text-[10px] font-black uppercase h-9 rounded-xl gap-1.5" 
            asChild
          >
            <Link href={`/dashboard/evento/${event.id}/publico`}>
               <Users className="w-3.5 h-3.5" /> Público
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  )
}

function NoEventsPlaceholder({ message, isAtLeastEditor, icon: Icon = Megaphone }: any) {
  return (
    <div className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center gap-4 shadow-inner w-full">
       <Icon className="w-12 h-12 text-muted-foreground opacity-10" />
       <p className="text-muted-foreground font-bold italic">{message}</p>
       {isAtLeastEditor && (
         <Button asChild variant="outline" className="rounded-full font-bold h-10 border-secondary text-secondary">
           <Link href="/dashboard/projetos/novo">Criar Primeiro Evento</Link>
         </Button>
       )}
    </div>
  )
}
