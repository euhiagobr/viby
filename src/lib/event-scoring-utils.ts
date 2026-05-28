/**
 * @fileOverview Algoritmo de Pontuação (Scoring) para ordenação inteligente de eventos.
 * Combina proximidade física, relevância temporal e popularidade.
 */

import { calculateDistance, type Coordinates } from "./location-utils";

export interface ScoringMetrics {
  userLocation?: Coordinates | null;
  maxRadiusKm: number; // Raio máximo de influência (ex: 50km)
}

/**
 * Calcula o score final de um evento para ordenação.
 * finalScore = (distanceScore * 0.45) + (timeScore * 0.40) + (popularityScore * 0.15)
 */
export function calculateEventScore(event: any, metrics: ScoringMetrics): number {
  const now = new Date();
  const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
  
  // 1. Score de Tempo (0 a 1)
  // Eventos hoje ou começando em breve ganham pontuação máxima.
  const timeDiffMs = eventDate.getTime() - now.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const thirtyDaysMs = 30 * oneDayMs;

  let timeScore = 0;
  if (timeDiffMs < 0) {
    timeScore = 0; // Já aconteceu ou encerrando
  } else if (timeDiffMs < (2 * 60 * 60 * 1000)) {
    timeScore = 1.0; // Começando em menos de 2h: Prioridade Máxima
  } else {
    // Escala linear invertida: quanto mais longe no futuro, menor o score.
    // Máximo 1.0 (hoje) até 0.1 (daqui a 30 dias ou mais)
    timeScore = Math.max(0.1, 1 - (timeDiffMs / thirtyDaysMs));
  }

  // 2. Score de Distância (0 a 1)
  let distanceScore = 0.5; // Neutro se não houver localização
  let distanceKm = Infinity;

  if (metrics.userLocation && event.latitude && event.longitude) {
    distanceKm = calculateDistance(metrics.userLocation, {
      latitude: event.latitude,
      longitude: event.longitude
    });

    if (event.type === 'Online') {
      distanceScore = 0.8; // Eventos online são bem aceitos mas priorizamos locais físicos próximos
    } else {
      // Regra: < 5km = 1.0, > metrics.maxRadiusKm = 0.1
      distanceScore = Math.max(0.1, 1 - (distanceKm / metrics.maxRadiusKm));
      if (distanceKm < 5) distanceScore = 1.0;
    }
  }

  // 3. Score de Popularidade (0 a 1)
  // Baseado em curtidas, seguidores do organizador e ingressos (Mockado ou real)
  const likes = event.likesCount || 0;
  const followers = event.organizer?.followersCount || 0;
  const popularityScore = Math.min(1.0, (likes * 0.5 + followers * 0.1) / 100);

  // Pesos Oficiais
  const WEIGHT_DISTANCE = 0.45;
  const WEIGHT_TIME = 0.40;
  const WEIGHT_POPULARITY = 0.15;

  const finalScore = (distanceScore * WEIGHT_DISTANCE) + 
                     (timeScore * WEIGHT_TIME) + 
                     (popularityScore * WEIGHT_POPULARITY);

  return finalScore;
}

/**
 * Filtra eventos baseando-se em status de visibilidade e expiração.
 */
export function isEventVisible(event: any): boolean {
  if (event.status !== 'Ativo') return false;
  if (event.visibility === 'Oculto') return false;
  
  const now = new Date();
  const start = event.date?.toDate ? event.date.toDate() : new Date(event.date);
  const end = event.endDate?.toDate ? event.endDate.toDate() : (event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 4 * 60 * 60 * 1000));
  
  return end >= now;
}
