/**
 * @fileOverview Algoritmo de Pontuação (Scoring) para ordenação inteligente de eventos.
 * Combina proximidade física, relevância temporal e popularidade.
 */

import { calculateDistance, type Coordinates } from "./location-utils";

export interface ScoringMetrics {
  userLocation?: Coordinates | null;
  maxRadiusKm: number;
}

/**
 * Calcula o score de um evento para fins de ordenação.
 * Regras:
 * 1. Prioridade Máxima: Eventos em um raio de até 5km (Bônus de 10.000 pontos).
 * 2. Ordenação Secundária: Cronológica (Eventos mais próximos no tempo ganham mais pontos).
 * 3. Bônus de Patrocínio: Viby Ads (Bônus de 500 pontos).
 */
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
  
  // 1. LÓGICA DE PROXIMIDADE (PESO PRINCIPAL)
  let proximityScore = 0;
  if (metrics.userLocation && event.latitude && event.longitude) {
    const distance = calculateDistance(metrics.userLocation, {
      latitude: event.latitude,
      longitude: event.longitude
    });

    // Se estiver a menos de 5km, ganha um bônus massivo para ir ao topo absoluto
    if (distance <= 5) {
      proximityScore = 10000; 
    } else {
      // Fora dos 5km, ganha um score proporcional à proximidade dentro do raio escolhido
      proximityScore = Math.max(0, (1 - (distance / metrics.maxRadiusKm)) * 100);
    }
  }

  // 2. LÓGICA DE TEMPO (GRANULARIDADE CRONOLÓGICA)
  // Usamos uma data de referência no futuro para garantir que eventos mais cedo tenham score maior.
  // Um evento hoje deve valer mais que um amanhã.
  const farFuture = new Date(now.getFullYear() + 2, 0, 1).getTime();
  const eventTime = startDate.getTime();
  
  let timeScore = 0;
  if (endDate < now) {
    timeScore = -100000; // Evento encerrado (penalidade máxima)
  } else {
    // Diferença em horas como base para o score de tempo
    // Quanto menor a distância para o agora, maior o valor.
    timeScore = (farFuture - eventTime) / (1000 * 60 * 60);

    // Bônus adicional para eventos acontecendo AGORA ou HOJE
    if (now >= startDate && now < endDate) {
      timeScore += 1000; // Live now
    } else if (startDate.toDateString() === now.toDateString()) {
      timeScore += 500; // Today
    }
  }

  // 3. BÔNUS DE POPULARIDADE E PATROCÍNIO
  const popularityBonus = (event.viewsCount || 0) * 0.1 + (event.interestedCount || 0) * 0.5;
  const sponsorBonus = event.isSponsored ? 500 : 0;

  // Resultado final: Proximidade (5km) > Cronologia > Patrocínio > Popularidade
  return proximityScore + timeScore + sponsorBonus + popularityBonus;
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

  // O Viby assume 6 horas após o início para remover o evento da vitrine automaticamente se não houver data de fim.
  const end = parseDate(event.endDate) || new Date(start.getTime() + 6 * 60 * 60 * 1000);
  
  return now < end;
}
