
'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, writeBatch, getDocs } from 'firebase/firestore';
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
  Map as MapIcon
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
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function OrganizationEventsPage() {
  const { currentOrg, userRole } = useCurrentOrganization();
  const db = useFirestore();
  const [search, setSearch] = React.useState("");
  const [eventToDelete, setEventToDelete] = React.useState<{id: string, title: string} | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return query(
      collection(db, 'events'), 
      where('organizationId', '==', currentOrg.id)
    );
  }, [db, currentOrg?.id]);

  const { data: rawEvents, loading } = useCollection<any>(eventsQuery);

  const events = React.useMemo(() => {
    if (!rawEvents) return [];
    return [...rawEvents]
      .filter(e => e.status !== 'Excluído')
      .sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });
  }, [rawEvents]);

  const filteredEvents = React.useMemo(() => {
    return events.filter(e => 
      e.title?.toLowerCase().includes(search.toLowerCase())
    );
  }, [events, search]);

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
      const batch = writeBatch(db);
      const eventRef = doc(db, "events", eventToDelete.id);
      batch.update(eventRef, { status: "Excluído" });
      
      const regsQuery = query(collection(db, "registrations"), where("eventId", "==", eventToDelete.id));
      const regsSnap = await getDocs(regsQuery);
      regsSnap.forEach((regDoc) => batch.delete(regDoc.ref));
      
      await batch.commit();
      toast({ title: "Evento removido" });
    } catch (error: any) {
      errorEmitter.emit("permission-error", new FirestorePermissionError({
        path: `events/${eventToDelete.id}`,
        operation: "update",
        requestResourceData: { status: "Excluído" }
      }));
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
          <p className="text-muted-foreground font-medium">Gerencie o calendário de publicações de <strong>{currentOrg?.name}</strong>.</p>
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
        <Button variant="outline" className="h-12 w-12 rounded-xl" size="icon">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
      ) : filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => {
            const dateValue = event.startDate || event.date;
            const eventDate = dateValue ? (dateValue.toDate ? dateValue.toDate() : new Date(dateValue)) : null;
            const isToday = eventDate && eventDate.toDateString() === new Date().toDateString();
            const time = formatTime(dateValue);
            const eventLink = `/${currentOrg?.username}/${event.id}`;

            return (
              <Card key={event.id} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all rounded-[1.5rem] bg-white group">
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
                    <h4 className="font-bold text-base leading-tight line-clamp-1">{event.title}</h4>
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
                          <DropdownMenuItem asChild>
                             <Link href={`/dashboard/anuncios`} className="flex items-center gap-2 py-2 cursor-pointer text-secondary">
                                <Megaphone className="w-4 h-4" /> Impulsionar (Ads)
                             </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {userRole === 'owner' || userRole === 'admin' ? (
                            <DropdownMenuItem 
                              className="flex items-center gap-2 text-destructive focus:text-destructive py-2 cursor-pointer"
                              onSelect={() => setEventToDelete({ id: event.id, title: event.title })}
                            >
                              <Trash2 className="w-4 h-4" /> Excluir Evento
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-dashed">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                      <Calendar className="w-3.5 h-3.5 text-secondary" />
                      <span>{formatDate(dateValue)}</span>
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
                      variant={isToday ? "default" : "secondary"} 
                      size="sm" 
                      disabled={!canCheckIn}
                      className={cn(
                        "text-[10px] font-black uppercase h-9 rounded-xl gap-1.5",
                        isToday && canCheckIn && "bg-green-600 text-white hover:bg-green-700 shadow-md animate-pulse"
                      )} 
                      asChild
                    >
                      <Link href={`/dashboard/evento/${event.id}/publico`}>
                        {isToday ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                        {isToday ? "Portaria Aberta" : "Público"}
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
              <span className="font-black uppercase text-xs tracking-widest italic text-center">Publicar Novo Evento</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center gap-4 shadow-inner">
           <Megaphone className="w-12 h-12 text-muted-foreground opacity-10" />
           <p className="text-muted-foreground font-bold italic">Nenhum evento encontrado para esta marca.</p>
           {isAtLeastEditor && (
             <Button asChild variant="outline" className="rounded-full font-bold h-10 border-secondary text-secondary">
               <Link href="/dashboard/projetos/novo">Criar Primeiro Evento</Link>
             </Button>
           )}
        </div>
      )}

      <AlertDialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter">Excluir este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              O evento <strong>"{eventToDelete?.title}"</strong> e todos os seus ingressos serão removidos permanentemente. Esta ação não pode ser desfeita.
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
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
