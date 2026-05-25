
'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Ticket, 
  Search, 
  Calendar, 
  MapPin, 
  ChevronRight, 
  Users, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  FilterX,
  Building2,
  Clock,
  LayoutGrid
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import Link from 'next/link';
import { formatCurrency } from '@/lib/financial-utils';
import { cn } from "@/lib/utils";

export default function AdminIngressosDashboard() {
  const db = useFirestore();
  const [search, setSearch] = React.useState("");
  const [selectedDate, setSelectedDate] = React.useState<string>("");
  const [selectedCity, setSelectedCity] = React.useState("all");

  const eventsQuery = useMemoFirebase(() => {
    if (!db) return null;
    // Removido orderBy para evitar necessidade de índice composto inicial
    return query(collection(db, "events"), where("status", "==", "Ativo"));
  }, [db]);

  const { data: events, loading } = useCollection<any>(eventsQuery);

  const filteredEvents = React.useMemo(() => {
    if (!events) return [];
    let result = events.filter(e => {
      const eDate = e.date?.toDate ? e.date.toDate().toISOString().split('T')[0] : e.date?.split('T')[0];
      const matchesDate = !selectedDate || eDate === selectedDate;
      const matchesCity = selectedCity === 'all' || e.city === selectedCity;
      const matchesSearch = !search || e.title?.toLowerCase().includes(search.toLowerCase());
      return matchesDate && matchesCity && matchesSearch;
    });

    // Ordenar em memória para garantir funcionamento sem índice
    return result.sort((a, b) => {
      const dateA = a.date?.seconds || new Date(a.date).getTime();
      const dateB = b.date?.seconds || new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [events, selectedDate, selectedCity, search]);

  const cities = React.useMemo(() => {
    if (!events) return [];
    const list = Array.from(new Set(events.map((e: any) => e.city))).filter(Boolean);
    return list.sort();
  }, [events]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Ticket className="w-8 h-8 text-secondary" />
          Operação de Ingressos
        </h1>
        <p className="text-muted-foreground font-medium">Controle operacional e monitoramento de vendas em tempo real.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <KPICard title="Eventos Ativos" value={events?.length || 0} icon={LayoutGrid} color="blue" />
         <KPICard title="Cidades Atendidas" value={cities.length} icon={MapPin} color="green" />
         <KPICard title="Ocupação Geral" value="---" icon={Users} color="orange" />
         <KPICard title="Status" value="Operacional" icon={CheckCircle2} color="secondary" />
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
        <CardHeader className="p-8 border-b">
           <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-3 space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-40 ml-1">Filtrar por Data</Label>
                <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="rounded-xl h-11" />
              </div>
              <div className="md:col-span-3 space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-40 ml-1">Cidade</Label>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todas as cidades</SelectItem>
                    {cities.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-4 space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-40 ml-1">Buscar Evento</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Nome do show, festival..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-11 rounded-xl" />
                </div>
              </div>
              <div className="md:col-span-2">
                 <Button variant="outline" className="w-full h-11 rounded-xl border-dashed" onClick={() => { setSearch(""); setSelectedCity("all"); setSelectedDate(""); }}>
                    <FilterX className="w-4 h-4 mr-2" /> Limpar
                 </Button>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
           {loading ? (
             <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
           ) : filteredEvents.length > 0 ? (
             <div className="divide-y">
               {filteredEvents.map((event) => (
                 <EventOpRow key={event.id} event={event} />
               ))}
             </div>
           ) : (
             <div className="py-24 text-center opacity-30 italic">Nenhum evento operacional localizado para os filtros.</div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}

function EventOpRow({ event }: { event: any }) {
  const db = useFirestore();
  const regsQuery = useMemoFirebase(() => db ? query(collection(db, "registrations"), where("eventId", "==", event.id)) : null, [db, event.id]);
  const { data: regs } = useCollection<any>(regsQuery);

  const stats = React.useMemo(() => {
    if (!regs) return { sold: 0, checkedIn: 0, revenue: 0 };
    return regs.reduce((acc: any, r: any) => {
      // Consideramos Pago ou Disponível (grátis) como venda concluída
      if (['Pago', 'Disponível'].includes(r.paymentStatus)) {
        acc.sold++;
        acc.revenue += (r.price || r.ticketBasePrice || 0);
        if (r.checkedIn) acc.checkedIn++;
      }
      return acc;
    }, { sold: 0, checkedIn: 0, revenue: 0 });
  }, [regs]);

  const occupancy = event.capacidadeTotal > 0 ? Math.round((stats.sold / event.capacidadeTotal) * 100) : 0;

  return (
    <Link href={`/admin/ingressos/${event.id}`} className="block hover:bg-muted/10 transition-colors">
      <div className="px-8 py-6 grid grid-cols-12 gap-6 items-center">
        <div className="col-span-4 flex items-center gap-4">
           <div className="h-12 w-12 rounded-xl bg-muted overflow-hidden relative shrink-0">
              {event.image && <img src={event.image} className="w-full h-full object-cover" alt="Event" />}
           </div>
           <div className="space-y-1">
              <h4 className="font-black text-sm uppercase italic text-primary truncate leading-tight">{event.title}</h4>
              <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase">
                 <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-secondary" /> {event.date?.toDate ? event.date.toDate().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : "---"}</span>
                 <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-secondary" /> {event.city}</span>
              </div>
           </div>
        </div>
        <div className="col-span-2 text-center">
           <p className="text-[10px] font-black uppercase opacity-40 mb-1">Vendas</p>
           <p className="text-sm font-black text-primary">{stats.sold} <span className="text-[10px] opacity-40 font-bold">/ {event.capacidadeTotal || '---'}</span></p>
        </div>
        <div className="col-span-2 text-center">
           <p className="text-[10px] font-black uppercase opacity-40 mb-1">Check-in</p>
           <p className="text-sm font-black text-green-600">{stats.checkedIn} <span className="text-[10px] opacity-40 font-bold">({stats.sold > 0 ? Math.round((stats.checkedIn / stats.sold) * 100) : 0}%)</span></p>
        </div>
        <div className="col-span-2 text-center">
           <p className="text-[10px] font-black uppercase opacity-40 mb-1">Ocupação</p>
           <div className="flex flex-col gap-1 px-4">
              <Progress value={occupancy} className="h-1.5" />
              <span className="text-[10px] font-black">{occupancy}%</span>
           </div>
        </div>
        <div className="col-span-1 text-right">
           <p className="text-[10px] font-black uppercase opacity-40 mb-1">Receita</p>
           <p className="text-sm font-black text-primary">{formatCurrency(stats.revenue)}</p>
        </div>
        <div className="col-span-1 text-right">
           <Button variant="ghost" size="icon" className="rounded-full"><ChevronRight className="w-5 h-5 text-muted-foreground/30" /></Button>
        </div>
      </div>
    </Link>
  );
}

function KPICard({ title, value, icon: Icon, color }: any) {
  const colors: any = { 
    blue: "text-blue-500 bg-blue-50", 
    green: "text-green-600 bg-green-50", 
    orange: "text-orange-500 bg-orange-50", 
    secondary: "text-secondary bg-secondary/5" 
  };
  return (
    <Card className="border-none shadow-sm rounded-3xl bg-white group">
       <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className={cn("p-2.5 rounded-2xl transition-transform group-hover:scale-110", colors[color])}><Icon className="w-5 h-5" /></div>
          </div>
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">{title}</p>
          <p className="text-2xl font-black text-primary">{value}</p>
       </CardContent>
    </Card>
  );
}
