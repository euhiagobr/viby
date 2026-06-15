
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
  const { resolvedEvents, allOccurrences } = useRecurringEvents(rawEvents, now);
  const visibleEvents = useVisibleEvents(resolvedEvents, { ...filters, now });
  
  const featuredEvents = useFeaturedEvents(visibleEvents);
  const sponsoredEvents = useSponsoredEvents(visibleEvents);
  
  // CORREÇÃO: Separação explícita de Curadoria e Eventos Padrão
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
    let eventCounter = 0;
    let adIndex = 0;

    // 1. Patrocinados no topo (Regra: isSponsored == true)
    sponsoredEvents.forEach(ev => feed.push({ type: 'event', data: ev }));

    // 2. Curadoria (Regra: curationType == 'curadoria')
    curatedEvents.forEach(ev => feed.push({ type: 'event', data: ev }));

    // 3. Intercala Standard com Slots de Ads
    standardEvents.forEach(ev => {
      feed.push({ type: 'event', data: ev });
      eventCounter++;
      
      // Insere um Ad a cada 6 eventos padrão
      if (eventCounter > 0 && eventCounter % 6 === 0) {
        feed.push({ type: 'ad', adIndex: adIndex++ });
      }
    });

    return feed;
  }, [sponsoredEvents, curatedEvents, standardEvents]);

  // LOGS DE AUDITORIA
  useEffect(() => {
    console.log("[HOME-FEED-DIAGNOSTIC]", {
      rawEvents: rawEvents.length,
      resolvedWithRecurrence: resolvedEvents.length,
      visibleAfterFilters: visibleEvents.length,
      sponsored: sponsoredEvents.length,
      curated: curatedEvents.length,
      standard: standardEvents.length,
      activeAds: ads.length,
      finalFeedSize: unifiedFeed.length
    });
  }, [rawEvents, resolvedEvents, visibleEvents, sponsoredEvents, curatedEvents, standardEvents, ads, unifiedFeed]);

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
