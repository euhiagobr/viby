/**
 * @fileOverview Utilitários financeiros atualizados para o modelo de Organizações.
 * A taxa administrativa agora é calculada com base no plano do USUÁRIO (owner),
 * mas as transações pertencem à ORGANIZAÇÃO.
 */

export type UserPlan = 'free' | 'pro' | 'top' | 'START' | 'PRO' | 'TOP';

export interface PlanConfig {
  percent: number;
  min: number;
  orgLimit: number;
}

export const PLAN_CONFIGS: Record<string, PlanConfig> = {
  free: { percent: 0.16, min: 9.99, orgLimit: 1 },
  start: { percent: 0.16, min: 9.99, orgLimit: 1 },
  pro: { percent: 0.10, min: 7.49, orgLimit: 5 },
  top: { percent: 0.08, min: 3.99, orgLimit: 10 },
};

export const ADMINISTRATIVE_FEE_PERCENT = 0.15;

export function formatCurrency(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function calculateFinancialBreakdown(basePrice: number, ownerPlan: string = 'free') {
  const price = parseFloat(basePrice as any) || 0;
  if (price <= 0) {
    return { 
      customerFinalPrice: 0, 
      producerNetAmount: 0, 
      administrativeFeeAmount: 0,
      producerFeeAmount: 0,
      ticketBasePrice: 0,
      producerFeePercent: 0
    };
  }

  // Normaliza o plano para buscar na config (PRO -> pro, START -> free)
  const normalizedPlan = (ownerPlan || 'free').toLowerCase();
  const config = PLAN_CONFIGS[normalizedPlan] || PLAN_CONFIGS['free'];
  
  // 1. Taxa administrativa cobrada do COMPRADOR (15% sobre o valor do ingresso)
  const administrativeFeeAmount = Number((price * ADMINISTRATIVE_FEE_PERCENT).toFixed(2));
  
  // 2. Preço final que o cliente paga no checkout
  const customerFinalPrice = Number((price + administrativeFeeAmount).toFixed(2));

  // 3. Taxa do plano cobrada do PRODUTOR (Descontada do valor base do ingresso)
  const producerFeeCalculated = Number((price * config.percent).toFixed(2));
  const producerFeeAmount = Math.max(producerFeeCalculated, config.min);

  // 4. Valor líquido que o produtor recebe por ingresso
  const producerNetAmount = Math.max(0, Number((price - producerFeeAmount).toFixed(2)));

  return {
    ticketBasePrice: price,
    customerFinalPrice,
    administrativeFeeAmount,
    producerFeeAmount,
    producerNetAmount,
    producerFeePercent: config.percent
  };
}
