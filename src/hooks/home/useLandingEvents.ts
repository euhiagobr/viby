
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs, startAfter, DocumentSnapshot, Timestamp } from 'firebase/firestore';

export function useLandingEvents(initialEvents: any[] = []) {
  const db = useFirestore();
  const [rawEvents, setRawEvents] = useState<any[]>(initialEvents);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(initialEvents.length >= 7);
  const [isFetching, setIsFetching] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(initialEvents.length === 0);

  const fetchEvents = useCallback(async (isInitial = false) => {
    if (!db || isFetching || (!isInitial && !hasMore)) return;
    
    setIsFetching(true);
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - 30);
      
      // Buscamos um volume maior para compensar eventos passados/pais de recorrência
      // e garantir que eventos normais futuros entrem no pool de processamento.
      const fetchLimit = isInitial ? 35 : 15;

      const q = query(
        collection(db, "events"),
        where("status", "==", "Ativo"),
        where("date", ">=", thresholdDate.toISOString()),
        orderBy("date", "asc"),
        ...(isInitial ? [limit(fetchLimit)] : [startAfter(lastVisible), limit(fetchLimit)])
      );
      
      const snapshot = await getDocs(q);
      const fetchedDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (isInitial) {
        setRawEvents(fetchedDocs);
      } else {
        setRawEvents(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const filtered = fetchedDocs.filter(f => !existingIds.has(f.id));
          return [...prev, ...filtered];
        });
      }
      
      if (snapshot.docs.length > 0) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      }
      
      // Mantemos o carregamento infinito se retornou o limite solicitado
      setHasMore(snapshot.docs.length >= fetchLimit);
    } catch (e) {
      console.error("[useLandingEvents Error]", e);
    } finally {
      setIsFetching(false);
      setIsInitialLoad(false);
    }
  }, [db, lastVisible, isFetching, hasMore]);

  useEffect(() => {
    if (initialEvents.length === 0) {
      fetchEvents(true);
    } else {
      setIsInitialLoad(false);
    }
  }, [initialEvents.length, fetchEvents]);

  return { rawEvents, isFetching, isInitialLoad, hasMore, fetchMore: () => fetchEvents(false) };
}
