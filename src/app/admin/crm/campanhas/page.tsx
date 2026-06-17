'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from '@/firebase';
import { collection, query, orderBy, getCountFromServer, getDocs, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Search, 
  Loader2, 
  Sparkles, 
  Inbox,
  ChevronRight,
  Mail,
  Zap,
  Target,
  Users,
  Building2,
  Ticket,
  User,
  MapPin,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { createCrmCampaignAction } from '@/app/actions/crm-marketing';
import { gerarCampanhaEmail } from '@/ai/flows/gerar-campanha-email';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';

const PUBLIC_BASES = [
  { id: 'users', label: 'Usuários', icon: User, coll: 'users' },
  { id: 'buyers', label: 'Compradores', icon: Ticket, coll: 'registrations' },
  { id: 'organizers', label: 'Organizadores', icon: Building2, coll: 'organizations' },
  { id: 'leads', label: 'Leads', icon: Target, coll: 'organizer_leads' },
  { id: 'attendees', label: 'Participantes', icon: Users, coll: 'registrations' },
];

export default function CrmCampaignsPage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const router = useRouter();
  
  const [search, setSearch] = React.useState("");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [step, setStep] = React.useState(1);
  const [isAiLoading, setIsAiLoading] = React.useState(false);

  // Estados da Campanha
  const [basePublic, setBasePublic] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState({ city: 'all', category: 'all' });
  const [periodo, setPeriodo] = React.useState<any>("semana");
  const [campaignTitle, setCampaignTitle] = React.useState("");
  const [objective, setObjective] = React.useState("");
  const [tone, setTone] = React.useState("profissional");

  // Dados Reais para Filtros
  const [availableCities, setAvailableCities] = React.useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = React.useState<string[]>([]);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [loadingMetadata, setLoadingMetadata] = React.useState(false);

  const campaignsQuery = useMemoFirebase(() => db ? query(collection(db, "crm_campaigns"), orderBy("createdAt", "desc")) : null, [db]);
  const { data: campaigns, loading } = useCollection<any>(campaignsQuery);

  const filtered = campaigns?.filter(c => c.title?.toLowerCase().includes(search.toLowerCase())) || [];

  // Carregar metadados reais para os filtros
  React.useEffect(() => {
    if (!db || !isCreateOpen) return;
    const fetchMetadata = async () => {
      setLoadingMetadata(true);
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const cities = new Set<string>();
        usersSnap.forEach(d => { if (d.data().city) cities.add(d.data().city) });
        setAvailableCities(Array.from(cities).sort());

        const catsSnap = await getDocs(collection(db, "categories"));
        setAvailableCategories(catsSnap.docs.map(d => d.data().name).sort());

        const c: any = {};
        for (const base of PUBLIC_BASES) {
          const snap = await getCountFromServer(collection(db, base.coll));
          c[base.id] = snap.data().count;
        }
        setCounts(c);
      } catch (e) { console.error(e); }
      finally { setLoadingMetadata(false); }
    };
    fetchMetadata();
  }, [db, isCreateOpen]);

  const handleGenerateAi = async () => {
    if (!user || isAiLoading) return;
    
    setIsAiLoading(true);
    try {
      const aiResult = await gerarCampanhaEmail({
        objetivo: objective,
        publicoAlvo: `${basePublic} - ${filters.city !== 'all' ? filters.city : 'Brasil'}`,
        periodo,
        tom: tone,
        maxEventos: 3
      });

      const campaignRes = await createCrmCampaignAction({
        title: campaignTitle,
        objective: objective,
        basePublic: basePublic,
        filters: { ...filters, periodo },
        status: 'rascunho',
        tone: tone,
        ...aiResult,
      }, user.uid);

      if (campaignRes.success) {
        toast({ title: "Campanha Gerada!", description: "Revise o preview antes de enviar o teste." });
        router.push(`/admin/crm/campanhas/${campaignRes.id}`);
      } else throw new Error(campaignRes.error);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro na IA", description: err.message });
    } finally {
      setIsAiLoading(false);
    }
  };

  const resetModal = () => {
    setStep(1);
    setBasePublic(null);
    setFilters({ city: 'all', category: 'all' });
    setPeriodo("semana");
    setCampaignTitle("");
    setObjective("");
    setTone("profissional");
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar campanha..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-11 rounded-xl" />
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={(v) => { setIsCreateOpen(v); if(!v) resetModal(); }}>
           <DialogTrigger asChild>
              <Button className="bg-secondary text-white font-black rounded-full px-8 h-11 shadow-lg gap-2 uppercase italic">
                <Plus className="w-5 h-5" /> Criar Campanha Real
              </Button>
           </DialogTrigger>
           <DialogContent className="max-w-2xl rounded-[2.5rem] p-0 overflow-hidden">
              <DialogHeader className="p-8 bg-muted/30 border-b">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><Sparkles className="w-6 h-6 fill-current" /></div>
                       <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Nova Campanha IA</DialogTitle>
                    </div>
                    <Badge variant="outline" className="font-black uppercase text-[9px] h-6 px-3 border-secondary/20 text-secondary">Passo {step} de 3</Badge>
                 </div>
              </DialogHeader>

              <div className="p-8">
                 {step === 1 && (
                   <div className="space-y-6 animate-in slide-in-from-right-4">
                      <div className="space-y-1">
                        <h3 className="font-black text-sm uppercase italic text-primary">1. Selecione o Público-Base</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         {PUBLIC_BASES.map((base) => (
                           <button
                             key={base.id}
                             onClick={() => setBasePublic(base.id)}
                             className={cn(
                               "p-4 rounded-2xl border-2 flex items-center gap-4 transition-all text-left",
                               basePublic === base.id ? "border-secondary bg-secondary/5 shadow-inner" : "border-border hover:bg-muted"
                             )}
                           >
                              <div className={cn("p-2 rounded-lg", basePublic === base.id ? "bg-secondary text-white" : "bg-muted text-muted-foreground")}><base.icon className="w-5 h-5" /></div>
                              <div className="flex-1 min-w-0">
                                 <p className="text-xs font-black uppercase italic text-primary">{base.label}</p>
                                 <p className="text-[10px] font-bold text-muted-foreground">{counts[base.id]?.toLocaleString() || '...'} registros</p>
                              </div>
                              {basePublic === base.id && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                           </button>
                         ))}
                      </div>
                      <div className="flex justify-end pt-4">
                         <Button onClick={() => setStep(2)} disabled={!basePublic} className="bg-primary text-white font-black rounded-xl h-12 px-8 uppercase italic gap-2">Prosseguir <ChevronRight className="w-4 h-4" /></Button>
                      </div>
                   </div>
                 )}

                 {step === 2 && (
                   <div className="space-y-8 animate-in slide-in-from-right-4">
                      <div className="space-y-1">
                        <h3 className="font-black text-sm uppercase italic text-primary">2. Refinamento de Busca</h3>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase">Segmentando por geolocalização e interesse</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Localização (Cidade)</Label>
                            <Select value={filters.city} onValueChange={v => setFilters({...filters, city: v})}>
                               <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                               <SelectContent className="rounded-xl">
                                  <SelectItem value="all">Brasil (Toda a base)</SelectItem>
                                  {availableCities.map(c => <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>)}
                                </SelectContent>
                            </Select>
                         </div>
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Afinidade (Categoria)</Label>
                            <Select value={filters.category} onValueChange={v => setFilters({...filters, category: v})}>
                               <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
                               <SelectContent className="rounded-xl">
                                  <SelectItem value="all">Todas as categorias</SelectItem>
                                  {availableCategories.map(c => <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>)}
                               </SelectContent>
                            </Select>
                         </div>
                      </div>

                      <div className="flex justify-between pt-4">
                         <Button variant="ghost" onClick={() => setStep(1)} className="rounded-xl font-black uppercase text-[10px]"><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</Button>
                         <Button onClick={() => setStep(3)} className="bg-primary text-white font-black rounded-xl h-12 px-8 uppercase italic gap-2">Configurar IA <ChevronRight className="w-4 h-4" /></Button>
                      </div>
                   </div>
                 )}

                 {step === 3 && (
                   <div className="space-y-6 animate-in slide-in-from-right-4">
                      <div className="space-y-1">
                        <h3 className="font-black text-sm uppercase italic text-primary">3. Estratégia de Agenda</h3>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase">Configurando o período e tom de voz</p>
                      </div>

                      <div className="space-y-4">
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Período da Agenda (Filtro Obrigatório)</Label>
                            <Select value={periodo} onValueChange={setPeriodo}>
                               <SelectTrigger className="rounded-xl h-11 font-bold text-primary">
                                  <Calendar className="w-4 h-4 mr-2 opacity-40" />
                                  <SelectValue />
                               </SelectTrigger>
                               <SelectContent className="rounded-xl">
                                  <SelectItem value="hoje">Somente Hoje</SelectItem>
                                  <SelectItem value="amanha">Somente Amanhã</SelectItem>
                                  <SelectItem value="semana">Esta Semana (Seg-Dom)</SelectItem>
                                  <SelectItem value="7dias">Próximos 7 dias</SelectItem>
                                  <SelectItem value="15dias">Próximos 15 dias</SelectItem>
                                  <SelectItem value="30dias">Próximos 30 dias</SelectItem>
                                  <SelectItem value="mes_atual">Este Mês</SelectItem>
                                  <SelectItem value="proximo_mes">Próximo Mês</SelectItem>
                               </SelectContent>
                            </Select>
                         </div>
                         <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Título da Campanha</Label><Input value={campaignTitle} onChange={e => setCampaignTitle(e.target.value)} required className="rounded-xl h-11" placeholder="Ex: Destaques da Semana" /></div>
                         <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Objetivo da IA</Label><Input value={objective} onChange={e => setObjective(e.target.value)} required className="rounded-xl h-11" placeholder="Ex: Convite para agenda cultural" /></div>
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Tom de Voz</Label>
                            <Select value={tone} onValueChange={setTone}>
                               <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                               <SelectContent className="rounded-xl">
                                  <SelectItem value="profissional">Profissional</SelectItem>
                                  <SelectItem value="amigável">Amigável</SelectItem>
                                  <SelectItem value="urgente">Urgente</SelectItem>
                                  <SelectItem value="entusiasmado">Entusiasmado</SelectItem>
                               </SelectContent>
                            </Select>
                         </div>
                      </div>

                      <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200 flex items-start gap-3">
                         <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                         <p className="text-[9px] text-orange-800 font-bold uppercase leading-relaxed italic">
                            A IA filtrará eventos exclusivamente dentro do período selecionado. Eventos fora deste intervalo serão ignorados.
                         </p>
                      </div>

                      <div className="flex justify-between pt-4">
                         <Button variant="ghost" onClick={() => setStep(2)} className="rounded-xl font-black uppercase text-[10px]"><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</Button>
                         <Button onClick={handleGenerateAi} disabled={isAiLoading || !campaignTitle || !objective} className="bg-secondary text-white font-black h-14 px-10 rounded-2xl shadow-xl uppercase italic text-sm">
                            {isAiLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <><Sparkles className="w-5 h-5 mr-2 fill-current" /> Gerar Campanha</>}
                         </Button>
                      </div>
                   </div>
                 )}
              </div>
              
              <div className="p-4 bg-muted/30 border-t flex items-center justify-center gap-2">
                 <ShieldCheck className="w-4 h-4 text-secondary opacity-40" />
                 <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Viby AI Engine (GPT-4o-Mini)</p>
              </div>
           </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
        ) : filtered.length > 0 ? (
          filtered.map(c => (
            <Link key={c.id} href={`/admin/crm/campanhas/${c.id}`}>
               <Card className="border-none shadow-sm rounded-[1.5rem] bg-white hover:shadow-md transition-all group overflow-hidden">
                  <CardContent className="p-0">
                     <div className="px-8 py-6 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                           <div className={cn(
                             "p-3 rounded-2xl transition-colors",
                             c.status === 'concluido' ? "bg-green-50 text-green-600" : "bg-muted text-muted-foreground group-hover:bg-secondary/10 group-hover:text-secondary"
                           )}>
                              <Mail className="w-6 h-6" />
                           </div>
                           <div className="space-y-1">
                              <h3 className="font-black text-base uppercase italic text-primary leading-none">{c.title}</h3>
                              <div className="flex items-center gap-3">
                                 <Badge variant="outline" className="text-[8px] font-black uppercase h-4 px-1.5">{c.status}</Badge>
                                 <span className="text-[9px] font-bold text-muted-foreground uppercase">{new Date(c.createdAt?.seconds * 1000).toLocaleDateString('pt-BR')}</span>
                              </div>
                           </div>
                        </div>

                        <div className="flex items-center gap-10">
                           <ChevronRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-secondary transition-colors" />
                        </div>
                     </div>
                  </CardContent>
               </Card>
            </Link>
          ))
        ) : (
          <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed opacity-30 italic flex flex-col items-center gap-4">
             <Inbox className="w-12 h-12" />
             <p className="text-xs font-black uppercase tracking-widest">Nenhuma campanha para exibir</p>
          </div>
        )}
      </div>
    </div>
  );
}
