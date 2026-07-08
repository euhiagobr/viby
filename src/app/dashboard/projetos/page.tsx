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
  RefreshCw,
  History,
  Archive,
  Inbox
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { format, startOfToday, addDays } from "date-fns"
import { cn, safeParseDate } from "@/lib/utils"
import { EventCard } from "@/components/events/EventCard"

export default function MeusEventosPage() {
  const db = useFirestore()
  const { currentOrg, userRole, loading: orgLoading } = useCurrentOrganization()
  const [search, setSearch] = React.useState("")
  const [now, setNow] = React.useState<Date>(new Date())

  React.useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const myEventsQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null
    return query(collection(db, "events"), where("organizationId", "==", currentOrg.id))
  }, [db, currentOrg?.id])

  const { data: rawEvents, loading: eventsLoading } = useCollection<any>(myEventsQuery)

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

  const { upcomingEvents, pastEvents, deletedEvents } = React.useMemo(() => {
    if (!rawEvents) return { upcomingEvents: [], pastEvents: [], deletedEvents: [] };

    // DEBUG: Log eventos que chegam
    const problematicEvents = rawEvents.filter(e => 
      e.title?.includes('Improvisa') || e.title?.includes('Espetáculo')
    );
    if (problematicEvents.length > 0) {
      console.table(problematicEvents.map(e => ({
        title: e.title,
        date: e.date?.toString?.() || e.date,
        startTime: e.startTime,
        endDate: e.endDate?.toString?.() || e.endDate,
        endTime: e.endTime,
        status: e.status,
        id: e.id.substring(0, 8)
      })));
    }

    const upcoming: any[] = [];
    const past: any[] = [];
    const deleted: any[] = [];

    const filtered = rawEvents.filter(e => 
      (!search || e.title?.toLowerCase().includes(search.toLowerCase()))
    );

    filtered.forEach(e => {
      // DEBUG: Rastrear eventos problemáticos
      const isProblematic = e.title?.includes('Improvisa') || e.title?.includes('Espetáculo');
      if (isProblematic) {
        console.log(`\n[TRACE PROJETOS] Iniciando processamento de: ${e.title}`, {
          id: e.id.substring(0, 8),
          status: e.status,
          isRecurring: e.isRecurring,
          date_type: e.date?.constructor?.name || typeof e.date,
          endDate_type: e.endDate?.constructor?.name || typeof e.endDate
        });
      }

      if (e.status === 'Excluído' || e.status === 'Oculto') {
        deleted.push({ ...e, _effectiveDate: e.date || e.startDate });
        return;
      }

      let isEventPast = false;
      let effectiveDate = e.date || e.startDate;
      let _nextOccurrence: any = null;
      const refTime = now.getTime();
      
      if (isProblematic) {
        console.log(`[TRACE PROJETOS] Após status check, effectiveDate:`, effectiveDate?.toString?.() || effectiveDate);
      }

      if (e.isRecurring) {
        if (isProblematic) console.log(`[TRACE PROJETOS] Evento é RECORRENTE`);
        const myOccs = allOccurrences?.filter((o: any) => o.parentId === e.id) || [];
        if (isProblematic) {
          console.log(`[TRACE PROJETOS] myOccs encontradas: ${myOccs.length}`);
        }
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
            _nextOccurrence = nextValid;
            isEventPast = false;
            if (isProblematic) console.log(`[TRACE PROJETOS] Próxima ocorrência encontrada: ${nextValid._dt}`);
          } else {
            isEventPast = true;
            if (isProblematic) console.log(`[TRACE PROJETOS] Nenhuma próxima ocorrência (todas no passado)`);
          }
        } else {
          if (isProblematic) console.log(`[TRACE PROJETOS] AVISO: Evento recorrente SEM ocorrências! Usando baseDate...`);
          const baseDate = safeParseDate(effectiveDate);
          if (baseDate) {
            isEventPast = refTime >= baseDate.getTime();
            if (isProblematic) {
              console.log(`[TRACE PROJETOS] baseDate: ${baseDate.toISOString()}, refTime >= baseDate: ${isEventPast}`);
            }
          } else {
            isEventPast = false;
            if (isProblematic) console.log(`[TRACE PROJETOS] Erro parseando baseDate!`);
          }
        }
      } else {
        if (isProblematic) console.log(`[TRACE PROJETOS] Evento é NÃO-RECORRENTE`);
        // Para eventos não-recorrentes: usar hora de início se disponível
        const dateWithTime = e.startTime ? `${effectiveDate}T${e.startTime}:00` : effectiveDate;
        if (isProblematic) {
          console.log(`[TRACE PROJETOS] dateWithTime construído como:`, {
            template: e.startTime ? `\${effectiveDate}T\${e.startTime}:00` : 'effectiveDate',
            resultado: dateWithTime?.toString?.() || dateWithTime
          });
        }
        const start = safeParseDate(dateWithTime);
        if (!start) {
           isEventPast = false;
        } else {
           // Se não houver endDate, usar endTime do evento. Se não houver endTime, usar meia-noite do mesmo dia
           let end: Date;
           if (e.endDate) {
             const endWithTime = e.endTime ? `${e.endDate}T${e.endTime}:00` : e.endDate;
             end = safeParseDate(endWithTime) || start;
           } else {
             // Se não houver endDate, criar um fim padrão no mesmo dia com endTime ou fim do dia
             if (e.endTime) {
               end = safeParseDate(`${effectiveDate}T${e.endTime}:00`) || start;
             } else {
               // Usar meia-noite do próximo dia como fim padrão
               end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
             }
           }
           
           let endMs = end.getTime();
           if (e.endDate && endMs < start.getTime()) {
             endMs += 24 * 60 * 60 * 1000;
           }
           isEventPast = refTime > endMs; // Usar > ao invés de >= para não considerar passado se terminou agora
           
           // DEBUG LOG para eventos específicos
           if (e.title?.includes('Improvisa') || e.title?.includes('Espetáculo')) {
             console.log(`[FILTER PROJETOS] ${e.title}:`, {
               agora: new Date(refTime).toISOString(),
               fimEvento: new Date(endMs).toISOString(),
               refTime_maior_que_endMs: refTime > endMs,
               resultado_isEventPast: isEventPast,
               aba: isEventPast ? 'HISTÓRICO ✓' : 'ATIVO ✗'
             });
           }
        }
      }

      const enrichedEvent = { ...e, _effectiveDate: effectiveDate, _nextOccurrence };
      
      if (isProblematic) {
        console.log(`[TRACE PROJETOS] Resultado final: isEventPast=${isEventPast} -> ${isEventPast ? 'HISTÓRICO' : 'ATIVOS'}`);
      }

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

    // DEBUG: Log resultado final
    const finalProblematic = upcoming.filter(e => 
      e.title?.includes('Improvisa') || e.title?.includes('Espetáculo')
    );
    const finalPastProblematic = past.filter(e => 
      e.title?.includes('Improvisa') || e.title?.includes('Espetáculo')
    );
    if (finalProblematic.length > 0 || finalPastProblematic.length > 0) {
      console.log(`\n=== [DASHBOARD PROJETOS FINAL] Categorização de Eventos ===`);
      if (finalProblematic.length > 0) {
        console.log('✗ ATIVOS (Upstream - ERRADO):');
        console.table(finalProblematic.map(e => ({ title: e.title, id: e.id.substring(0, 8) })));
      }
      if (finalPastProblematic.length > 0) {
        console.log('✓ HISTÓRICO (Correto):');
        console.table(finalPastProblematic.map(e => ({ title: e.title, id: e.id.substring(0, 8) })));
      }
    }

    return { upcomingEvents: upcoming, pastEvents: past, deletedEvents: deleted };
  }, [rawEvents, allOccurrences, search, now]);

  const [eventToDelete, setEventToDelete] = React.useState<{id: string, title: string} | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

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
        await updateDoc(eventRef, { status: "Oculto", updatedAt: serverTimestamp() });
        toast({ title: "Evento Ocultado", description: "Vendas detectadas. O evento foi retirado do ar mas os ingressos continuam válidos." });
      } else {
        const batch = writeBatch(db);
        batch.update(eventRef, { status: "Excluído", updatedAt: serverTimestamp() });
        const occsQuery = query(collection(db, "recurring_occurrences"), where("parentId", "==", eventToDelete.id));
        const occsSnap = await getDocs(occsQuery);
        occsSnap.forEach((d) => batch.delete(d.ref));
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
            <CalendarIcon className="w-4 h-4" />
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
          {eventsLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
          ) : upcomingEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingEvents.map((event: any) => (
                <div key={event.id} className="relative group/edit-card">
                  <EventCard event={event} />
                  {isAtLeastEditor && (
                    <div className="absolute top-4 right-4 z-30 opacity-0 group-hover/edit-card:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full shrink-0 shadow-lg border-2 border-white">
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
                            <Link href={`/${event.organizer?.username}/${event.slug || event.id}`} target="_blank" className="flex items-center gap-2 py-2 cursor-pointer">
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
                    </div>
                  )}
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
          {eventsLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
          ) : pastEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastEvents.map((event: any) => (
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
          {eventsLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
          ) : deletedEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {deletedEvents.map((event: any) => (
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
  )
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
