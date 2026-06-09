
export interface AffiliateLevel {
  level: number;
  minSales: number;
  commission: number;
  label: string;
}

export const AFFILIATE_LEVELS: AffiliateLevel[] = [
  { level: 0, minSales: 0, commission: 0.50, label: "Starter" },
  { level: 1, minSales: 500, commission: 0.75, label: "Bronze" },
  { level: 2, minSales: 1500, commission: 1.00, label: "Prata" },
  { level: 3, minSales: 2500, commission: 2.50, label: "Ouro" },
  { level: 4, minSales: 4000, commission: 3.00, label: "Platina" },
  { level: 5, minSales: 8000, commission: 5.00, label: "Diamante" },
  { level: 6, minSales: 10000, commission: 8.00, label: "Lenda" }
];

export function getAffiliateLevel(totalSales: number): AffiliateLevel {
  const levels = [...AFFILIATE_LEVELS].reverse();
  return levels.find(l => totalSales >= l.minSales) || AFFILIATE_LEVELS[0];
}

export function getNextLevel(totalSales: number): AffiliateLevel | null {
  return AFFILIATE_LEVELS.find(l => l.minSales > totalSales) || null;
}

export function generateAffiliateCode(name: string): string {
  const clean = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "").substring(0, 5);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${clean}${random}`;
}

export const AFFILIATE_SAFETY_DAYS = 7;
