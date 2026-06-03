/**
 * @fileOverview Algoritmo de Pontuação (Scoring) para ordenação inteligente de eventos.
 * Combina proximidade física, relevância temporal e popularidade.
 */

import { calculateDistance, type Coordinates } from "./location-utils";

export interface ScoringMetrics {
  userLocation?: Coordinates | null;
  maxRadiusKm: number;
}

export function calculateEventScore(event: any, metrics: ScoringMetrics): number {
  const now = new Date();
  
  const parseDate = (val: any) => {
    if (!val) return now;
    if (val.toDate) return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? now : d;
  };

  const eventDate = parseDate(event.date);
  
  // 1. Score de Tempo
  const timeDiffMs = eventDate.getTime() - now.getTime();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  let timeScore = 0;
  if (timeDiffMs < 0) timeScore = 0.05; // Evento passado (penalidade leve para manter no feed se ativo)
  else if (timeDiffMs < (2 * 60 * 60 * 1000)) timeScore = 1.0; 
  else timeScore = Math.max(0.1, 1 - (timeDiffMs / thirtyDaysMs));

  // 2. Score de Distância
  let distanceScore = 0.5;
  if (metrics.userLocation && event.latitude && event.longitude) {
    const distanceKm = calculateDistance(metrics.userLocation, {
      latitude: event.latitude,
      longitude: event.longitude
    });
    distanceScore = Math.max(0.1, 1 - (distanceKm / metrics.maxRadiusKm));
    if (distanceKm < 5) distanceScore = 1.0;
  }

  const WEIGHT_DISTANCE = 0.45;
  const WEIGHT_TIME = 0.40;
  const WEIGHT_POPULARITY = 0.15;

  return (distanceScore * WEIGHT_DISTANCE) + (timeScore * WEIGHT_TIME) + (0.5 * WEIGHT_POPULARITY);
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
  
  // No modo de restauração, permitimos eventos até 24h após o término para evitar desaparecimento súbito
  const persistenceThreshold = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  
  return persistenceThreshold >= now;
}