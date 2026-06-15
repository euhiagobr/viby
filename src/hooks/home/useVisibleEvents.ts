'use client';

import { useMemo } from 'react';
import { normalizeText } from '@/lib/utils';
import { calculateDistanceMeters, isEventVisible } from '@/lib/event-scoring-utils';
import { type Coordinates } from '@/lib/location-utils';

export function useVisibleEvents(events: any[], filters: { searchName: string, searchCity: string, userLocation: Coordinates | null, now: Date | null }) {
  const visibleEvents = useMemo(() => {
    const { searchName, searchCity, userLocation, now } = filters;

    const processed = events.filter(e => {
      // Usamos a utilidade centralizada para garantir consistência entre os componentes
      if (!isEventVisible(e, now)) return false;

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
      
      // Garante que a data seja um objeto Date válido para o sort
      const dateStr = e.date?.toDate ? e.date.toDate().toISOString() : e.date;
      const startDateTime = new Date(dateStr);
      
      const finalDate = isNaN(startDateTime.getTime()) ? new Date() : startDateTime;

      return { 
        ...e, 
        _distanceMeters: distMeters, 
        _startDateTime: finalDate 
      };
    });

    // Log para diagnosticar a ordenação
    const sorted = [...processed].sort((a, b) => a._startDateTime.getTime() - b._startDateTime.getTime());
    
    console.log('[DEBUG-VIBY] Trace de Ordenação:', sorted.map(e => ({
      title: e.title,
      rawDate: e.date,
      computedISO: e._startDateTime.toISOString(),
      timestamp: e._startDateTime.getTime()
    })));

    return sorted;
  }, [events, filters]);

  return visibleEvents;
}
