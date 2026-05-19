/**
 * @fileOverview Utilitários centralizados para cálculo de taxas e breakdown financeiro do Viby.
 */

export type ProducerPlan = 'START' | 'PRO' | 'TOP';

export interface PlanConfig {
  percent: number;
  min: number;
}

export const PLAN_CONFIGS: Record<ProducerPlan, PlanConfig> = {
  START: { percent: 0.16, min: 9.99 },
  PRO: { percent: 0.10, min: 7.49 },
  TOP: { percent: 0.08, min: 3.99 },
};

export const ADMINISTRATIVE_FEE_PERCENT = 0.15; // 15% fixa para o comprador

export interface FinancialBreakdown {
  ticketBasePrice: number;
  administrativeFeePercent: number;
  administrativeFeeAmount: number;
  customerFinalPrice: number;
  producerPlan: ProducerPlan;
  producerFeePercent: number;
  producerFeeMinimum: number;
  producerFeeAmount: number;
  producerNetAmount: number;
  platformAdministrativeAmount: number;
  platformPlanAmount: number;
  platformGrossAmount: number;
  calculatedAt: string;
}

/**
 * Realiza o cálculo completo de taxas para um ingresso.
 * Regra: Taxa do produtor é o MAIOR valor entre (percentual do plano) e (valor mínimo).
 * @param basePrice O valor nominal do ingresso (definido pelo produtor).
 * @param plan O plano atual do organizador do evento.
 */
export function calculateFinancialBreakdown(basePrice: number, plan: string = 'START'): FinancialBreakdown {
  const normalizedPlan = (plan?.toUpperCase() as ProducerPlan) || 'START';
  const planConfig = PLAN_CONFIGS[normalizedPlan] || PLAN_CONFIGS.START;

  // Se o ingresso for grátis, não há taxas
  if (basePrice <= 0) {
    return {
      ticketBasePrice: 0,
      administrativeFeePercent: 0,
      administrativeFeeAmount: 0,
      customerFinalPrice: 0,
      producerPlan: normalizedPlan,
      producerFeePercent: 0,
      producerFeeMinimum: 0,
      producerFeeAmount: 0,
      producerNetAmount: 0,
      platformAdministrativeAmount: 0,
      platformPlanAmount: 0,
      platformGrossAmount: 0,
      calculatedAt: new Date().toISOString(),
    };
  }

  // 1. Taxa Administrativa (Comprador paga a mais)
  // Calculada SEMPRE sobre o valor base do ingresso
  const administrativeFeeAmount = Number((basePrice * ADMINISTRATIVE_FEE_PERCENT).toFixed(2));
  const customerFinalPrice = Number((basePrice + administrativeFeeAmount).toFixed(2));

  // 2. Taxa do Produtor (Descontada do valor base)
  // Regra: MAX( percentualCalculado, valorMinimo )
  const percentCalculated = Number((basePrice * planConfig.percent).toFixed(2));
  let producerFeeAmount = Math.max(percentCalculated, planConfig.min);
  
  // Trava de segurança: a taxa nunca pode ser maior que o próprio ingresso
  producerFeeAmount = Math.min(producerFeeAmount, basePrice);
  
  const producerNetAmount = Number((basePrice - producerFeeAmount).toFixed(2));

  // 3. Receita da Plataforma
  const platformAdministrativeAmount = administrativeFeeAmount;
  const platformPlanAmount = producerFeeAmount;
  const platformGrossAmount = Number((platformAdministrativeAmount + platformPlanAmount).toFixed(2));

  return {
    ticketBasePrice: basePrice,
    administrativeFeePercent: ADMINISTRATIVE_FEE_PERCENT,
    administrativeFeeAmount,
    customerFinalPrice,
    producerPlan: normalizedPlan,
    producerFeePercent: planConfig.percent,
    producerFeeMinimum: planConfig.min,
    producerFeeAmount,
    producerNetAmount,
    platformAdministrativeAmount,
    platformPlanAmount,
    platformGrossAmount,
    calculatedAt: new Date().toISOString(),
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
