'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { format, startOfToday, addDays } from "date-fns";

/**
 * Hook para resolver a próxima data válida de eventos recorrentes.
 * Injeta a data da ocorrência mais próxima e mantém uma lista das próximas sessões.
 */
export function useRecurringEvents(events: any[], now: Date | null) {
  const db = useFirestore();

  const occurrencesQuery = useMemoFirebase(() => {
    if (!db) return null;
    // Buscamos todas as ocorrências ativas desde ontem para garantir cobertura de fuso horário
    const yesterdayStr = format(addDays(startOfToday(), -1), 'yyyy-MM-dd');
    return query(
      collection(db, "recurring_occurrences"), 
      where("status", "==", "active"), 
      where("date", ">=", yesterdayStr)
    );
  }, [db]);

  const { data: allOccurrences } = useCollection<any>(occurrencesQuery);

  const resolvedEvents = useMemo(() => {
    if (!events) return [];
    
    const refTime = now || new Date();

    return events.map(e => {
      let effectiveDate = e.date;
      let effectiveEndDate = e.endDate;
      let nextOccurrences: any[] = [];
      
      if (e.isRecurring && allOccurrences) {
        // Filtra ocorrências pertencentes a este evento pai
        const myOccs = allOccurrences.filter((o: any) => o.parentId === e.id) || [];
        
        if (myOccs.length > 0) {
          // Ordena cronologicamente
          const sorted = [...myOccs]
            .map(o => ({ ...o, _dt: new Date(o.date + 'T' + (o.startTime || '00:00') + ':00') }))
            .sort((a, b) => a._dt.getTime() - b._dt.getTime());
          
          // Localiza a primeira ocorrência que termina no futuro (threshold de 6h de tolerância)
          const nextValid = sorted.find(o => {
            const endThreshold = new Date(o._dt.getTime() + 6 * 60 * 60 * 1000);
            return refTime < endThreshold;
          });

          if (nextValid) {
            effectiveDate = nextValid.date + 'T' + (nextValid.startTime || '19:00') + ':00';
            
            // Resolvemos o término baseado na ocorrência para evitar que o endDate antigo do pai esconda o evento
            if (nextValid.endTime) {
              effectiveEndDate = nextValid.date + 'T' + nextValid.endTime + ':00';
            } else {
              // Fallback: mantém a duração original ou 4h
              const startParent = new Date(e.date).getTime();
              const endParent = new Date(e.endDate).getTime();
              const duration = (!isNaN(startParent) && !isNaN(endParent) && endParent > startParent) 
                ? (endParent - startParent) 
                : (4 * 60 * 60 * 1000);
              effectiveEndDate = new Date(new Date(effectiveDate).getTime() + duration).toISOString();
            }

            // Pega as 3 próximas datas para exibição no card
            nextOccurrences = sorted
              .filter(o => new Date(o._dt.getTime() + 6 * 60 * 60 * 1000) > refTime)
              .slice(0, 3);
          }
        }
      }
      
      return { 
        ...e, 
        date: effectiveDate,
        endDate: effectiveEndDate,
        _nextOccurrences: nextOccurrences 
      };
    });
  }, [events, allOccurrences, now]);

  return { resolvedEvents, allOccurrences: allOccurrences || [] };
}
