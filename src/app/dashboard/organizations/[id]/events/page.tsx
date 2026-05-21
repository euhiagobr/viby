'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
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
  Trash2
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

export default function OrganizationEventsPage() {
  const { currentOrg, userRole } = useCurrentOrganization();
  const db = useFirestore();
  const [search, setSearch] = React.useState("");

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return query(
      collection(db, 'events'), 
      where('organizationId', '==', currentOrg.id),
      orderBy('createdAt', 'desc')
    );
  }, [db, currentOrg?.id]);

  const { data: events, loading } = useCollection<any>(eventsQuery);

  const filteredEvents = React.useMemo(() => {
    if (!events) return [];
    return events.filter(e => e.title?.toLowerCase().includes(search.toLowerCase()));
  }, [events, search]);

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-secondary" />
            Eventos da Marca
          </h1>
          <p className="text-muted-foreground font-medium">Gerencie o calendário de publicações da sua organização.</p>
        </div>
        
        {isAtLeastEditor && (
          <Button asChild className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg hover:scale-105 transition-transform gap-2">
            <Link href="/dashboard/projetos/novo">
              <Plus className="w-5 h-5" />
              Publicar Evento
            </Link>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
          {filteredEvents.map((event) => (
            <Card key={event.id} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all rounded-[1.5rem] bg-white group">
              <div className="relative h-40 bg-muted">
                {event.banner ? (
                  <img src={event.banner} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="flex items-center justify-center h-full opacity-20"><Megaphone className="w-12 h-12" /></div>
                )}
                <div className="absolute top-3 right-3">
                   <Badge className={cn(
                     "uppercase text-[9px] font-black px-2.5 h-6",
                     event.status === 'published' ? 'bg-green-500' : 'bg-muted text-muted-foreground'
                   )}>
                     {event.status === 'published' ? 'Publicado' : 'Rascunho'}
                   </Badge>
                </div>
              </div>
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                   <h3 className="font-bold text-base leading-tight line-clamp-1">{event.title}</h3>
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl w-48">
                         <DropdownMenuItem asChild>
                            <Link href={`/${currentOrg?.username}/${event.id}`} target="_blank" className="flex items-center gap-2 cursor-pointer py-2">
                               <Eye className="w-4 h-4" /> Ver Público
                            </Link>
                         </DropdownMenuItem>
                         <DropdownMenuItem asChild>
                            <Link href={`/dashboard/evento/${event.id}/editar`} className="flex items-center gap-2 cursor-pointer py-2">
                               <Edit className="w-4 h-4" /> Editar
                            </Link>
                         </DropdownMenuItem>
                         <DropdownMenuSeparator />
                         <DropdownMenuItem className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer py-2">
                            <Trash2 className="w-4 h-4" /> Excluir
                         </DropdownMenuItem>
                      </DropdownMenuContent>
                   </DropdownMenu>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-dashed">
                   <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                      <Calendar className="w-3 h-3 text-secondary" />
                      {new Date(event.startDate).toLocaleDateString('pt-BR')}
                   </div>
                   <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                      <MapPin className="w-3 h-3 text-secondary" />
                      {event.location}
                   </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center gap-4">
           <Megaphone className="w-12 h-12 text-muted-foreground opacity-20" />
           <p className="text-muted-foreground font-bold italic">Nenhum evento encontrado para esta marca.</p>
           {isAtLeastEditor && (
             <Button asChild variant="outline" className="rounded-full font-bold h-10 border-secondary text-secondary">
               <Link href="/dashboard/projetos/novo">Criar Primeiro Evento</Link>
             </Button>
           )}
        </div>
      )}
    </div>
  );
}
