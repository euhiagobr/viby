/**
 * @fileOverview Algoritmo de Pontuação (Scoring) para ordenação inteligente de eventos.
 * Combina proximidade física, relevância temporal e popularidade.
 * ATUALIZAÇÃO: Prioridade para eventos próximos (< 5km) ordenados por dia e hora.
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
  // Quanto mais perto do "agora", maior o score
  if (isLive) {
    // Evento acontecendo agora: Prioridade máxima na cronologia
    timeScore = 8.0; 
  } else if (isUpcomingToday) {
    // Evento hoje mas ainda não começou
    timeScore = 6.0;
  } else if (timeUntilStart > 0) {
    // Eventos futuros: Decaimento linear sobre 30 dias (mais cedo = mais pontos)
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    timeScore = Math.max(0.1, 4 - (timeUntilStart / thirtyDaysMs));
  } else {
    // Evento já encerrado
    timeScore = 0.01;
  }

  // 2. Score de Distância e Bônus de Proximidade Imediata
  let distanceScore = 0.5;
  let proximityBonus = 0;
  let distance = null;

  if (metrics.userLocation && event.latitude && event.longitude) {
    distance = calculateDistance(metrics.userLocation, {
      latitude: event.latitude,
      longitude: event.longitude
    });

    // Se estiver a menos de 5km, ganha bônus massivo para ser o "primeiro da fila"
    if (distance <= 5) {
      proximityBonus = 25; // Garante que fique acima de qualquer evento longe
    }

    distanceScore = Math.max(0.1, 1 - (distance / metrics.maxRadiusKm));
  }

  // Pesos Finais
  // Aumentamos o peso do tempo para que dentro do raio de 5km a ordem seja cronológica
  const WEIGHT_TIME = 0.80; 
  const WEIGHT_DISTANCE = 0.10;
  const WEIGHT_POPULARITY = 0.10;

  // Bônus de Patrocínio (Viby Ads)
  const sponsorBonus = event.isSponsored ? 2.0 : 0;

  return proximityBonus + (timeScore * WEIGHT_TIME) + (distanceScore * WEIGHT_DISTANCE) + (0.5 * WEIGHT_POPULARITY) + sponsorBonus;
}

/**
 * Define se um evento deve ser exibido nas vitrines públicas (Discovery/Landing).
 * Eventos encerrados ou não ativos são ocultados automaticamente.
 */
export function isEventVisible(event: any): boolean {
  if (!event || event.status !== 'Ativo') return false;
  
  const now = new Date();
  const parseDate = (val: any) => {
    if (!val) return null;
    if (val.toDate) return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const start = parseDate(event.date);
  if (!start) return false;

  // Se não tem data de término definida, o Viby assume 6 horas após o início 
  // para remover o evento da vitrine automaticamente.
  const end = parseDate(event.endDate) || new Date(start.getTime() + 6 * 60 * 60 * 1000);
  
  // O evento só é visível se ainda não terminou
  return now < end;
}
