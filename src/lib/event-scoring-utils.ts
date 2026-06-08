/**
 * @fileOverview Algoritmo de Pontuação (Scoring) para ordenação inteligente de eventos.
 * Combina proximidade física, relevância temporal e popularidade.
 * ATUALIZAÇÃO: Prioridade máxima para eventos "LIVE" (Acontecendo agora).
 */

import { calculateDistance, type Coordinates } from "./location-utils";

export interface ScoringMetrics {
  userLocation?: Coordinates | null;
  maxRadiusKm: number;
}

export function calculateEventScore(event: any, metrics: ScoringMetrics): number {
  const now = new Date();
  
  const parseDate = (val: any) => {
    if (!val) return null;
    if (val.toDate) return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const startDate = parseDate(event.date);
  if (!startDate) return 0;

  // Se não tem endDate, assume 4 horas de duração para fins de ranking
  const endDate = parseDate(event.endDate) || new Date(startDate.getTime() + 4 * 60 * 60 * 1000);
  
  let timeScore = 0;
  const isLive = now >= startDate && now < endDate;
  const isUpcomingToday = now < startDate && startDate.toDateString() === now.toDateString();
  const timeUntilStart = startDate.getTime() - now.getTime();

  // 1. Lógica de Tempo (Pesos agressivos para visibilidade)
  if (isLive) {
    // Evento acontecendo agora: Prioridade absoluta
    timeScore = 8.0; 
  } else if (isUpcomingToday) {
    // Evento hoje mas ainda não começou: Alta prioridade
    timeScore = 5.0;
  } else if (timeUntilStart > 0) {
    // Eventos futuros: Decaimento linear sobre 30 dias
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    timeScore = Math.max(0.1, 2 - (timeUntilStart / thirtyDaysMs));
  } else {
    // Evento já encerrado: Ranking mínimo
    timeScore = 0.01;
  }

  // 2. Score de Distância (0 a 1)
  let distanceScore = 0.5;
  if (metrics.userLocation && event.latitude && event.longitude) {
    const distanceKm = calculateDistance(metrics.userLocation, {
      latitude: event.latitude,
      longitude: event.longitude
    });
    // Se estiver a menos de 5km, ganha bônus de proximidade
    distanceScore = Math.max(0.1, 1 - (distanceKm / metrics.maxRadiusKm));
    if (distanceKm < 5) distanceScore += 0.5;
  }

  // Pesos Finais
  const WEIGHT_TIME = 0.75; // Tempo é o fator principal para o "Agora"
  const WEIGHT_DISTANCE = 0.15;
  const WEIGHT_POPULARITY = 0.10;

  // Bônus de Patrocínio (Viby Ads)
  const sponsorBonus = event.isSponsored ? 1.5 : 0;

  return (timeScore * WEIGHT_TIME) + (distanceScore * WEIGHT_DISTANCE) + (0.5 * WEIGHT_POPULARITY) + sponsorBonus;
}

export function isEventVisible(event: any): boolean {
  if (event.status !== 'Ativo') return false;
  
  const now = new Date();
  const parseDate = (val: any) => {
    if (!val) return null;
    if (val.toDate) return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const start = parseDate(event.date);
  if (!start) return false;

  // Se não tem data de término, assume 8 horas após o início para evitar sumir imediatamente
  const end = parseDate(event.endDate) || new Date(start.getTime() + 8 * 60 * 60 * 1000);
  
  // Eventos encerrados param de ser exibidos no Discovery global imediatamente
  return end >= now;
}
