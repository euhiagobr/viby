
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
  FilterX
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function OrganizationGlobalReviewsPage() {
  const { currentOrg, loading: orgLoading } = useCurrentOrganization();
  const db = useFirestore();
  const [search, setSearch] = React.useState("");

  const reviewsQuery = useMemoFirebase(() => {
    if (!db || !currentOrg?.id) return null;
    return query(
      collection(db, "experience_reviews"),
      where("organizationId", "==", currentOrg.id),
      limit(100)
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
    });

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
      }
    };
  }, [rawReviews]);

  if (orgLoading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Star className="w-8 h-8 text-secondary fill-secondary" />
          Avaliações da Marca
        </h1>
        <p className="text-muted-foreground font-medium">Reputação consolidada e feedback dos clientes em tempo real.</p>
      </div>

      {metrics ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <Card className="border-none shadow-sm bg-white p-6 flex flex-col items-center justify-center text-center gap-2">
                <p className="text-[9px] font-black uppercase text-muted-foreground">Nota Média Global</p>
                <div className="flex items-center gap-2">
                   <Star className="w-6 h-6 fill-orange-400 text-orange-400" />
                   <span className="text-3xl font-black italic tracking-tighter text-primary">{metrics.avg}</span>
                </div>
             </Card>
             <Card className="border-none shadow-sm bg-white p-6 flex flex-col items-center justify-center text-center gap-2">
                <p className="text-[9px] font-black uppercase text-muted-foreground">Total Reviews</p>
                <div className="flex items-center gap-2">
                   <MessageSquare className="w-6 h-6 text-secondary" />
                   <span className="text-3xl font-black italic tracking-tighter text-primary">{metrics.count}</span>
                </div>
             </Card>
             <Card className="border-none shadow-sm bg-green-50 p-6 flex flex-col items-center justify-center text-center gap-2">
                <p className="text-[9px] font-black uppercase text-green-700">Recomendação</p>
                <div className="flex items-center gap-2">
                   <ThumbsUp className="w-6 h-6 text-green-600 fill-current" />
                   <span className="text-3xl font-black italic tracking-tighter text-green-700">{metrics.recPercent}%</span>
                </div>
             </Card>
             <Card className="border-none shadow-sm bg-primary text-white p-6 flex flex-col items-center justify-center text-center gap-2">
                <p className="text-[9px] font-black uppercase opacity-60">Impacto da Marca</p>
                <div className="text-xl font-black uppercase italic tracking-widest">
                   {Number(metrics.avg) >= 4.5 ? 'Excelente' : Number(metrics.avg) >= 3.5 ? 'Bom' : 'Atenção'}
                </div>
             </Card>
          </div>

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
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-dashed pb-4">Performance por Critério</h4>
                   <div className="space-y-6">
                      <CriteriaLine label="Organização" value={metrics.criteria.org} />
                      <CriteriaLine label="Atendimento" value={metrics.criteria.service} />
                      <CriteriaLine label="Qualidade" value={metrics.criteria.quality} />
                      <CriteriaLine label="Custo-benefício" value={metrics.criteria.price} />
                      <CriteriaLine label="Ambiente" value={metrics.criteria.environment} />
                   </div>
                </Card>

                <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
                   <ShieldCheck className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
                   <p className="text-[10px] text-secondary font-bold uppercase leading-relaxed italic">
                      As avaliações são moderadas automaticamente e ajudam a elevar a relevância da sua marca no marketplace.
                   </p>
                </div>
             </div>
          </div>
        </>
      ) : (
        <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center gap-4 opacity-40 italic">
           <Inbox className="w-12 h-12" />
           <p className="text-sm font-black uppercase tracking-widest">Sua marca ainda não possui avaliações visíveis.</p>
           {!reviewsLoading && (
             <p className="text-[10px] font-bold uppercase max-w-xs mx-auto">
               As avaliações aparecem aqui assim que seus primeiros clientes compartilharem suas experiências.
             </p>
           )}
        </div>
      )}
    </div>
  );
}

function CriteriaLine({ label, value }: { label: string, value: string }) {
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
