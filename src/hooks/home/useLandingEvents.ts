'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs, startAfter, DocumentSnapshot } from 'firebase/firestore';

/**
 * Hook de busca de eventos para a Landing Page.
 * Removido o filtro rígido de data na query para garantir compatibilidade com dados legados (String vs Timestamp).
 * O filtro de visibilidade real acontece no cliente via useVisibleEvents.
 */
export function useLandingEvents(initialEvents: any[] = []) {
  const db = useFirestore();
  const [rawEvents, setRawEvents] = useState<any[]>(initialEvents);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(initialEvents.length === 0);

  const fetchEvents = useCallback(async (isInitial = false) => {
    if (!db || isFetching) return;
    
    setIsFetching(true);
    try {
      // Carregamos uma massa maior inicialmente para permitir filtros de visibilidade e recorrência no cliente
      const fetchLimit = isInitial ? 35 : 15;

      let q;
      if (isInitial) {
        q = query(
          collection(db, "events"),
          where("status", "==", "Ativo"),
          orderBy("date", "asc"),
          limit(fetchLimit)
        );
      } else {
        const lastEvent = rawEvents[rawEvents.length - 1];
        // Resiliência para cursor: Prioriza snapshot, fallback para valor bruto da data
        const cursor = lastVisible || (lastEvent ? lastEvent.date : null);
        
        q = query(
          collection(db, "events"),
          where("status", "==", "Ativo"),
          orderBy("date", "asc"),
          startAfter(cursor),
          limit(fetchLimit)
        );
      }
      
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
      
      setHasMore(snapshot.docs.length === fetchLimit);
    } catch (e) {
      console.error("[useLandingEvents Error]", e);
    } finally {
      setIsFetching(false);
      setIsInitialLoad(false);
    }
  }, [db, lastVisible, isFetching, rawEvents]);

  useEffect(() => {
    if (initialEvents.length === 0) {
      fetchEvents(true);
    } else {
      setIsInitialLoad(false);
    }
  }, [initialEvents.length, fetchEvents]);

  return { 
    rawEvents, 
    isFetching, 
    isInitialLoad, 
    hasMore, 
    fetchMore: () => fetchEvents(false) 
  };
}
