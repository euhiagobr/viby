
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs, startAfter, DocumentSnapshot } from 'firebase/firestore';

export function useLandingEvents(initialEvents: any[] = []) {
  const db = useFirestore();
  const [rawEvents, setRawEvents] = useState<any[]>(initialEvents);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(initialEvents.length >= 12);
  const [isFetching, setIsFetching] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(initialEvents.length === 0);

  const fetchEvents = useCallback(async (isInitial = false) => {
    if (!db || isFetching || (!isInitial && !hasMore)) return;
    
    setIsFetching(true);
    try {
      // Threshold de 30 dias no cliente para evitar carregar lixo histórico 
      // mas permitir eventos recorrentes ativos.
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - 30);
      const dateThreshold = thresholdDate.toISOString();

      const q = query(
        collection(db, "events"),
        where("status", "==", "Ativo"),
        where("date", ">=", dateThreshold),
        orderBy("date", "asc"),
        ...(isInitial ? [limit(15)] : [startAfter(lastVisible), limit(8)])
      );
      
      const snapshot = await getDocs(q);
      const fetchedDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (isInitial) {
        setRawEvents(fetchedDocs);
      } else {
        setRawEvents(prev => {
          // Evita duplicatas se o SSR e o Client carregarem o mesmo evento
          const existingIds = new Set(prev.map(i => i.id));
          const filtered = fetchedDocs.filter(f => !existingIds.has(f.id));
          return [...prev, ...filtered];
        });
      }
      
      if (snapshot.docs.length > 0) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      }
      setHasMore(snapshot.docs.length >= (isInitial ? 15 : 8));
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
