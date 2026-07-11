'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Loader2,
  FilterX,
  Clock,
  LayoutGrid,
  Zap,
  Percent
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
  const [selectedCity, setSelectedCity] = React.useState("all");

  const eventsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "events"), where("status", "in", ["Ativo", "Oculto"]));
  }, [db]);

  const { data: events, loading } = useCollection<any>(eventsQuery);

  const filteredEvents = React.useMemo(() => {
    if (!events) return [];
    let result = events.filter(e => {
      const matchesCity = selectedCity === 'all' || e.city === selectedCity;
      const matchesSearch = !search || e.title?.toLowerCase().includes(search.toLowerCase());
      return matchesCity && matchesSearch;
    });

    return result.sort((a, b) => {
      const dateA = a.date?.seconds || new Date(a.date).getTime();
      const dateB = b.date?.seconds || new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [events, selectedCity, search]);

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
        <p className="text-muted-foreground font-medium">Monitoramento operacional de vendas e check-ins em tempo real.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <KPICard title="Projetos Monitorados" value={events?.length || 0} icon={LayoutGrid} color="blue" />
         <KPICard title="Cidades Atendidas" value={cities.length} icon={MapPin} color="green" />
         <KPICard title="Vendas Brutas (ERP)" value="---" icon={TrendingUp} color="orange" />
         <KPICard title="Rede Operacional" value="Viby Cluster" icon={Zap} color="secondary" />
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
        <CardHeader className="p-8 border-b">
           <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-4 space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-40 ml-1">Localidade</Label>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Todas as Cidades" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todas as cidades</SelectItem>
                    {cities.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-6 space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-40 ml-1">Buscar Evento</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Show, festival ou produtor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-11 rounded-xl" />
                </div>
              </div>
              <div className="md:col-span-2">
                 <Button variant="outline" className="w-full h-11 rounded-xl border-dashed" onClick={() => { setSearch(""); setSelectedCity("all"); }}>
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
             <div className="py-24 text-center opacity-30 italic">Nenhum evento operacional localizado.</div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}

function EventOpRow({ event }: { event: any }) {
  const db = useFirestore();
  const [stats, setStats] = React.useState({ sold: 0, checkedIn: 0, revenue: 0 });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!db || !event.id) return;
    const fetch = async () => {
       const q = query(collection(db, "registrations"), where("eventId", "==", event.id));
       const snap = await getDocs(q);
       const s = { sold: 0, checkedIn: 0, revenue: 0 };
       snap.forEach(d => {
         const r = d.data();
         if (['Pago', 'Disponível'].includes(r.paymentStatus)) {
           s.sold++;
           s.revenue += (r.price || 0);
           if (r.checkedIn) s.checkedIn++;
         }
       });
       setStats(s);
       setLoading(false);
    };
    fetch();
  }, [db, event.id]);

  const occupancy = event.capacidadeTotal > 0 ? Math.round((stats.sold / event.capacidadeTotal) * 100) : 0;
  const checkinRate = stats.sold > 0 ? Math.round((stats.checkedIn / stats.sold) * 100) : 0;

  return (
    <Link href={`/admin/eventos/${event.id}`} className="block hover:bg-muted/10 transition-colors">
      <div className="px-8 py-6 grid grid-cols-12 gap-6 items-center">
        <div className="col-span-4 flex items-center gap-4">
           <div className="h-12 w-12 rounded-xl bg-muted overflow-hidden relative shrink-0">
              {event.image && <img src={event.image} alt={event.title} className="w-full h-full object-cover" />}
           </div>
           <div className="space-y-1">
              <h4 className="font-black text-sm uppercase italic text-primary truncate leading-tight">{event.title}</h4>
              <div className="flex items-center gap-3 text-[9px] font-bold text-muted-foreground uppercase">
                 <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-secondary" /> {event.city}</span>
                 {event.status === 'Oculto' && <Badge variant="outline" className="text-[7px] h-3 px-1 border-dashed">Vendas Encerradas</Badge>}
              </div>
           </div>
        </div>
        <div className="col-span-2 text-center">
           <p className="text-[9px] font-black uppercase opacity-40 mb-1">Vendas</p>
           {loading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (
             <p className="text-sm font-black text-primary">{stats.sold} <span className="text-[10px] opacity-40 font-bold">/ {event.capacidadeTotal || '---'}</span></p>
           )}
        </div>
        <div className="col-span-2 text-center">
           <p className="text-[9px] font-black uppercase opacity-40 mb-1">Check-in</p>
           {loading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (
             <p className={cn("text-sm font-black", checkinRate > 70 ? "text-green-600" : "text-primary")}>{stats.checkedIn} <span className="text-[10px] opacity-40 font-bold">({checkinRate}%)</span></p>
           )}
        </div>
        <div className="col-span-2 text-center">
           <p className="text-[9px] font-black uppercase opacity-40 mb-1">Ocupação</p>
           <div className="flex flex-col gap-1 px-4">
              <Progress value={occupancy} className="h-1.5" />
              <span className="text-[10px] font-black">{occupancy}%</span>
           </div>
        </div>
        <div className="col-span-1 text-right">
           <p className="text-[9px] font-black uppercase opacity-40 mb-1">Bruto (Face)</p>
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
  const colors: any = { blue: "text-blue-500 bg-blue-50", green: "text-green-600 bg-green-50", orange: "text-orange-500 bg-orange-50", secondary: "text-secondary bg-secondary/5" };
  return (
    <Card className="border-none shadow-sm rounded-3xl bg-white group hover:shadow-md transition-all">
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
