'use client';

import { useMemo } from 'react';
import { normalizeText } from '@/lib/utils';
import { calculateDistanceMeters, isEventVisible } from '@/lib/event-scoring-utils';
import { type Coordinates } from '@/lib/location-utils';

/**
 * Filtra e ordena eventos visíveis.
 * Aplica ordenação rigorosa: Data (ASC) -> Distância (ASC).
 */
export function useVisibleEvents(
  events: any[], 
  filters: { 
    searchName: string, 
    searchCity: string, 
    selectedCategory: string,
    userLocation: Coordinates | null, 
    now: Date | null 
  }
) {
  const visibleEvents = useMemo(() => {
    const { searchName, searchCity, selectedCategory, userLocation, now } = filters;

    const processed = events.filter(e => {
      // 1. Visibilidade Temporal (Status Ativo e dentro da janela de 6h)
      if (!isEventVisible(e, now)) return false;

      // 2. Busca Inteligente (Nome, Local, Endereço, Bairro, Cidade, Estado)
      if (searchName) {
        const nameNorm = normalizeText(searchName);
        const eventTitle = normalizeText(e.title || "");
        const eventLocation = normalizeText(e.location || e.address?.venueName || "");
        const eventAddress = normalizeText(e.address?.addressLine1 || e.address?.street || "");
        const eventNeighborhood = normalizeText(e.address?.neighborhood || "");
        const eventCity = normalizeText(e.city || "");
        const eventState = normalizeText(e.state || e.address?.stateRegion || "");
        
        const matchesSearch = 
          eventTitle.includes(nameNorm) ||
          eventLocation.includes(nameNorm) ||
          eventAddress.includes(nameNorm) ||
          eventNeighborhood.includes(nameNorm) ||
          eventCity.includes(nameNorm) ||
          eventState.includes(nameNorm);

        if (!matchesSearch) return false;
      }
      
      // 3. Filtro de Cidade (Campo 2)
      if (searchCity) {
        const cityNorm = normalizeText(searchCity);
        if (!normalizeText(`${e.city || ""} ${e.state || ""}`).includes(cityNorm)) return false;
      }

      // 4. Filtro de Categoria Dinâmico
      if (selectedCategory !== "all") {
        if (e.categoryName !== selectedCategory) return false;
      }
      
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
