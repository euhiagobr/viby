'use client';

import * as React from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, limit } from "firebase/firestore";
import { EventCard } from "./EventCard";
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious 
} from "@/components/ui/carousel";
import { Sparkles } from "lucide-react";
import { cn, normalizeText, safeParseDate } from "@/lib/utils";

interface EventRelatedEventsProps {
  currentEventId: string;
  currentTags: string[];
  className?: string;
}

const CAMPAIGN_GROUPS: Record<string, string[]> = {
  FESTA_JUNINA: ['festajunina', 'junina'],
  COPA_DO_MUNDO: ['copa', 'copadomundo'],
  HALLOWEEN: ['halloween', 'halloweenparty'],
  OKTOBERFEST: ['oktoberfest'],
  CARNAVAL: ['carnaval'],
  ANO_NOVO: ['ano-novo'],
  NATAL: ['natal']
};

const ALL_SPECIAL_TAGS = Object.values(CAMPAIGN_GROUPS).flat();

export function EventRelatedEvents({ currentEventId, currentTags, className }: EventRelatedEventsProps) {
  const db = useFirestore();
  
  const relatedQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, "events"),
      where("status", "==", "Ativo"),
      limit(50) // Buscamos um lote maior para filtrar localmente por tags
    );
  }, [db]);

  const { data: allEvents, loading } = useCollection<any>(relatedQuery);

  const processedRelated = React.useMemo(() => {
    if (!allEvents || allEvents.length === 0) return [];

    const now = new Date();
    const normalizedCurrentTags = currentTags.map(t => t.toLowerCase());

    // Identifica o grupo de campanha do evento atual
    const currentGroup = Object.entries(CAMPAIGN_GROUPS).find(([_, tags]) => 
      tags.some(t => normalizedCurrentTags.includes(t))
    )?.[0];

    return allEvents
      .filter(ev => {
        // Regras básicas de filtro
        if (ev.id === currentEventId) return false;
        
        const evTags = (ev.tags || []).map((t: string) => t.toLowerCase());
        
        // Deve possuir pelo menos uma tag especial
        const hasSpecialTag = evTags.some((t: string) => ALL_SPECIAL_TAGS.includes(t));
        if (!hasSpecialTag) return false;

        // Filtro de data (apenas futuros ou acontecendo)
        const d = safeParseDate(ev.date);
        const end = ev.endDate ? safeParseDate(ev.endDate) : (d ? new Date(d.getTime() + 4 * 3600000) : null);
        if (end && end < now) return false;

        return true;
      })
      .map(ev => {
        const evTags = (ev.tags || []).map((t: string) => t.toLowerCase());
        
        // 1. Mesmo grupo de campanha?
        const evGroup = Object.entries(CAMPAIGN_GROUPS).find(([_, tags]) => 
          tags.some(t => evTags.includes(t))
        )?.[0];
        const isSameGroup = currentGroup && evGroup === currentGroup;

        // 2. Sobreposição de tags especiais
        const overlapCount = evTags.filter((t: string) => normalizedCurrentTags.includes(t)).length;

        // 3. Data
        const evDate = safeParseDate(ev.date)?.getTime() || 0;

        return {
          ...ev,
          _score: {
            sameGroup: isSameGroup ? 1 : 0,
            overlap: overlapCount,
            date: evDate
          }
        };
      })
      .sort((a, b) => {
        // Ordenação por Relevância
        if (b._score.sameGroup !== a._score.sameGroup) {
          return b._score.sameGroup - a._score.sameGroup;
        }
        if (b._score.overlap !== a._score.overlap) {
          return b._score.overlap - a._score.overlap;
        }
        return a._score.date - b._score.date;
      })
      .slice(0, 6);
  }, [allEvents, currentEventId, currentTags]);

  if (loading || processedRelated.length === 0) return null;

  return (
    <section className={cn("space-y-8", className)}>
      <div className="flex items-center gap-3 px-2">
        <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
          <Sparkles className="w-5 h-5 fill-current" />
        </div>
        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Você também pode gostar</h2>
      </div>

      <Carousel
        opts={{
          align: "start",
          loop: false,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-4">
          {processedRelated.map((relatedEvent) => (
            <CarouselItem key={relatedEvent.id} className="pl-4 basis-full sm:basis-1/2 lg:basis-1/3">
              <EventCard event={relatedEvent} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="hidden md:flex justify-end gap-2 mt-4">
          <CarouselPrevious className="static translate-y-0 rounded-xl" />
          <CarouselNext className="static translate-y-0 rounded-xl" />
        </div>
      </Carousel>
    </section>
  );
}
