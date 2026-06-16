
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Loader2, 
  CheckCircle2, 
  History,
  Target,
  Tag,
  Building2,
  Ticket,
  User,
  Inbox,
  ChevronRight,
  Calculator,
  Save
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, getCountFromServer } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { createCrmSegmentAction } from '@/app/actions/crm-marketing';

const TARGET_TYPES = [
  { value: 'leads', label: 'Leads de Organizador', icon: Target, coll: 'organizer_leads' },
  { value: 'users', label: 'Usuários Comuns', icon: User, coll: 'users' },
  { value: 'buyers', label: 'Compradores Reais', icon: Ticket, coll: 'registrations' },
  { value: 'organizers', label: 'Marcas Criadas', icon: Building2, coll: 'organizations' },
];

export default function CrmSegmentsPage() {
  const db = useFirestore();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<any>('leads');
  const [estimatedCount, setEstimatedCount] = React.useState<number | null>(null);
  const [loadingCount, setLoadingCount] = React.useState(false);

  const segmentsQuery = useMemoFirebase(() => db ? query(collection(db, "crm_segmentos"), orderBy("createdAt", "desc")) : null, [db]);
  const { data: segments, loading } = useCollection<any>(segmentsQuery);

  // Efeito para calcular contagem real do segmento selecionado
  React.useEffect(() => {
    if (!db) return;
    const calculateCount = async () => {
      setLoadingCount(true);
      try {
        const target = TARGET_TYPES.find(t => t.value === activeTab);
        if (target) {
          const snapshot = await getCountFromServer(collection(db, target.coll));
          setEstimatedCount(snapshot.data().count);
        }
      } catch (e) {
        setEstimatedCount(0);
      } finally {
        setLoadingCount(false);
      }
    };
    calculateCount();
  }, [db, activeTab]);

  const handleCreateSegment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    try {
      const res = await createCrmSegmentAction({
        name: formData.get('name') as string,
        description: formData.get('desc') as string,
        targetType: activeTab,
        estimatedCount: estimatedCount || 0
      });
      if (res.success) {
        toast({ title: "Segmento salvo!" });
        (e.target as HTMLFormElement).reset();
      }
      else throw new Error(res.error);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7">
           <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="bg-muted/30 border-b p-8">
                 <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Construtor de Segmentos</CardTitle>
                 <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-secondary">Definição inteligente de público alvo baseado em dados reais</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                 <form onSubmit={handleCreateSegment} className="space-y-8">
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nome do Segmento</Label>
                          <Input name="name" required className="rounded-xl h-12" placeholder="Ex: Todos os Leads Ativos" />
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Descrição Técnica</Label>
                          <Input name="desc" className="rounded-xl h-11" placeholder="Explique os filtros aplicados para a equipe..." />
                       </div>
                    </div>

                    <Separator className="border-dashed" />

                    <div className="space-y-4">
                       <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Fonte de Dados (Audiência)</Label>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {TARGET_TYPES.map(t => (
                            <button 
                              key={t.value}
                              type="button"
                              onClick={() => setActiveTab(t.value)}
                              className={cn(
                                "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2",
                                activeTab === t.value ? "bg-secondary text-white border-secondary shadow-lg" : "bg-white border-border hover:border-secondary/30"
                              )}
                            >
                               <t.icon className="w-5 h-5" />
                               <span className="text-[8px] font-black uppercase text-center leading-none">{t.label}</span>
                            </button>
                          ))}
                       </div>
                    </div>

                    <div className="p-6 bg-muted/20 rounded-[1.5rem] border border-dashed space-y-4">
                       <div className="flex items-center justify-between"><h4 className="text-[9px] font-black uppercase text-secondary">Critérios de Refinamento</h4></div>
                       <div className="flex flex-wrap gap-2">
                          <Badge className="bg-primary text-white font-black text-[8px] uppercase h-6 px-3">Status: Real</Badge>
                          <Badge className="bg-secondary text-white font-black text-[8px] uppercase h-6 px-3">Filtro Global</Badge>
                       </div>
                       <p className="text-[9px] text-muted-foreground uppercase font-bold italic">O sistema calcula automaticamente o volume de destinatários elegíveis na base atual.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                       <div className="p-4 bg-secondary/5 rounded-2xl flex-1 border border-secondary/10 flex items-center justify-between w-full">
                          <div className="space-y-0.5">
                             <p className="text-[8px] font-black uppercase text-muted-foreground opacity-60">Audiência Consolidada</p>
                             <div className="flex items-center gap-2">
                               {loadingCount ? <Loader2 className="w-4 h-4 animate-spin text-secondary" /> : (
                                 <p className="text-xl font-black text-primary italic">
                                   {estimatedCount?.toLocaleString() || "0"} <span className="text-[10px] font-bold">RECIPIENTES</span>
                                 </p>
                               )}
                             </div>
                          </div>
                          <Calculator className="w-6 h-6 text-secondary opacity-30" />
                       </div>
                       <Button type="submit" disabled={isSubmitting || loadingCount} className="h-16 px-10 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic hover:scale-102 transition-transform w-full sm:w-auto">
                          {isSubmitting ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />} Salvar Segmento
                       </Button>
                    </div>
                 </form>
              </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-5 space-y-8">
           <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="bg-muted/30 border-b p-8"><CardTitle className="text-lg font-black uppercase italic tracking-tighter text-primary">Segmentos Ativos</CardTitle></CardHeader>
              <CardContent className="p-0">
                 {loading ? (
                   <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
                 ) : segments?.length > 0 ? (
                    <div className="divide-y">
                       {segments.map((s: any) => (
                         <div key={s.id} className="p-6 flex items-center justify-between hover:bg-muted/5 transition-colors group">
                            <div className="space-y-1">
                               <p className="font-black text-sm uppercase italic text-primary leading-none">{s.name}</p>
                               <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[7px] font-black uppercase h-4 px-1.5">{s.targetType}</Badge>
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase">{s.estimatedCount?.toLocaleString() || "0"} pessoas</span>
                               </div>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-muted-foreground/30 group-hover:text-secondary"><ChevronRight className="w-4 h-4" /></Button>
                         </div>
                       ))}
                    </div>
                 ) : (
                    <div className="p-20 text-center opacity-20 italic text-[10px] uppercase font-black">Nenhum segmento customizado</div>
                 )}
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
