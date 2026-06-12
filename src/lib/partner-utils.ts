
/**
 * @fileOverview Utilitários para o sistema de Parceiros Viby.
 */

export interface PartnerTier {
  min: number;
  max: number | null;
  value: number;
}

/**
 * Localiza o valor da comissão baseado na faixa de preço do ingresso.
 */
export function calculatePartnerCommissionValue(price: number, tiers: PartnerTier[]): number {
  if (!tiers || tiers.length === 0) return 0;

  const tier = tiers.find(t => {
    const isAboveMin = price >= t.min;
    const isBelowMax = t.max === null || price <= t.max;
    return isAboveMin && isBelowMax;
  });

  return tier ? tier.value : 0;
}

/**
 * Valida se as faixas de comissão são consistentes (sem sobreposição ou buracos).
 */
export function validatePartnerTiers(tiers: PartnerTier[]): { valid: boolean; error?: string } {
  if (!tiers || tiers.length === 0) {
    return { valid: false, error: "Pelo menos uma faixa é obrigatória." };
  }

  // Ordena por valor mínimo
  const sorted = [...tiers].sort((a, b) => a.min - b.min);

  if (sorted[0].min !== 0) {
    return { valid: false, error: "A primeira faixa deve começar em 0,00." };
  }

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    
    if (current.max !== null && current.min >= current.max) {
      return { valid: false, error: "Valor mínimo deve ser menor que o máximo na faixa." };
    }

    if (i < sorted.length - 1) {
      const next = sorted[i + 1];
      if (current.max === null) {
        return { valid: false, error: "Somente a última faixa pode ter valor máximo ilimitado." };
      }
      
      // Verifica lacuna ou sobreposição
      // Aceitamos uma diferença de 0.01 para ser contíguo (ex: 5.00 e 5.01)
      if (Math.abs(next.min - current.max) > 0.02 || next.min <= current.max) {
        return { valid: false, error: `Inconsistência entre as faixas: ${current.max} e ${next.min}.` };
      }
    }
  }

  const last = sorted[sorted.length - 1];
  if (last.max !== null) {
    return { valid: false, error: "A última faixa deve ter valor máximo ilimitado (vazio)." };
  }

  return { valid: true };
}
