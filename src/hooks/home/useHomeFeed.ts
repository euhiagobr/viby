'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useLandingEvents } from './useLandingEvents';
import { useRecurringEvents } from './useRecurringEvents';
import { useVisibleEvents } from './useVisibleEvents';
import { useAds } from './useAds';
import { type Coordinates } from '@/lib/location-utils';

/**
 * Orquestrador do feed da Landing Page.
 * Unifica eventos, resolve recorrências e intercala anúncios.
 */
export function useHomeFeed(
  initialEvents: any[], 
  filters: { 
    searchName: string, 
    searchCity: string, 
    selectedCategory: string,
    userLocation: Coordinates | null 
  }
) {
  const [now, setNow] = useState<Date | null>(null);
  const [displayLimit, setDisplayLimit] = useState(9);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const { rawEvents, isFetching, isInitialLoad: eventsLoading, hasMore: dbHasMore, fetchMore: fetchFromDb } = useLandingEvents(initialEvents);
  const { resolvedEvents, loading: recurringLoading } = useRecurringEvents(rawEvents, now);
  const { ads, loading: adsLoading } = useAds();

  // No cliente, esperamos a resolução de recorrências e ads para evitar flashes de dados desatualizados/vencidos
  const isInitialLoad = eventsLoading || (typeof window !== 'undefined' && (recurringLoading || (adsLoading && ads.length === 0)));

  const handleLoadMore = useCallback(() => {
    const newLimit = displayLimit + 3;
    setDisplayLimit(newLimit);
    
    if (resolvedEvents.length < newLimit + 2 && dbHasMore && !isFetching) {
      fetchFromDb();
    }
  }, [displayLimit, resolvedEvents.length, dbHasMore, isFetching, fetchFromDb]);

  // Filtros aplicados aos eventos resolvidos
  const visibleEvents = useVisibleEvents(resolvedEvents, { ...filters, now });

  // Geração dinâmica de categorias baseada em eventos resolvidos e ativos
  const dynamicCategories = useMemo(() => {
    const categoriesSet = new Set<string>();
    resolvedEvents.forEach(e => {
      // Apenas categorias de eventos que passariam no filtro de visibilidade básica (hoje em diante)
      if (e.categoryName) categoriesSet.add(e.categoryName);
    });
    return Array.from(categoriesSet).sort();
  }, [resolvedEvents]);

  const unifiedFeed = useMemo(() => {
    const feed: any[] = [];
    let adIndex = 0;

    const paginatedEvents = visibleEvents.slice(0, displayLimit);

    paginatedEvents.forEach((ev, idx) => {
      feed.push({ type: 'event', data: ev });
      
      const eventCount = idx + 1;
      
      // Inserção dinâmica de Ads
      if (eventCount === 4 && ads.length > 0) {
        feed.push({ type: 'ad', adIndex: adIndex % ads.length });
        adIndex++;
      } 
      else if (eventCount === 7 && ads.length > 1) {
        feed.push({ type: 'ad', adIndex: adIndex % ads.length });
        adIndex++;
      }
      else if (eventCount > 7 && (eventCount - 7) % 6 === 0 && ads.length > 0) {
        feed.push({ type: 'ad', adIndex: adIndex % ads.length });
        adIndex++;
      }
    });

    return feed;
  }, [visibleEvents, displayLimit, ads]);

  const hasMoreUI = dbHasMore || visibleEvents.length > displayLimit;

  return { 
    feed: unifiedFeed, 
    dynamicCategories,
    isFetching, 
    isInitialLoad, 
    hasMore: hasMoreUI, 
    fetchMore: handleLoadMore 
  };
}
