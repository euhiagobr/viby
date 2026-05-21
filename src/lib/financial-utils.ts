
/**
 * @fileOverview Utilitários financeiros atualizados para o modelo de Planos Dinâmicos.
 */

export interface PlanConfig {
  percent: number;
  min: number;
  maxOrganizations: number;
  maxActiveEvents: number;
  maxTicketsPerEvent: number;
  isVerified: boolean;
  hasReports: boolean;
}

export const ADMINISTRATIVE_FEE_PERCENT = 0.15;

export function formatCurrency(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Calcula a quebra financeira com base no plano atual do usuário.
 * @param basePrice Valor de face do ingresso
 * @param planData Dados do plano (sobrescritos ou padrão) obtidos do Firestore
 */
export function calculateFinancialBreakdown(basePrice: number, planData?: any) {
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

  // Se não houver planData, usamos valores conservadores do plano Start
  const feePercent = (planData?.feePercent ?? 16) / 100;
  const minFeeAmount = planData?.minFeeAmount ?? 9.99;
  
  // 1. Taxa administrativa cobrada do COMPRADOR (15% sobre o valor do ingresso)
  const administrativeFeeAmount = Number((price * ADMINISTRATIVE_FEE_PERCENT).toFixed(2));
  
  // 2. Preço final que o cliente paga no checkout
  const customerFinalPrice = Number((price + administrativeFeeAmount).toFixed(2));

  // 3. Taxa do plano cobrada do PRODUTOR (Descontada do valor base do ingresso)
  const producerFeeCalculated = Number((price * feePercent).toFixed(2));
  const producerFeeAmount = Math.max(producerFeeCalculated, minFeeAmount);

  // 4. Valor líquido que o produtor recebe por ingresso
  const producerNetAmount = Math.max(0, Number((price - producerFeeAmount).toFixed(2)));

  return {
    ticketBasePrice: price,
    customerFinalPrice,
    administrativeFeeAmount,
    producerFeeAmount,
    producerNetAmount,
    producerFeePercent: feePercent
  };
}
