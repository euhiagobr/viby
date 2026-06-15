'use client';

import { useMemo, useState, useEffect } from 'react';
import { useLandingEvents } from './useLandingEvents';
import { useRecurringEvents } from './useRecurringEvents';
import { useVisibleEvents } from './useVisibleEvents';
import { useFeaturedEvents } from './useFeaturedEvents';
import { useAds } from './useAds';
import { type Coordinates } from '@/lib/location-utils';

/**
 * Orquestrador do feed da Landing Page.
 * Mantém a cronologia global vinda do useVisibleEvents e intercala anúncios.
 */
export function useHomeFeed(initialEvents: any[], filters: { searchName: string, searchCity: string, userLocation: Coordinates | null }) {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const { rawEvents, isFetching, isInitialLoad, hasMore, fetchMore } = useLandingEvents(initialEvents);
  const { resolvedEvents } = useRecurringEvents(rawEvents, now);
  const visibleEvents = useVisibleEvents(resolvedEvents, { ...filters, now });
  
  const featuredEvents = useFeaturedEvents(visibleEvents);
  const { ads } = useAds();

  const unifiedFeed = useMemo(() => {
    const feed: any[] = [];
    let adIndex = 0;

    // Diferente da versão anterior, não segregamos por buckets.
    // Mantemos a ordem cronológica vinda de 'visibleEvents'.
    visibleEvents.forEach((ev) => {
      feed.push({ type: 'event', data: ev });
      
      const eventCount = feed.filter(f => f.type === 'event').length;
      
      // Lógica de injeção de anúncios baseada em posições fixas/móveis
      if (eventCount === 4 && ads.length > 0) {
        feed.push({ type: 'ad', adIndex: adIndex++ });
      } 
      else if (eventCount === 7 && ads.length > 1) {
        feed.push({ type: 'ad', adIndex: adIndex++ });
      }
      else if (eventCount > 7 && (eventCount - 7) % 6 === 0 && ads.length > adIndex) {
        feed.push({ type: 'ad', adIndex: adIndex++ });
      }
    });

    return feed;
  }, [visibleEvents, ads]);

  return { 
    feed: unifiedFeed, 
    featuredEvents,
    isFetching, 
    isInitialLoad, 
    hasMore, 
    fetchMore,
    totalVisible: visibleEvents.length 
  };
}
