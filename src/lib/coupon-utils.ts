
/**
 * @fileOverview Utilitários para lógica de cupons e pontuação.
 */

export interface PointThreshold {
  tickets: number;
  points: number;
}

export const POINT_THRESHOLDS: PointThreshold[] = [
  { tickets: 1, points: 1 },
  { tickets: 5, points: 5 },
  { tickets: 10, points: 30 },
  { tickets: 15, points: 35 },
  { tickets: 20, points: 60 },
  { tickets: 30, points: 90 },
  { tickets: 40, points: 120 },
  { tickets: 50, points: 150 },
  { tickets: 100, points: 300 },
  { tickets: 170, points: 500 }
];

/**
 * Calcula a pontuação baseada na quantidade de ingressos vendidos (uses).
 */
export function calculateUserCouponPoints(uses: number): number {
  if (uses <= 0) return 0;
  
  const sorted = [...POINT_THRESHOLDS].sort((a, b) => b.tickets - a.tickets);
  const threshold = sorted.find(t => uses >= t.tickets);
  
  return threshold ? threshold.points : uses;
}

/**
 * Retorna o próximo objetivo de pontuação.
 */
export function getNextPointThreshold(uses: number): PointThreshold | null {
  return POINT_THRESHOLDS.find(t => t.tickets > uses) || null;
}
