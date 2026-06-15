
'use client';

import { useMemo } from 'react';
import { normalizeText } from '@/lib/utils';
import { calculateDistanceMeters, isEventVisible } from '@/lib/event-scoring-utils';
import { type Coordinates } from '@/lib/location-utils';

/**
 * Filtra e ordena eventos visíveis.
 * Aplica ordenação rigorosa: Data (ASC) -> Distância (ASC).
 */
export function useVisibleEvents(events: any[], filters: { searchName: string, searchCity: string, userLocation: Coordinates | null, now: Date | null }) {
  const visibleEvents = useMemo(() => {
    const { searchName, searchCity, userLocation, now } = filters;

    const processed = events.filter(e => {
      if (!isEventVisible(e, now)) return false;

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
      
      const dateStr = e.date?.toDate ? e.date.toDate().toISOString() : e.date;
      const startDateTime = new Date(dateStr);
      const finalDate = isNaN(startDateTime.getTime()) ? new Date() : startDateTime;

      return { 
        ...e, 
        _distanceMeters: distMeters, 
        _startDateTime: finalDate 
      };
    });

    // Ordenação Global: Primeiro Data, depois Distância
    return [...processed].sort((a, b) => {
      const timeA = a._startDateTime.getTime();
      const timeB = b._startDateTime.getTime();
      
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      
      return (a._distanceMeters || Infinity) - (b._distanceMeters || Infinity);
    });
  }, [events, filters]);

  return visibleEvents;
}
