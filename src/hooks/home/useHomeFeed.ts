
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

    // Patrocinados no topo
    sponsoredEvents.forEach(ev => feed.push({ type: 'event', data: ev }));

    // Intercala Standard com Slots de Ads
    standardEvents.forEach(ev => {
      feed.push({ type: 'event', data: ev });
      eventCounter++;
      if (eventCounter % 6 === 0) {
        feed.push({ type: 'ad', adIndex: adIndex++ });
      }
    });

    return feed;
  }, [sponsoredEvents, standardEvents]);

  // LOGS TEMPORÁRIOS DE DESENVOLVIMENTO
  useEffect(() => {
    console.log("[HOME-FEED-AUDIT]", {
      rawEvents: rawEvents.length,
      allOccurrences: allOccurrences.length,
      resolvedEvents: resolvedEvents.length,
      visibleEvents: visibleEvents.length,
      featuredEvents: featuredEvents.length,
      sponsoredEvents: sponsoredEvents.length,
      ads: ads.length,
      unifiedFeed: unifiedFeed.length
    });
  }, [rawEvents, allOccurrences, resolvedEvents, visibleEvents, featuredEvents, sponsoredEvents, ads, unifiedFeed]);

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
