'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  ChevronRight, 
  CheckCircle2, 
  Users,
  Calendar,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/financial-utils';

interface ExperienceSlotsPublicProps {
  slots: any[];
  onSelect: (slot: any) => void;
  selectedSlotId?: string;
}

export function ExperienceSlotsPublic({ slots, onSelect, selectedSlotId }: ExperienceSlotsPublicProps) {
  const activeSlots = React.useMemo(() => {
    const now = new Date();
    return slots
      .filter(s => s.status === 'active')
      .filter(s => new Date(s.datetime) > now)
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  }, [slots]);

  if (activeSlots.length === 0) {
    return (
      <Card className="border-none shadow-sm rounded-3xl bg-orange-50 p-6 flex items-start gap-4">
         <Clock className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
         <div className="space-y-1">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-800">Sem horários próximos</h4>
            <p className="text-xs font-medium text-orange-700 leading-relaxed uppercase">Fique de olho! Novas datas para esta experiência serão publicadas em breve.</p>
         </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
         <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Horários Disponíveis</h3>
         <Badge className="bg-secondary text-white border-none text-[8px] font-black uppercase h-4 px-2">
            {activeSlots.length} Opções
         </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3">
         {activeSlots.map((slot) => {
           const isSelected = selectedSlotId === slot.id;
           const date = new Date(slot.datetime);
           const remaining = slot.capacity - (slot.sold || 0);
           const isSoldOut = remaining <= 0;
           const isLowStock = !isSoldOut && (remaining / slot.capacity) <= 0.1;

           return (
             <button
               key={slot.id}
               disabled={isSoldOut}
               onClick={() => onSelect(slot)}
               className={cn(
                 "w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center justify-between group",
                 isSelected ? "border-secondary bg-secondary/5 shadow-inner" : "border-transparent bg-white shadow-sm hover:bg-muted/50 hover:border-border",
                 isSoldOut && "opacity-50 grayscale cursor-not-allowed"
               )}
             >
                <div className="flex items-center gap-4">
                   <div className={cn(
                     "w-12 h-12 rounded-xl flex flex-col items-center justify-center transition-colors",
                     isSelected ? "bg-secondary text-white" : "bg-muted text-muted-foreground"
                   )}>
                      <span className="text-[8px] font-black uppercase leading-none">{date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                      <span className="text-lg font-black leading-none">{date.getDate()}</span>
                   </div>
                   <div className="space-y-0.5">
                      <p className="text-sm font-black uppercase italic text-primary leading-tight">
                        {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] font-bold text-muted-foreground uppercase">
                           {isSoldOut ? "Esgotado" : isLowStock ? "Últimas vagas" : "Disponível"}
                         </span>
                         {!isSoldOut && (
                           <span className="text-[10px] font-black text-secondary uppercase">{formatCurrency(slot.price)}</span>
                         )}
                      </div>
                   </div>
                </div>
                {isSelected ? (
                  <CheckCircle2 className="w-5 h-5 text-secondary animate-in zoom-in-50" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground opacity-20 group-hover:opacity-100 transition-all" />
                )}
             </button>
           );
         })}
      </div>
    </div>
  );
}
