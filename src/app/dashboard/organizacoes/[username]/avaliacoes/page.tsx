'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Star, 
  MessageSquare, 
  ShieldCheck, 
  ThumbsUp, 
  Loader2, 
  Inbox, 
  CheckCircle2, 
  TrendingUp,
  History,
  Search,
  FilterX,
  PieChart as PieIcon,
  Users,
  MapPin,
  BarChart3,
  Globe,
  Calendar,
  Zap,
  Target,
  Clock
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as ChartTooltip
} from 'recharts';

export default function OrganizationGlobalReviewsPage() {
  const { currentOrg, loading: orgLoading } = useCurrentOrganization();
  const db = useFirestore();
  const [search, setSearch] = React.useState("");

  const reviewsQuery = useMemoFirebase(() => {
    if (!db || !currentOrg?.id) return null;
    return query(
      collection(db, "experience_reviews"),
      where("organizationId", "==", currentOrg.id),
      limit(200)
    );
  }, [db, currentOrg?.id]);

  const { data: rawReviews, loading: reviewsLoading } = useCollection<any>(reviewsQuery);

  const filteredReviews = React.useMemo(() => {
    if (!rawReviews) return [];
    return [...rawReviews]
      .filter(r => 
        r.userName?.toLowerCase().includes(search.toLowerCase()) || 
        r.title?.toLowerCase().includes(search.toLowerCase()) ||
        r.fullExperience?.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });
  }, [rawReviews, search]);

  const metrics = React.useMemo(() => {
    if (!rawReviews || rawReviews.length === 0) return null;
    
    const count = rawReviews.length;
    let totalScore = 0;
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let recSim = 0;
    const criteria = { org: 0, service: 0, quality: 0, price: 0, environment: 0 };
    
    // Demographics
    const genderMap: Record<string, number> = {};
    const ageMap: Record<string, number> = {
      'Até 17': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55-64': 0, '65+': 0
    };
    const stateMap: Record<string, number> = {};
    const cityMap: Record<string, number> = {};
    const targetMap: Record<string, number> = {};

    rawReviews.forEach(r => {
      totalScore += r.generalRating;
      const key = r.generalRating.toString();
      if (dist[key] !== undefined) dist[key as keyof typeof dist]++;
      
      if (r.recommend === 'sim') recSim++;
      
      const dr = r.detailedRatings || {};
      criteria.org += dr.org || 5;
      criteria.service += dr.service || 5;
      criteria.quality += dr.quality || 5;
      criteria.price += dr.price || 5;
      criteria.environment += dr.environment || 5;

      // Anonymized Demographics
      const gender = r.gender || 'Não informado';
      genderMap[gender] = (genderMap[gender] || 0) + 1;

      if (r.birthDate) {
        const age = new Date().getFullYear() - new Date(r.birthDate).getFullYear();
        if (age < 18) ageMap['Até 17']++;
        else if (age <= 24) ageMap['18-24']++;
        else if (age <= 34) ageMap['25-34']++;
        else if (age <= 44) ageMap['35-44']++;
        else if (age <= 54) ageMap['45-54']++;
        else if (age <= 64) ageMap['55-64']++;
        else ageMap['65+']++;
      }

      if (r.state) stateMap[r.state] = (stateMap[r.state] || 0) + 1;
      if (r.city) cityMap[r.city] = (cityMap[r.city] || 0) + 1;
      
      if (r.targets) {
        r.targets.forEach((t: string) => {
          targetMap[t] = (targetMap[t] || 0) + 1;
        });
      }
    });

    const filterSmallGroups = (map: Record<string, number>) => {
      const result: any[] = [];
      Object.entries(map).forEach(([name, value]) => {
        if (value >= 5 || count < 20) { // Oculta se menos de 5, exceto em bases pequenas
          result.push({ name, value });
        }
      });
      return result.sort((a, b) => b.value - a.value);
    };

    return {
      avg: (totalScore / count).toFixed(1),
      count,
      dist,
      recPercent: Math.round((recSim / count) * 100),
      criteria: {
        org: (criteria.org / count).toFixed(1),
        service: (criteria.service / count).toFixed(1),
        quality: (criteria.quality / count).toFixed(1),
        price: (criteria.price / count).toFixed(1),
        environment: (criteria.environment / count).toFixed(1),
      },
      demographics: {
        gender: filterSmallGroups(genderMap),
        age: Object.entries(ageMap).map(([name, value]) => ({ name, value })),
        states: filterSmallGroups(stateMap),
        cities: filterSmallGroups(cityMap).slice(0, 5),
        targets: filterSmallGroups(targetMap)
      }
    };
  }, [rawReviews]);

  if (orgLoading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Star className="w-8 h-8 text-secondary fill-secondary" />
          Avaliações da Marca
        </h1>
        <p className="text-muted-foreground font-medium">Análise de reputação e inteligência de público.</p>
      </div>

      {metrics ? (
        <>
          {/* PAINEL DE INSIGHTS */}
          <section className="space-y-6">
             <div className="flex items-center gap-3 px-2">
                <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><BarChart3 className="w-5 h-5" /></div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary">Perfil de quem avaliou</h2>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Coluna 1: KPIs & Gênero */}
                <div className="md:col-span-4 space-y-6">
                   <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                         <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Total Reviews</p>
                            <p className="text-3xl font-black italic text-primary">{metrics.count}</p>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Recomendação</p>
                            <p className="text-3xl font-black italic text-green-600">{metrics.recPercent}%</p>
                         </div>
                      </div>
                      <Separator className="border-dashed" />
                      <div className="space-y-4">
                         <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-2"><Users className="w-3 h-3" /> Distribuição de Gênero</p>
                         <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                               <PieChart>
                                  <Pie
                                    data={metrics.demographics.gender}
                                    cx="50%" cy="50%"
                                    innerRadius={40} outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                  >
                                    {metrics.demographics.gender.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={['#2C52EE', '#ec4899', '#f59e0b', '#10b981'][index % 4]} />
                                    ))}
                                  </Pie>
                                  <ChartTooltip />
                               </PieChart>
                            </ResponsiveContainer>
                         </div>
                      </div>
                   </Card>
                </div>

                {/* Coluna 2: Idade & Localização */}
                <div className="md:col-span-4 space-y-6">
                   <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8 h-full">
                      <div className="space-y-4">
                         <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-2"><Clock className="w-3 h-3" /> Faixa Etária</p>
                         <div className="h-32 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                               <BarChart data={metrics.demographics.age}>
                                  <XAxis dataKey="name" hide />
                                  <Bar dataKey="value" fill="#2C52EE" radius={[4, 4, 0, 0]} />
                                  <ChartTooltip />
                               </BarChart>
                            </ResponsiveContainer>
                         </div>
                      </div>
                      <Separator className="border-dashed" />
                      <div className="space-y-4">
                         <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-2"><MapPin className="w-3 h-3" /> Principais Estados</p>
                         <div className="space-y-2">
                            {metrics.demographics.states.slice(0, 4).map((s, i) => (
                               <div key={i} className="flex items-center gap-3">
                                  <span className="text-[10px] font-black w-6">{s.name}</span>
                                  <Progress value={(s.value / metrics.count) * 100} className="h-1.5 flex-1" />
                                  <span className="text-[9px] font-bold opacity-40">{Math.round((s.value / metrics.count) * 100)}%</span>
                               </div>
                            ))}
                         </div>
                      </div>
                   </Card>
                </div>

                {/* Coluna 3: Perfil & Critérios */}
                <div className="md:col-span-4 space-y-6">
                   <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8 h-full">
                      <div className="space-y-4">
                         <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-2"><Target className="w-3 h-3" /> Perfil Predominante</p>
                         <div className="flex flex-wrap gap-2">
                            {metrics.demographics.targets.slice(0, 6).map((t, i) => (
                              <Badge key={i} variant="secondary" className="bg-secondary/5 text-secondary text-[8px] font-black uppercase h-5">
                                 {t.name} ({Math.round((t.value / metrics.count) * 100)}%)
                              </Badge>
                            ))}
                         </div>
                      </div>
                      <Separator className="border-dashed" />
                      <div className="space-y-4">
                         <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> Avaliação Técnica</p>
                         <div className="space-y-3">
                            <CriteriaProgress label="Serviço" value={metrics.criteria.service} />
                            <CriteriaProgress label="Qualidade" value={metrics.criteria.quality} />
                            <CriteriaProgress label="Ambiente" value={metrics.criteria.environment} />
                         </div>
                      </div>
                   </Card>
                </div>
             </div>

             <div className="p-4 bg-muted/40 rounded-2xl border border-dashed flex items-center justify-center gap-3 opacity-60">
                <ShieldCheck className="w-4 h-4 text-secondary" />
                <p className="text-[9px] font-black uppercase tracking-widest">Dados agregados e anonimizados em conformidade com a LGPD</p>
             </div>
          </section>

          <Separator className="border-dashed" />

          {/* LISTA DE REVIEWS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
             <Card className="lg:col-span-8 border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                <CardHeader className="bg-muted/30 border-b p-8 flex flex-row items-center justify-between">
                   <div>
                     <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                        <History className="w-5 h-5 text-secondary" /> Feed Unificado
                     </CardTitle>
                     <CardDescription className="font-bold text-secondary text-[10px] uppercase">Últimos comentários recebidos</CardDescription>
                   </div>
                   <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Buscar review..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)}
                        className="pl-10 h-10 rounded-xl text-xs"
                      />
                   </div>
                </CardHeader>
                <CardContent className="p-0">
                   <ScrollArea className="h-[600px]">
                      {reviewsLoading ? (
                        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
                      ) : filteredReviews.length > 0 ? (
                        <div className="divide-y">
                           {filteredReviews.map((review) => (
                             <div key={review.id} className="p-8 space-y-4 hover:bg-muted/5 transition-colors">
                                <div className="flex justify-between items-start">
                                   <div className="flex items-center gap-4">
                                      <Avatar className="h-10 w-10 border shadow-sm">
                                         <AvatarImage src={review.userAvatar} className="object-cover" />
                                         <AvatarFallback className="font-bold bg-muted">{review.userName?.charAt(0)}</AvatarFallback>
                                      </Avatar>
                                      <div>
                                         <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-sm uppercase italic">{review.userName}</h4>
                                            <CheckCircle2 className="w-3.5 h-3.5 fill-blue-500 text-white" />
                                         </div>
                                         <p className="text-[9px] font-bold text-muted-foreground uppercase">Em {new Date(review.createdAt?.seconds * 1000 || review.createdAt).toLocaleDateString('pt-BR')}</p>
                                      </div>
                                   </div>
                                   <div className="flex gap-0.5">
                                      {Array.from({length: 5}).map((_, i) => (
                                        <Star key={i} className={cn("w-3 h-3", i < review.generalRating ? "fill-orange-400 text-orange-400" : "text-muted opacity-20")} />
                                      ))}
                                   </div>
                                </div>
                                <div className="space-y-2">
                                   <p className="text-sm font-black uppercase text-primary italic leading-tight">{review.title}</p>
                                   <p className="text-xs text-muted-foreground leading-relaxed">"{review.fullExperience}"</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                   {review.badges?.map((b: string, i: number) => (
                                     <Badge key={i} variant="secondary" className="bg-secondary/5 text-secondary border-secondary/10 text-[7px] font-black uppercase h-5 px-2">{b}</Badge>
                                   ))}
                                </div>
                             </div>
                           ))}
                        </div>
                      ) : (
                        <div className="py-20 text-center opacity-30 italic flex flex-col items-center gap-4">
                           <FilterX className="w-10 h-10" />
                           <p className="text-xs font-black uppercase tracking-widest">Nenhum review encontrado.</p>
                        </div>
                      )}
                   </ScrollArea>
                </CardContent>
             </Card>

             <div className="lg:col-span-4 space-y-8">
                <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-dashed pb-4">Performance Global</h4>
                   <div className="space-y-6">
                      <CriteriaProgress label="Organização" value={metrics.criteria.org} />
                      <CriteriaProgress label="Atendimento" value={metrics.criteria.service} />
                      <CriteriaProgress label="Qualidade" value={metrics.criteria.quality} />
                      <CriteriaProgress label="Custo-benefício" value={metrics.criteria.price} />
                      <CriteriaProgress label="Ambiente" value={metrics.criteria.environment} />
                   </div>
                </Card>
             </div>
          </div>
        </>
      ) : (
        <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center gap-4 opacity-40 italic">
           <Inbox className="w-12 h-12" />
           <p className="text-sm font-black uppercase tracking-widest">Sua marca ainda não possui avaliações visíveis.</p>
           {!reviewsLoading && (
             <p className="text-[10px] font-bold uppercase max-w-xs mx-auto text-center">
               Os Insights e avaliações aparecerão aqui assim que seus primeiros clientes compartilharem suas experiências.
             </p>
           )}
        </div>
      )}
    </div>
  );
}

function CriteriaProgress({ label, value }: { label: string, value: string }) {
   const val = parseFloat(value);
   return (
      <div className="space-y-2">
         <div className="flex justify-between items-center text-[10px] font-black uppercase">
            <span>{label}</span>
            <span className="text-primary">{value}</span>
         </div>
         <Progress value={val * 20} className="h-1" />
      </div>
   );
}
