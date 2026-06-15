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
      
      if (e.isRecurring && allOccurrences && allOccurrences.length > 0) {
        const myOccs = allOccurrences.filter((o: any) => o.parentId === e.id) || [];
        
        if (myOccs.length > 0) {
          // Ordena cronologicamente (Local para evitar desvios de GMT)
          const sorted = [...myOccs]
            .map(o => ({ ...o, _dt: new Date(`${o.date}T${o.startTime || '19:00'}:00`) }))
            .sort((a, b) => a._dt.getTime() - b._dt.getTime());
          
          const nextValid = sorted.find(o => {
            const endThreshold = new Date(o._dt.getTime() + 6 * 60 * 60 * 1000);
            return refTime < endThreshold;
          });

          if (nextValid) {
            effectiveDate = `${nextValid.date}T${nextValid.startTime || '19:00'}:00`;
            
            if (nextValid.endTime) {
              effectiveEndDate = `${nextValid.date}T${nextValid.endTime}:00`;
            } else {
              const dStart = new Date(e.date || 0).getTime();
              const dEnd = new Date(e.endDate || 0).getTime();
              const duration = (!isNaN(dStart) && !isNaN(dEnd) && dEnd > dStart) 
                ? (dEnd - dStart) 
                : (4 * 60 * 60 * 1000);
              effectiveEndDate = new Date(new Date(effectiveDate).getTime() + duration).toISOString();
            }

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
