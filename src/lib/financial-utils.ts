/**
 * @fileOverview Utilitários financeiros atualizados para o modelo de Organizações.
 * A taxa administrativa agora é calculada com base no plano do USUÁRIO (owner),
 * mas as transações pertencem à ORGANIZAÇÃO.
 */

export type UserPlan = 'free' | 'pro' | 'top';

export interface PlanConfig {
  percent: number;
  min: number;
  orgLimit: number;
}

export const PLAN_CONFIGS: Record<UserPlan, PlanConfig> = {
  free: { percent: 0.16, min: 9.99, orgLimit: 1 },
  pro: { percent: 0.10, min: 7.49, orgLimit: 5 },
  top: { percent: 0.08, min: 3.99, orgLimit: 10 },
};

export const ADMINISTRATIVE_FEE_PERCENT = 0.15;

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function calculateFinancialBreakdown(basePrice: number, ownerPlan: UserPlan = 'free') {
  if (basePrice <= 0) return { customerPrice: 0, netAmount: 0, fee: 0 };

  const config = PLAN_CONFIGS[ownerPlan];
  
  // Taxa do comprador
  const adminFee = Number((basePrice * ADMINISTRATIVE_FEE_PERCENT).toFixed(2));
  const customerPrice = basePrice + adminFee;

  // Taxa do vendedor (descontada do base)
  const percentCalculated = Number((basePrice * config.percent).toFixed(2));
  const sellerFee = Math.max(percentCalculated, config.min);
  const netAmount = Number((basePrice - sellerFee).toFixed(2));

  return {
    customerPrice,
    netAmount,
    fee: sellerFee + adminFee,
    sellerFee,
    adminFee
  };
}