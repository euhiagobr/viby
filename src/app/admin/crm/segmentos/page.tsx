
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Loader2
} from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const PUBLIC_BASES = [
  { id: 'users', label: 'Todos os Usuários', icon: User, coll: 'users' },
  { id: 'buyers', label: 'Todos os Compradores', icon: Ticket, coll: 'registrations' },
  { id: 'organizers', label: 'Todos os Organizadores', icon: Building2, coll: 'organizations' },
  { id: 'leads', label: 'Todos os Leads', icon: Target, coll: 'organizer_leads' },
];

export default function CrmSegmentsRestructuringPage() {
  const db = useFirestore();
  const [selectedBase, setSelectedBase] = React.useState<string | null>(null);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!db) return;
    const fetchCounts = async () => {
      const results: any = {};
      for (const base of PUBLIC_BASES) {
        const snap = await getCountFromServer(collection(db, base.coll));
        results[base.id] = snap.data().count;
      }
      setCounts(results);
      setLoading(false);
    };
    fetchCounts();
  }, [db]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-black uppercase italic text-primary">Construtor de Audiência</h2>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Etapa 1: Seleção do Público-Base</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PUBLIC_BASES.map((base) => (
          <Card 
            key={base.id} 
            className={cn(
              "border-2 transition-all cursor-pointer rounded-[2rem] overflow-hidden group",
              selectedBase === base.id ? "border-secondary bg-secondary/5 shadow-xl" : "border-transparent bg-white hover:border-muted-foreground/20"
            )}
            onClick={() => setSelectedBase(base.id)}
          >
            <CardContent className="p-8 flex flex-col items-center text-center gap-6">
               <div className={cn(
                 "p-4 rounded-2xl transition-colors",
                 selectedBase === base.id ? "bg-secondary text-white" : "bg-muted text-muted-foreground group-hover:bg-secondary/10 group-hover:text-secondary"
               )}>
                  <base.icon className="w-8 h-8" />
               </div>
               <div className="space-y-1">
                  <h3 className="font-black text-sm uppercase italic text-primary">{base.label}</h3>
                  <div className="flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                      <span className="text-2xl font-black text-primary">({counts[base.id] || 0})</span>
                    )}
                  </div>
               </div>
               {selectedBase === base.id && <CheckCircle2 className="w-6 h-6 text-green-600 animate-in zoom-in-50" />}
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedBase && (
        <div className="space-y-8 animate-in slide-in-from-top-4 duration-500">
           <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-black uppercase italic text-primary">Refinamento de Alvo</h2>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Etapa 2: Aplicar Filtros Dinâmicos</p>
           </div>

           <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
              <CardContent className="p-10">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    <FilterGroup title="Localização" items={["Cidade", "Estado", "País"]} />
                    <FilterGroup title="Comportamento" items={["Última Compra", "Total Gasto", "Data Cadastro"]} />
                    <FilterGroup title="Engajamento" items={["Eventos Visitados", "Categorias", "Interesses"]} />
                 </div>

                 <Separator className="my-10 border-dashed" />

                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 p-4 bg-secondary/5 rounded-2xl border border-secondary/10">
                       <Calculator className="w-5 h-5 text-secondary" />
                       <div>
                          <p className="text-[10px] font-black uppercase text-muted-foreground">Alcance Estimado</p>
                          <p className="text-xl font-black text-primary italic">Processando filtros reais...</p>
                       </div>
                    </div>
                    <Button className="h-16 px-10 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg gap-2">
                       Prosseguir p/ IA <ChevronRight className="w-5 h-5" />
                    </Button>
                 </div>
              </CardContent>
           </Card>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ title, items }: { title: string, items: string[] }) {
  return (
    <div className="space-y-4">
       <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary flex items-center gap-2">
          <Filter className="w-3.5 h-3.5" /> {title}
       </h4>
       <div className="space-y-2">
          {items.map(item => (
            <div key={item} className="p-3 bg-muted/30 rounded-xl border border-border/50 text-[10px] font-bold uppercase text-muted-foreground flex justify-between items-center hover:bg-white hover:shadow-sm cursor-pointer transition-all">
               {item}
               <Plus className="w-3 h-3 opacity-30" />
            </div>
          ))}
       </div>
    </div>
  );
}

import { Plus as PlusIcon } from "lucide-react";
