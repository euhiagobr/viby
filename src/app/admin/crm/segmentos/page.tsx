'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Users, 
  Target, 
  Building2,
  Ticket,
  User,
  Calculator,
  ChevronRight,
  Filter,
  CheckCircle2,
  Loader2,
  MapPin,
  Clock,
  History,
  TrendingUp,
  X,
  Plus
} from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, getCountFromServer, query, where, getDocs } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

const PUBLIC_BASES = [
  { id: 'users', label: 'Usuários', icon: User, coll: 'users', segments: ['Todos', 'Ativos', 'Bloqueados', 'Desativados', 'Novos'] },
  { id: 'buyers', label: 'Compradores', icon: Ticket, coll: 'registrations', segments: ['Todos', 'Últimos 30 dias', 'Últimos 90 dias', 'Recorrentes', 'Inativos'] },
  { id: 'organizers', label: 'Organizadores', icon: Building2, coll: 'organizations', segments: ['Todos', 'Ativos', 'Verificados', 'Com Eventos', 'Sem Eventos', 'Com Vendas', 'Sem Vendas'] },
  { id: 'leads', label: 'Leads', icon: Target, coll: 'organizer_leads', segments: ['Todos', 'Novos', 'Convertidos', 'Pendentes'] },
  { id: 'attendees', label: 'Participantes', icon: Users, coll: 'registrations', segments: ['Todos', 'Com Check-in', 'Sem Check-in', 'Recorrentes'] },
];

export default function CrmSegmentsDynamicPage() {
  const db = useFirestore();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [selectedBase, setSelectedBase] = React.useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = React.useState<string>("Todos");
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  
  // Filtros Reais Extraídos da Auditoria
  const [filters, setFilters] = React.useState<any>({
    city: "all",
    state: "all",
    category: "all"
  });
  
  const [availableCities, setAvailableCities] = React.useState<string[]>([]);
  const [availableStates, setAvailableStates] = React.useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!db) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const results: any = {};
        for (const base of PUBLIC_BASES) {
          const snap = await getCountFromServer(collection(db, base.coll));
          results[base.id] = snap.data().count;
        }
        setCounts(results);

        // Carregar Localizações Reais (users)
        const usersSnap = await getDocs(collection(db, "users"));
        const cities = new Set<string>();
        const states = new Set<string>();
        usersSnap.forEach(d => {
          if (d.data().city) cities.add(d.data().city);
          if (d.data().state) states.add(d.data().state);
        });
        setAvailableCities(Array.from(cities).sort());
        setAvailableStates(Array.from(states).sort());

        // Carregar Categorias Reais
        const catsSnap = await getDocs(collection(db, "categories"));
        setAvailableCategories(catsSnap.docs.map(d => d.data().name).sort());

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [db]);

  const activeBase = PUBLIC_BASES.find(b => b.id === selectedBase);

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black uppercase italic text-primary tracking-tighter">Segmentação Real</h2>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Utilizando exclusivamente relacionamentos e campos da auditoria de dados.</p>
      </div>

      {step === 1 ? (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {PUBLIC_BASES.map((base) => (
                <Card 
                  key={base.id} 
                  className={cn(
                    "border-2 transition-all cursor-pointer rounded-[2rem] overflow-hidden group relative",
                    selectedBase === base.id ? "border-secondary bg-secondary/5 shadow-xl" : "border-transparent bg-white hover:border-muted-foreground/20"
                  )}
                  onClick={() => setSelectedBase(base.id)}
                >
                  <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                     <div className={cn(
                       "p-3 rounded-2xl transition-colors",
                       selectedBase === base.id ? "bg-secondary text-white" : "bg-muted text-muted-foreground group-hover:bg-secondary/10 group-hover:text-secondary"
                     )}>
                        <base.icon className="w-6 h-6" />
                     </div>
                     <div className="space-y-1">
                        <h3 className="font-black text-[11px] uppercase italic text-primary leading-none">{base.label}</h3>
                        <div className="flex items-center justify-center pt-1">
                          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                            <span className="text-2xl font-black text-primary italic">{(counts[base.id] || 0).toLocaleString()}</span>
                          )}
                        </div>
                     </div>
                     {selectedBase === base.id && <CheckCircle2 className="w-5 h-5 text-green-600 animate-in zoom-in-50" />}
                  </CardContent>
                </Card>
              ))}
           </div>

           {selectedBase && (
             <Card className="border-none shadow-sm rounded-[2.5rem] bg-white animate-in zoom-in-95 duration-300">
                <CardHeader className="bg-muted/20 border-b p-8">
                   <CardTitle className="text-xl font-black uppercase italic text-primary">Refinar Base: {activeBase?.label}</CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {activeBase?.segments.map(seg => (
                        <button
                          key={seg}
                          onClick={() => setSelectedSegment(seg)}
                          className={cn(
                            "p-4 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all",
                            selectedSegment === seg ? "bg-primary text-white border-primary" : "bg-white border-border hover:bg-muted"
                          )}
                        >
                          {seg}
                        </button>
                      ))}
                   </div>
                   <div className="flex justify-end pt-4">
                      <Button 
                        onClick={() => setStep(2)}
                        className="h-14 px-10 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic gap-2"
                      >
                         Prosseguir para Filtros <ChevronRight className="w-5 h-5" />
                      </Button>
                   </div>
                </CardContent>
             </Card>
           )}
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in">
           <div className="flex items-center gap-4 px-2">
              <Button variant="ghost" onClick={() => setStep(1)} className="rounded-full"><X className="w-4 h-4 mr-2" /> Alterar Base</Button>
              <Badge className="bg-secondary text-white font-black uppercase text-[10px] px-4 h-6 italic">Público: {activeBase?.label} / {selectedSegment}</Badge>
           </div>

           <Card className="border-none shadow-sm rounded-[3rem] bg-white overflow-hidden">
              <CardContent className="p-10">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {/* Filtro: Localização */}
                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-secondary" /> Localização Real
                       </h4>
                       <div className="space-y-4">
                          <div className="space-y-2">
                             <Label className="text-[9px] font-black uppercase opacity-40">Cidade</Label>
                             <Select value={filters.city} onValueChange={v => setFilters({...filters, city: v})}>
                                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Todas as cidades" /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                   <SelectItem value="all">Todas as cidades</SelectItem>
                                   {availableCities.map(c => <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>)}
                                </SelectContent>
                             </Select>
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[9px] font-black uppercase opacity-40">Estado (UF)</Label>
                             <Select value={filters.state} onValueChange={v => setFilters({...filters, state: v})}>
                                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Todos os estados" /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                   <SelectItem value="all">Todos os estados</SelectItem>
                                   {availableStates.map(s => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}
                                </SelectContent>
                             </Select>
                          </div>
                       </div>
                    </div>

                    {/* Filtro: Comportamento/Interesse */}
                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <Zap className="w-4 h-4 text-secondary" /> Interesses Reais
                       </h4>
                       <div className="space-y-4">
                          <div className="space-y-2">
                             <Label className="text-[9px] font-black uppercase opacity-40">Categoria Predominante</Label>
                             <Select value={filters.category} onValueChange={v => setFilters({...filters, category: v})}>
                                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                   <SelectItem value="all">Todas as categorias</SelectItem>
                                   {availableCategories.map(c => <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>)}
                                </SelectContent>
                             </Select>
                          </div>
                          <div className="p-4 bg-muted/20 rounded-2xl border border-dashed text-center opacity-40 cursor-not-allowed">
                             <p className="text-[8px] font-black uppercase">Valor Total Gasto (Em Breve)</p>
                          </div>
                       </div>
                    </div>

                    {/* Resumo da Segmentação */}
                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-secondary" /> Alcance Calculado
                       </h4>
                       <div className="p-8 bg-primary text-white rounded-[2rem] shadow-2xl relative overflow-hidden group">
                          <div className="relative z-10 text-center space-y-1">
                             <p className="text-[10px] font-black uppercase opacity-40 tracking-widest">Público Filtrado</p>
                             <p className="text-5xl font-black italic tracking-tighter">
                                {loading ? <Loader2 className="animate-spin inline" /> : (counts[selectedBase!] || 0).toLocaleString()}
                             </p>
                             <p className="text-[8px] font-bold uppercase opacity-60">Impactos Estimados</p>
                          </div>
                          <TrendingUp className="absolute -bottom-4 -right-4 w-24 h-24 opacity-5 rotate-12 transition-transform group-hover:scale-110" />
                       </div>
                       
                       <Button asChild className="w-full h-14 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-sm">
                          <Link href="/admin/crm/campanhas">Configurar Campanha IA</Link>
                       </Button>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>
      )}
    </div>
  );
}
