'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Star, User, Clock, MessageSquare, ShieldCheck, ThumbsUp, Camera, Video, Inbox, Loader2, CheckCircle2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface ExperiencePublicReviewsProps {
  experience: any;
}

export function ExperiencePublicReviews({ experience }: ExperiencePublicReviewsProps) {
  const db = useFirestore();
  
  const reviewsQuery = useMemoFirebase(() => {
    if (!db || !experience.id) return null;
    // Removido orderBy para evitar erro de índice composto em ambiente de dev/primeiros acessos
    return query(
      collection(db, "experience_reviews"),
      where("experienceId", "==", experience.id),
      limit(50)
    );
  }, [db, experience.id]);

  const { data: rawReviews, loading } = useCollection<any>(reviewsQuery);

  // Ordenação resiliente em memória
  const reviews = React.useMemo(() => {
    if (!rawReviews) return [];
    return [...rawReviews].sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });
  }, [rawReviews]);

  const distribution = experience.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const total = experience.reviewCount || 0;

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <section id="reviews" className="space-y-12 py-20 border-t">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
           {/* RESUMO ANALÍTICO */}
           <div className="lg:col-span-4 space-y-10">
              <div className="space-y-2">
                 <h2 className="text-4xl font-black uppercase italic tracking-tighter text-primary">Avaliações</h2>
                 <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">O que a comunidade está dizendo</p>
              </div>

              <div className="p-8 bg-muted/20 rounded-[2.5rem] border space-y-6">
                 <div className="flex items-center gap-6">
                    <div className="text-6xl font-black italic tracking-tighter text-primary">{Number(experience.averageRating || 5.0).toFixed(1)}</div>
                    <div>
                       <div className="flex gap-1 mb-1">
                          {Array.from({length: 5}).map((_, i) => (
                             <Star key={i} className={cn("w-4 h-4", i < Math.round(experience.averageRating || 5) ? "fill-orange-400 text-orange-400" : "text-muted opacity-30")} />
                          ))}
                       </div>
                       <p className="text-[10px] font-black uppercase text-muted-foreground">{total} avaliações reais</p>
                    </div>
                 </div>

                 <div className="space-y-3">
                    {[5, 4, 3, 2, 1].map(num => (
                      <div key={num} className="flex items-center gap-4">
                         <span className="text-[10px] font-black w-4">{num}★</span>
                         <Progress value={total > 0 ? (distribution[num.toString()] / total) * 100 : 0} className="h-1.5 flex-1" />
                         <span className="text-[10px] font-bold opacity-30 w-8 text-right">{distribution[num.toString()] || 0}</span>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
                 <ShieldCheck className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
                 <p className="text-[10px] text-secondary font-bold uppercase leading-relaxed italic">
                    Avaliações verificadas: Apenas clientes com reservas confirmadas podem avaliar esta experiência.
                 </p>
              </div>
           </div>

           {/* LISTA DE REVIEWS */}
           <div className="lg:col-span-8 space-y-10">
              {reviews && reviews.length > 0 ? (
                <div className="space-y-12">
                   {reviews.map((review: any) => (
                     <div key={review.id} className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-start">
                           <div className="flex items-center gap-4">
                              <Avatar className="h-12 w-12 border-2 border-secondary/10 shadow-sm">
                                 <AvatarImage src={review.userAvatar} className="object-cover" />
                                 <AvatarFallback className="font-black bg-muted">{review.userName?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div>
                                 <div className="flex items-center gap-2">
                                    <h4 className="font-black text-sm uppercase italic text-primary leading-none">{review.userName}</h4>
                                    <CheckCircle2 className="w-3.5 h-3.5 fill-blue-500 text-white" />
                                 </div>
                                 <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Visitou em {new Date(review.createdAt?.seconds * 1000 || review.createdAt).toLocaleDateString('pt-BR')}</p>
                              </div>
                           </div>
                           <div className="flex gap-0.5">
                              {Array.from({length: 5}).map((_, i) => (
                                <Star key={i} className={cn("w-3 h-3", i < review.generalRating ? "fill-orange-400 text-orange-400" : "text-muted opacity-20")} />
                              ))}
                           </div>
                        </div>

                        <div className="space-y-4">
                           {review.title && <h3 className="text-xl font-black text-primary leading-tight uppercase italic">{review.title}</h3>}
                           <p className="text-base text-foreground/80 leading-relaxed font-medium">{review.fullExperience}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                           {review.badges?.map((badge: string, i: number) => (
                             <Badge key={i} variant="secondary" className="bg-secondary/5 text-secondary border-secondary/10 text-[9px] font-black uppercase h-6 px-3">{badge}</Badge>
                           ))}
                        </div>

                        {review.photos?.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                             {review.photos.map((url: string, idx: number) => (
                               <div key={idx} className="relative h-32 aspect-square rounded-2xl overflow-hidden border shadow-sm shrink-0">
                                  <img src={url} className="w-full h-full object-cover" alt="Review photo" />
                               </div>
                             ))}
                          </div>
                        )}
                        
                        <Separator className="border-dashed" />
                     </div>
                   ))}
                </div>
              ) : (
                <div className="py-32 text-center bg-muted/10 rounded-[3rem] border-2 border-dashed flex flex-col items-center gap-4 opacity-40">
                   <MessageSquare className="w-12 h-12" />
                   <p className="text-sm font-black uppercase tracking-widest italic">Ainda não há avaliações para esta experiência.</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </section>
  );
}
