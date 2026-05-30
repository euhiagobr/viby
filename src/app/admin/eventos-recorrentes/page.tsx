'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Plus, Search, Loader2, ChevronRight, CalendarDays, Inbox } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function RecurringEventsAdminPage() {
  const db = useFirestore();
  const [search, setSearch] = React.useState("");

  const recurringQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'recurring_events'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: series, loading } = useCollection<any>(recurringQuery);

  const filteredSeries = React.useMemo(() => {
    if (!series) return [];
    return series.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));
  }, [series, search]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <RefreshCw className="w-8 h-8 text-secondary" />
            Eventos Recorrentes
          </h1>
          <p className="text-muted-foreground font-medium">Gestão de séries, agendas e programações periódicas.</p>
        </div>
        
        <Button asChild className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg hover:scale-105 transition-transform gap-2 uppercase italic">
          <Link href="/admin/eventos-recorrentes/novo">
            <Plus className="w-5 h-5" />
            Nova Série
          </Link>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar série pelo nome..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 rounded-xl"
        />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
      ) : filteredSeries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSeries.map((s) => (
            <Card key={s.id} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all rounded-[2rem] bg-white group">
              <CardHeader className="bg-muted/30 p-8 border-b">
                <div className="flex justify-between items-start">
                   <div className="p-3 bg-secondary/10 rounded-2xl text-secondary"><RefreshCw className="w-5 h-5" /></div>
                   <Badge className="bg-secondary text-white uppercase text-[9px] font-black px-3">{s.frequency}</Badge>
                </div>
                <div className="mt-4">
                  <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary line-clamp-1">{s.name}</CardTitle>
                  <CardDescription className="text-xs font-bold text-secondary uppercase tracking-widest mt-1">Série de Eventos</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                       <CalendarDays className="w-4 h-4 text-secondary" />
                       Início: {new Date(s.startDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                       <Clock className="w-4 h-4 text-secondary" />
                       {s.startTime} às {s.endTime}
                    </div>
                 </div>
                 <Button asChild className="w-full bg-primary text-white font-black h-11 rounded-xl uppercase italic text-[10px] gap-2">
                    <Link href={`/admin/eventos-recorrentes/${s.id}`}>
                       Gerenciar Ocorrências <ChevronRight className="w-4 h-4" />
                    </Link>
                 </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center gap-4">
           <Inbox className="w-12 h-12 text-muted-foreground opacity-10" />
           <p className="text-muted-foreground font-bold italic">Nenhuma série de eventos recorrentes cadastrada.</p>
        </div>
      )}
    </div>
  );
}
