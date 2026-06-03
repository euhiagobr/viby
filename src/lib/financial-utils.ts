/**
 * @fileOverview Utilitários financeiros oficiais do Viby.
 * Implementa a regra única e centralizada para toda a plataforma.
 */

export const VIBY_MIN_FEE = 3.99; // Taxa mínima da plataforma (paga pelo organizador)
export const VIBY_BUYER_MARKUP = 0.15; // 15% de taxa administrativa (paga pelo comprador)
export const VIBY_ORGANIZER_FEE = 0.10; // 10% de comissão base (paga pelo organizador)

/**
 * Converte valor para centavos (inteiro para Stripe)
 */
export function toCents(amount: number): number {
  return Math.round(Number(amount.toFixed(2)) * 100);
}

/**
 * Formata moeda para exibição
 */
export function formatCurrency(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * CÁLCULO OFICIAL VIBY - Única fonte de verdade.
 * @param facePrice Preço base (Pode ser o preço original ou já com desconto unitário)
 */
export function calculateVibyOfficialSplit(facePrice: number) {
  const price = Math.max(0, Number(facePrice) || 0);
  
  if (price === 0) {
    return {
      facePrice: 0,
      buyerFee: 0,
      totalCharged: 0,
      organizerFee: 0,
      organizerNet: 0,
      vibyApplicationFee: 0
    };
  }

  // 1. Taxa do Comprador (15% sobre o valor de face ajustado)
  const buyerFee = Number((price * VIBY_BUYER_MARKUP).toFixed(2));
  
  // 2. Taxa do Organizador (Maior entre 10% ou R$ 3,99)
  const organizerPercentFee = Number((price * VIBY_ORGANIZER_FEE).toFixed(2));
  const organizerFee = Math.max(organizerPercentFee, VIBY_MIN_FEE);

  // 3. Totais Unitários
  const totalCharged = Number((price + buyerFee).toFixed(2));
  const organizerNet = Number((price - organizerFee).toFixed(2));
  const vibyApplicationFee = Number((buyerFee + organizerFee).toFixed(2));

  return {
    facePrice: price,
    buyerFee,
    totalCharged,
    organizerFee,
    organizerNet,
    vibyApplicationFee // Este é o application_fee_amount do Stripe
  };
}

/**
 * Alias para compatibilidade legada enquanto migramos componentes
 */
export function calculateFinancialBreakdown(facePrice: number) {
  const split = calculateVibyOfficialSplit(facePrice);
  return {
    ticketBasePrice: split.facePrice,
    customerFinalPrice: split.totalCharged,
    administrativeFeeAmount: split.buyerFee,
    producerFeeAmount: split.organizerFee,
    producerNetAmount: split.organizerNet,
    totalVibyRevenue: split.vibyApplicationFee
  };
}

/**
 * Calcula o valor a ser devolvido para a carteira em caso de estorno manual (sem Stripe).
 */
export function calculateRefundAmount(totalPaid: number): number {
  if (!totalPaid || totalPaid <= 0) return 0;
  const estimativaTaxaGateway = Number(((totalPaid * 0.0499) + 1.00).toFixed(2));
  return Number(Math.max(0, totalPaid - estimativaTaxaGateway).toFixed(2));
}

/**
 * Calcula a taxa de gateway retida que não será devolvida no estorno.
 */
export function calculateRetainedGatewayFee(totalPaid: number): number {
  return Number(((totalPaid * 0.0499) + 1.00).toFixed(2));
}
