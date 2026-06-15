
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useLandingEvents } from './useLandingEvents';
import { useRecurringEvents } from './useRecurringEvents';
import { useVisibleEvents } from './useVisibleEvents';
import { useFeaturedEvents } from './useFeaturedEvents';
import { useSponsoredEvents } from './useSponsoredEvents';
import { useAds } from './useAds';
import { type Coordinates } from '@/lib/location-utils';

export function useHomeFeed(initialEvents: any[], filters: { searchName: string, searchCity: string, userLocation: Coordinates | null }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const { rawEvents, isFetching, isInitialLoad, hasMore, fetchMore } = useLandingEvents(initialEvents);
  const { resolvedEvents } = useRecurringEvents(rawEvents, now);
  const visibleEvents = useVisibleEvents(resolvedEvents, { ...filters, now });
  
  const featuredEvents = useFeaturedEvents(visibleEvents);
  const sponsoredEvents = useMemo(() => 
    visibleEvents.filter(e => e.isSponsored === true), 
    [visibleEvents]
  );
  
  const curatedEvents = useMemo(() => 
    visibleEvents.filter(e => e.curationType === 'curadoria' && !e.isSponsored), 
    [visibleEvents]
  );

  const standardEvents = useMemo(() => 
    visibleEvents.filter(e => !e.isFeatured && !e.isSponsored && e.curationType !== 'curadoria')
      .sort((a, b) => a._startDateTime.getTime() - b._startDateTime.getTime()), 
    [visibleEvents]
  );

  const { ads } = useAds();

  const unifiedFeed = useMemo(() => {
    const feed: any[] = [];
    let adIndex = 0;

    // 1. Patrocinados no topo
    sponsoredEvents.forEach(ev => feed.push({ type: 'event', data: ev }));

    // 2. Curadoria
    curatedEvents.forEach(ev => feed.push({ type: 'event', data: ev }));

    // 3. Intercala Standard com Slots de Ads (Lógica 4-7-13-19...)
    standardEvents.forEach((ev, i) => {
      feed.push({ type: 'event', data: ev });
      const count = i + 1;
      
      // Primeiro ad após 4 eventos
      if (count === 4) {
        feed.push({ type: 'ad', adIndex: adIndex++ });
      } 
      // Segundo ad após mais 3 (total 7) e depois a cada 6
      else if (count >= 7 && (count - 7) % 6 === 0) {
        feed.push({ type: 'ad', adIndex: adIndex++ });
      }
    });

    return feed;
  }, [sponsoredEvents, curatedEvents, standardEvents]);

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
