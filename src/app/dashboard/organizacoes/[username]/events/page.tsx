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
  Loader2, 
  Calendar,
  MapPin,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  TicketPercent,
  Users,
  RefreshCw,
  History,
  Inbox,
  Clock,
  ShieldAlert,
  Archive,
  ArrowRight
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
import { cn, safeParseDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { format, startOfToday, addDays } from "date-fns";
import { EventCard } from '@/components/events/EventCard';

export default function OrganizationEventsPage() {
  const { currentOrg, userRole, loading: orgLoading } = useCurrentOrganization();
  const db = useFirestore();
  const [search, setSearch] = React.useState("");
  const [eventToDelete, setEventToDelete] = React.useState<{id: string, title: string} | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [now, setNow] = React.useState<Date>(new Date());

  React.useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
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

  const { upcomingEvents, pastEvents, deletedEvents } = React.useMemo(() => {
    if (!rawEvents) return { upcomingEvents: [], pastEvents: [], deletedEvents: [] };

    const upcoming: any[] = [];
    const past: any[] = [];
    const deleted: any[] = [];

    const filtered = rawEvents.filter(e => 
      (!search || e.title?.toLowerCase().includes(search.toLowerCase()))
    );

    filtered.forEach(e => {
      if (e.status === 'Excluído' || e.status === 'Oculto') {
        deleted.push({ ...e, _effectiveDate: e.date || e.startDate });
        return;
      }

      let isEventPast = false;
      let effectiveDate = e.date || e.startDate;
      const refTime = now.getTime();

      if (e.isRecurring) {
        const myOccs = allOccurrences?.filter((o: any) => o.parentId === e.id) || [];
        if (myOccs.length > 0) {
          const sorted = [...myOccs]
            .map(o => ({ ...o, _dt: safeParseDate(`${o.date}T${o.startTime || '19:00'}:00`) }))
            .filter(o => o._dt !== null)
            .sort((a, b) => a._dt!.getTime() - b._dt!.getTime());
          
          const nextValid = sorted.find(o => {
            const endThreshold = o._dt!.getTime();
            return refTime < endThreshold;
          });

          if (nextValid) {
            effectiveDate = nextValid._dt;
            isEventPast = false;
          } else {
            isEventPast = true;
          }
        } else {
          const baseDate = safeParseDate(effectiveDate);
          if (baseDate) {
            isEventPast = refTime >= baseDate.getTime();
          } else {
            isEventPast = false;
          }
        }
      } else {
        const start = safeParseDate(effectiveDate);
        if (!start) {
           isEventPast = false;
        } else {
           const end = safeParseDate(e.endDate) || start;
           let endMs = end.getTime();
           if (e.endDate && endMs < start.getTime()) {
             endMs += 24 * 60 * 60 * 1000;
           }
           isEventPast = refTime >= endMs;
        }
      }

      const enrichedEvent = { ...e, _effectiveDate: effectiveDate };
      if (isEventPast) {
        past.push(enrichedEvent);
      } else {
        upcoming.push(enrichedEvent);
      }
    });

    const sortByDate = (a: any, b: any) => {
      const timeA = safeParseDate(a._effectiveDate)?.getTime() || 0;
      const timeB = safeParseDate(b._effectiveDate)?.getTime() || 0;
      return timeA - timeB;
    };

    upcoming.sort(sortByDate);
    past.sort((a, b) => sortByDate(b, a)); // Histórico invertido
    deleted.sort(sortByDate);

    return { upcomingEvents: upcoming, pastEvents: past, deletedEvents: deleted };
  }, [rawEvents, allOccurrences, search, now]);

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

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

      const batch = writeBatch(db);

      if (!salesSnap.empty) {
        batch.update(eventRef, { status: "Oculto", updatedAt: serverTimestamp() });
        toast({ title: "Evento Ocultado", description: "Vendas detectadas. O projeto foi retirado do ar mas os vouchers continuam válidos." });
      } else {
        batch.update(eventRef, { status: "Excluído", updatedAt: serverTimestamp() });
        const occsQuery = query(collection(db, "recurring_occurrences"), where("parentId", "==", eventToDelete.id));
        const occsSnap = await getDocs(occsQuery);
        occsSnap.forEach(d => batch.delete(d.ref));
        toast({ title: "Evento removido" });
      }
      
      await batch.commit();
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
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12 flex-wrap">
          <TabsTrigger value="upcoming" className="rounded-lg px-6 font-bold gap-2 data-[state=active]:bg-white">
            <Calendar className="w-4 h-4" />
            Ativos ({upcomingEvents.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="rounded-lg px-6 font-bold gap-2 data-[state=active]:bg-white">
            <History className="w-4 h-4" />
            Histórico ({pastEvents.length})
          </TabsTrigger>
          <TabsTrigger value="deleted" className="rounded-lg px-6 font-bold gap-2 data-[state=active]:bg-white">
            <Trash2 className="w-4 h-4" />
            Deletados ({deletedEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="m-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
          ) : upcomingEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="relative group/edit-card">
                   <EventCard event={event} />
                   
                   {isAtLeastEditor && (
                     <div className="absolute top-4 right-4 z-30 opacity-0 group-hover/edit-card:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full shadow-2xl border-4 border-white">
                              <MoreHorizontal className="w-5 h-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl w-48">
                             <DropdownMenuItem asChild>
                                <Link href={`/dashboard/evento/${event.id}/editar`} className="flex items-center gap-2 py-2 cursor-pointer">
                                   <Edit className="w-4 h-4" /> Editar Evento
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
                     </div>
                   )}

                   <div className="absolute bottom-6 right-6 z-30 opacity-0 group-hover/edit-card:opacity-100 transition-opacity flex flex-col gap-2">
                      <Button variant="secondary" size="sm" asChild className="rounded-xl h-9 px-4 font-black uppercase italic text-[9px] gap-2 shadow-xl">
                         <Link href={`/dashboard/evento/${event.id}/publico`}><Users className="w-3.5 h-3.5" /> Público</Link>
                      </Button>
                   </div>
                </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {pastEvents.map((event) => (
                <div key={event.id} className="opacity-75 grayscale-[0.3]">
                   <EventCard event={event} />
                </div>
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

        <TabsContent value="deleted" className="m-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
          ) : deletedEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {deletedEvents.map((event) => (
                <div key={event.id} className="opacity-50 grayscale">
                   <EventCard event={event} />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-border flex flex-col items-center justify-center gap-4 opacity-40">
               <Archive className="w-12 h-12" />
               <p className="text-xs font-black uppercase tracking-widest italic">A lixeira está vazia</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
  );
}

function NoEventsPlaceholder({ message, isAtLeastEditor, icon: Icon = Megaphone }: any) {
  return (
    <div className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-border flex flex-col items-center justify-center gap-4 shadow-inner w-full">
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
