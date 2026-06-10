/**
 * @fileOverview Algoritmo de Pontuação (Scoring) para ordenação inteligente de eventos.
 * Prioriza proximidade crítica (5km) e ordem cronológica rigorosa.
 */

import { calculateDistance, type Coordinates } from "./location-utils";

export interface ScoringMetrics {
  userLocation?: Coordinates | null;
  maxRadiusKm: number;
}

/**
 * Calcula o score de um evento para fins de ordenação.
 * Hierarquia de pesos:
 * 1. Raio Crítico (Até 5km): Ganha bônus de 1.000.000.000 para ir ao topo.
 * 2. Ordem Cronológica: Utiliza timestamp inverso (eventos mais cedo = score maior).
 * 3. Tie-breakers: Patrocínio e popularidade.
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

  const endDate = parseDate(event.endDate) || new Date(startDate.getTime() + 4 * 60 * 60 * 1000);
  
  if (endDate < now) return -1000000; // Evento encerrado

  // 1. LÓGICA DE PROXIMIDADE CRÍTICA
  let proximityBonus = 0;
  if (metrics.userLocation && event.latitude && event.longitude) {
    const distance = calculateDistance(metrics.userLocation, {
      latitude: event.latitude,
      longitude: event.longitude
    });

    if (distance <= 5) {
      proximityBonus = 1000000000; // Prioridade máxima absoluta
    } else {
      // Score de proximidade gradual para eventos fora do raio crítico
      proximityBonus = Math.max(0, (1 - (distance / metrics.maxRadiusKm)) * 1000);
    }
  }

  // 2. LÓGICA CRONOLÓGICA (PESO PRINCIPAL APÓS PROXIMIDADE)
  // Usamos uma base fixa no futuro para garantir que datas menores resultem em scores maiores.
  // 2.000.000.000.000 ms é aproximadamente o ano 2033.
  const timeScore = 2000000000000 - startDate.getTime();

  // 3. BÔNUS DE PATROCÍNIO E ENGAJAMENTO (TIE BREAKERS)
  const popularityBonus = (event.isSponsored ? 5000 : 0) + (event.interestedCount || 0);

  return proximityBonus + timeScore + popularityBonus;
}

/**
 * Define se um evento deve ser exibido nas vitrines públicas.
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

  const end = parseDate(event.endDate) || new Date(start.getTime() + 6 * 60 * 60 * 1000);
  
  return now < end;
}
