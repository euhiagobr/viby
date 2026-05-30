/**
 * @fileOverview Utilitários financeiros oficiais do Viby.
 * Implementa a regra única: Taxa = maior entre 10% ou R$ 3,99.
 */

export const GATEWAY_FEE_PERCENT = 0.0499; // 4.99% (Custo fixo do processador)
export const GATEWAY_FEE_FIXED = 1.00; // R$ 1,00 (Custo fixo do processador)
export const VIBY_MIN_FEE = 3.99; // Taxa mínima da plataforma

/**
 * Converte valor para centavos (inteiro)
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Converte centavos para real (float)
 */
export function fromCents(cents: number): number {
  return cents / 100;
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
 * Calcula a taxa financeira retida pelo gateway (não reembolsável)
 * Regra: 4.99% do TOTAL PAGO + R$ 1.00
 */
export function calculateRetainedGatewayFee(totalPaid: number): number {
  if (totalPaid <= 0) return 0;
  const totalCents = toCents(totalPaid);
  const percentFee = Math.ceil(totalCents * GATEWAY_FEE_PERCENT);
  const fixedFee = toCents(GATEWAY_FEE_FIXED);
  
  return fromCents(percentFee + fixedFee);
}

/**
 * Calcula o valor a ser devolvido para a carteira em caso de estorno.
 * Regra: Valor Total Pago - Taxas do Gateway
 */
export function calculateRefundAmount(totalPaid: number): number {
  if (!totalPaid || totalPaid <= 0) return 0;
  const fee = calculateRetainedGatewayFee(totalPaid);
  return Number(Math.max(0, totalPaid - fee).toFixed(2));
}

/**
 * Calcula a quebra financeira do ingresso baseada na regra unificada.
 * Regra: Taxa Produtor = max(FacePrice * 10%, 3.99)
 */
export function calculateFinancialBreakdown(facePrice: number, _globalFeesUnused?: any, _promosUnused?: any, _orgUnused?: any) {
  const price = parseFloat(facePrice as any) || 0;
  
  if (price <= 0) {
    return { 
      ticketBasePrice: 0, 
      customerFinalPrice: 0, 
      administrativeFeeAmount: 0, 
      producerFeeAmount: 0, 
      producerNetAmount: 0, 
      totalVibyRevenue: 0 
    };
  }
  
  // 1. Taxa Administrativa (Markup do Comprador) - Fixa em 15% para este modelo
  const buyerFeePercent = 0.15;
  const administrativeFeeAmount = Number((price * buyerFeePercent).toFixed(2));
  const customerFinalPrice = Number((price + administrativeFeeAmount).toFixed(2));
  
  // 2. Taxa do Organizador (Dedução do Preço de Face)
  // REGRA: MAIOR ENTRE 10% OU R$ 3,99
  const percentFee = Number((price * 0.10).toFixed(2));
  const producerFeeAmount = Math.max(percentFee, VIBY_MIN_FEE);
  
  const producerNetAmount = Number((price - producerFeeAmount).toFixed(2));
  
  return { 
    ticketBasePrice: price, 
    customerFinalPrice, 
    administrativeFeeAmount, 
    producerFeeAmount, 
    producerNetAmount, 
    totalVibyRevenue: Number((administrativeFeeAmount + producerFeeAmount).toFixed(2)) 
  };
}

/**
 * Calcula a quebra financeira detalhada para fins fiscais e de ERP.
 */
export function calculateDetailedVibyBreakdown(
  facePrice: number,
  quantity: number = 1,
  _feesUnused?: any,
  stripeSettings?: any,
  isFirstItemInOrder: boolean = true,
  _promosUnused?: any,
  _orgUnused?: any
) {
  const basic = calculateFinancialBreakdown(facePrice);
  
  const totalFace = Number((basic.ticketBasePrice * quantity).toFixed(2));
  const buyerFeeTotal = Number((basic.administrativeFeeAmount * quantity).toFixed(2));
  const organizerFeeTotal = Number((basic.producerFeeAmount * quantity).toFixed(2));
  const totalCharged = Number((basic.customerFinalPrice * quantity).toFixed(2));

  if (totalFace <= 0) {
    return {
      unitPrice: 0,
      totalFace: 0,
      buyerFeeTotal: 0,
      organizerFeeTotal: 0,
      stripeFeePercentAmount: 0,
      stripeFeeFixedAmount: 0,
      stripeFeeTotal: 0,
      vibyGross: 0,
      imposto: 0,
      vibyNet: 0,
      payoutToProducer: 0,
      customerFinalPrice: 0
    };
  }
  
  const stripePercent = (stripeSettings?.feePercent ?? 3.99) / 100;
  const stripeFixed = stripeSettings?.feeFixed ?? 0.39;
  
  const stripeFeePercentAmount = Number((totalCharged * stripePercent).toFixed(2));
  const stripeFeeFixedAmount = isFirstItemInOrder ? stripeFixed : 0;
  const stripeFeeTotal = Number((stripeFeePercentAmount + stripeFeeFixedAmount).toFixed(2));
  
  const vibyGross = Number((buyerFeeTotal + organizerFeeTotal).toFixed(2));
  const imposto = Number((vibyGross * 0.11).toFixed(2)); 
  const vibyNet = Number((vibyGross - stripeFeeTotal - imposto).toFixed(2));
  
  const payoutToProducer = Number((totalFace - organizerFeeTotal).toFixed(2));

  return {
    unitPrice: basic.ticketBasePrice,
    totalFace,
    buyerFeeTotal,
    organizerFeeTotal,
    stripeFeePercentAmount,
    stripeFeeFixedAmount,
    stripeFeeTotal,
    vibyGross,
    imposto,
    vibyNet,
    payoutToProducer,
    customerFinalPrice: basic.customerFinalPrice
  };
}