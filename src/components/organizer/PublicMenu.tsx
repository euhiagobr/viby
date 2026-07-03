
'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Utensils, 
  Clock, 
  Zap, 
  Info,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Inbox
} from 'lucide-react';
import { cn, safeParseDate } from "@/lib/utils";

interface PublicMenuProps {
  orgId: string;
}

export function PublicMenu({ orgId }: PublicMenuProps) {
  const db = useFirestore();
  
  const sectionsQuery = useMemoFirebase(() => 
    db ? query(collection(db, 'organizations', orgId, 'menu_sections'), orderBy('ordem', 'asc')) : null, 
    [db, orgId]
  );
  const { data: sections, loading: loadingSections } = useCollection<any>(sectionsQuery);

  const itemsQuery = useMemoFirebase(() => 
    db ? query(collection(db, 'organizations', orgId, 'menu_items'), orderBy('nome', 'asc')) : null, 
    [db, orgId]
  );
  const { data: items, loading: loadingItems } = useCollection<any>(itemsQuery);

  const formatPrice = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const isPromoActive = (item: any) => {
    if (!item.promocional || !item.valorPromocional) return false;
    const now = new Date();
    const start = safeParseDate(item.promoInicio);
    const end = safeParseDate(item.promoFim);
    if (start && now < start) return false;
    if (end && now > end) return false;
    return true;
  };

  if (loadingSections || loadingItems) return <div className="py-32 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary opacity-20" /></div>;

  if (!sections || sections.length === 0) {
    return (
      <div className="py-40 text-center bg-white rounded-[3rem] border-2 border-dashed flex flex-col items-center gap-6 opacity-30 italic">
         <Utensils className="w-16 h-16" />
         <div className="space-y-1">
            <p className="text-xl font-black uppercase italic tracking-tighter">O cardápio está sendo preparado</p>
            <p className="text-xs font-bold uppercase">Volte em breve para conferir as delícias da casa.</p>
         </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-24 animate-in fade-in duration-700">
      {sections.map(section => {
        const sectionItems = items?.filter((i: any) => i.sectionId === section.id) || [];
        if (sectionItems.length === 0) return null;

        return (
          <section key={section.id} className="space-y-10">
            <div className="flex flex-col items-center gap-4">
               <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
               <h3 className="text-2xl md:text-4xl font-black uppercase italic tracking-widest text-primary text-center px-4">
                 {section.nome}
               </h3>
               <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
               {sectionItems.map((item: any) => {
                 const activePromo = isPromoActive(item);
                 return (
                   <div key={item.id} className="group space-y-3 p-4 rounded-3xl transition-all hover:bg-muted/10">
                      <div className="flex justify-between items-start gap-4">
                         <h4 className="font-black text-lg uppercase italic text-primary leading-tight group-hover:text-secondary transition-colors">
                           {item.nome}
                         </h4>
                         <div className="text-right shrink-0">
                            {activePromo ? (
                              <div className="flex flex-col items-end">
                                 <span className="text-[10px] font-black line-through text-red-500 opacity-40">{formatPrice(item.valor)}</span>
                                 <span className="text-xl font-black text-secondary italic tracking-tighter">{formatPrice(item.valorPromocional)}</span>
                              </div>
                            ) : (
                              <span className="text-lg font-black text-primary italic tracking-tighter">{formatPrice(item.valor)}</span>
                            )}
                         </div>
                      </div>

                      <div className="space-y-3">
                         <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                            {item.descricao}
                         </p>
                         
                         <div className="flex flex-wrap items-center gap-4">
                            {item.porcao && (
                               <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase">
                                  <Clock className="w-3 h-3 opacity-30" /> {item.porcao}
                               </div>
                            )}
                            {item.alergenicos?.length > 0 && (
                              <div className="flex gap-1">
                                 {item.alergenicos.map((a: string) => (
                                   <Badge key={a} variant="outline" className="text-[7px] font-black uppercase bg-red-50 text-red-500 border-red-100 h-4">
                                      {a}
                                   </Badge>
                                 ))}
                              </div>
                            )}
                            {activePromo && item.promoFim && (
                              <div className="flex items-center gap-1.5 text-[8px] font-black text-secondary uppercase animate-pulse">
                                 <Zap className="w-2.5 h-2.5 fill-current" /> Oferta por tempo limitado
                              </div>
                            )}
                         </div>
                      </div>
                   </div>
                 );
               })}
            </div>
          </section>
        );
      })}

      <div className="p-8 bg-secondary/5 rounded-[2.5rem] border border-secondary/10 flex items-start gap-4 shadow-sm">
         <Info className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
         <div className="space-y-1">
            <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary">Aviso Legal</h4>
            <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase">
               Preços e disponibilidade sujeitos a alteração sem aviso prévio. Se você possui alergias alimentares graves, informe nossa equipe de atendimento presencial antes de realizar seu pedido.
            </p>
         </div>
      </div>
    </div>
  );
}
