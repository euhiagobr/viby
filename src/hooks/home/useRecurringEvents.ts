'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { format, startOfToday, addDays } from "date-fns";
import { safeParseDate } from '@/lib/utils';

/**
 * Hook para resolver a próxima data válida de eventos recorrentes.
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
      const baseDate = safeParseDate(e.date);
      let effectiveDate = baseDate;
      let effectiveEndDate = safeParseDate(e.endDate);
      let nextOccurrences: any[] = [];
      
      if (e.isRecurring && allOccurrences && allOccurrences.length > 0) {
        const myOccs = allOccurrences.filter((o: any) => o.parentId === e.id) || [];
        
        if (myOccs.length > 0) {
          const sorted = [...myOccs]
            .map(o => ({ ...o, _dt: safeParseDate(`${o.date}T${o.startTime || '19:00'}:00`) }))
            .filter(o => o._dt !== null)
            .sort((a, b) => a._dt!.getTime() - b._dt!.getTime());
          
          const nextValid = sorted.find(o => {
            const endThreshold = new Date(o._dt!.getTime() + 6 * 60 * 60 * 1000);
            return refTime < endThreshold;
          });

          if (nextValid) {
            effectiveDate = nextValid._dt;
            
            if (nextValid.endTime) {
              effectiveEndDate = safeParseDate(`${nextValid.date}T${nextValid.endTime}:00`);
            } else if (baseDate) {
              const dStart = baseDate.getTime();
              const dEnd = safeParseDate(e.endDate)?.getTime() || (dStart + 4 * 60 * 60 * 1000);
              effectiveEndDate = new Date(effectiveDate!.getTime() + (dEnd - dStart));
            }

            nextOccurrences = sorted
              .filter(o => new Date(o._dt!.getTime() + 6 * 60 * 60 * 1000) > refTime)
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

  return { resolvedEvents };
}
