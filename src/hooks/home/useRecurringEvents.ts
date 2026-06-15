
'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { format, startOfToday, addDays } from "date-fns";

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
    
    // Referência de tempo para resolução (Garante que eventos recorrentes existam mesmo no server)
    const refTime = now || new Date();

    return events.map(e => {
      let effectiveDate = e.date;
      
      if (e.isRecurring && allOccurrences) {
        const myOccs = allOccurrences.filter((o: any) => o.parentId === e.id) || [];
        if (myOccs.length > 0) {
          const sorted = [...myOccs]
            .map(o => ({ ...o, _dt: new Date(o.date + 'T' + (o.startTime || '00:00') + ':00') }))
            .sort((a, b) => a._dt.getTime() - b._dt.getTime());
          
          const nextValid = sorted.find(o => {
            const endThreshold = new Date(o._dt.getTime() + 6 * 60 * 60 * 1000);
            return refTime < endThreshold;
          });

          if (nextValid) {
            effectiveDate = nextValid.date + 'T' + (nextValid.startTime || '19:00') + ':00';
          }
        }
      }
      return { ...e, date: effectiveDate };
    });
  }, [events, allOccurrences, now]);

  return { resolvedEvents, allOccurrences: allOccurrences || [] };
}
