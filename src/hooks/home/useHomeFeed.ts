
'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useLandingEvents } from './useLandingEvents';
import { useRecurringEvents } from './useRecurringEvents';
import { useVisibleEvents } from './useVisibleEvents';
import { useAds } from './useAds';
import { type Coordinates } from '@/lib/location-utils';

/**
 * Orquestrador do feed da Landing Page com paginação controlada (7 inicial + 3 por clique).
 */
export function useHomeFeed(initialEvents: any[], filters: { searchName: string, searchCity: string, userLocation: Coordinates | null }) {
  const [now, setNow] = useState<Date | null>(null);
  const [displayLimit, setDisplayLimit] = useState(7);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const { rawEvents, isFetching, isInitialLoad, hasMore: dbHasMore, fetchMore: fetchFromDb } = useLandingEvents(initialEvents);
  const { resolvedEvents } = useRecurringEvents(rawEvents, now);
  const visibleEvents = useVisibleEvents(resolvedEvents, { ...filters, now });
  
  const { ads } = useAds();

  const handleLoadMore = useCallback(() => {
    const newLimit = displayLimit + 3;
    setDisplayLimit(newLimit);
    
    // Se o limite de exibição está chegando perto do fim do que temos carregado, buscamos mais no banco
    if (visibleEvents.length < newLimit + 2 && dbHasMore && !isFetching) {
      fetchFromDb();
    }
  }, [displayLimit, visibleEvents.length, dbHasMore, isFetching, fetchFromDb]);

  const unifiedFeed = useMemo(() => {
    const feed: any[] = [];
    let adIndex = 0;

    // Aplicamos o limite de exibição (7 inicial, depois +3)
    const paginatedEvents = visibleEvents.slice(0, displayLimit);

    paginatedEvents.forEach((ev, idx) => {
      feed.push({ type: 'event', data: ev });
      
      const eventCount = idx + 1;
      
      // Lógica de injeção de Ads solicitada:
      // 1º Ad: após 4 eventos
      if (eventCount === 4 && ads.length > 0) {
        feed.push({ type: 'ad', adIndex: adIndex++ });
      } 
      // 2º Ad: após 7 eventos (Total: 7 eventos + 2 ads)
      else if (eventCount === 7 && ads.length > 1) {
        feed.push({ type: 'ad', adIndex: adIndex++ });
      }
      // Ads subsequentes: ciclo de 6 eventos (13, 19, 25...)
      else if (eventCount > 7 && (eventCount - 7) % 6 === 0 && ads.length > adIndex) {
        feed.push({ type: 'ad', adIndex: adIndex++ });
      }
    });

    return feed;
  }, [visibleEvents, displayLimit, ads]);

  // hasMore é verdadeiro se houver dados no banco ou se ainda houver eventos carregados no buffer do cliente
  const hasMoreUI = dbHasMore || visibleEvents.length > displayLimit;

  return { 
    feed: unifiedFeed, 
    isFetching, 
    isInitialLoad, 
    hasMore: hasMoreUI, 
    fetchMore: handleLoadMore 
  };
}
