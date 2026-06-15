
'use client';

import { useMemo } from 'react';
import { normalizeText } from '@/lib/utils';
import { calculateDistanceMeters } from '@/lib/event-scoring-utils';
import { type Coordinates } from '@/lib/location-utils';

export function useVisibleEvents(events: any[], filters: { searchName: string, searchCity: string, userLocation: Coordinates | null, now: Date | null }) {
  const visibleEvents = useMemo(() => {
    const { searchName, searchCity, userLocation, now } = filters;

    return events.filter(e => {
      const startMs = new Date(e.date).getTime();
      if (isNaN(startMs)) return false;
      const endMs = e.endDate ? new Date(e.endDate).getTime() : (startMs + 6 * 60 * 60 * 1000);
      
      // Durante hidratação (now == null), permitimos ver o evento se o endMs for futuro em relação ao servidor
      const refNow = now || new Date();
      if (refNow.getTime() >= endMs) return false;

      // Filtros de busca
      const nameNorm = normalizeText(searchName);
      if (searchName && !normalizeText(e.title || "").includes(nameNorm)) return false;
      
      const cityNorm = normalizeText(searchCity);
      if (searchCity && !normalizeText(`${e.city || ""} ${e.state || ""}`).includes(cityNorm)) return false;
      
      return true;
    }).map(e => {
      let distMeters = Infinity;
      if (userLocation && e.latitude && e.longitude) {
        distMeters = calculateDistanceMeters(userLocation, { latitude: e.latitude, longitude: e.longitude });
      }
      const startDateTime = new Date(e.date);
      return { 
        ...e, 
        _distanceMeters: distMeters, 
        _startDateTime: isNaN(startDateTime.getTime()) ? new Date() : startDateTime 
      };
    });
  }, [events, filters]);

  return visibleEvents;
}
