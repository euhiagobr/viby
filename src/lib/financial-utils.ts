/**
 * @fileOverview Utilitários financeiros oficiais do Viby.
 * Implementa aritmética de centavos para precisão monetária e regras de retenção de taxas.
 */

export const GATEWAY_FEE_PERCENT = 0.0499; // 4.99%
export const GATEWAY_FEE_FIXED = 1.00; // R$ 1,00

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
 * Calcula a taxa financeira retida (não reembolsável)
 * Regra: 4.99% do TOTAL PAGO + R$ 1.00
 */
export function calculateRetainedGatewayFee(totalPaid: number): number {
  const totalCents = toCents(totalPaid);
  const percentFee = Math.ceil(totalCents * GATEWAY_FEE_PERCENT);
  const fixedFee = toCents(GATEWAY_FEE_FIXED);
  
  return fromCents(percentFee + fixedFee);
}

/**
 * Calcula o valor a ser devolvido para a carteira
 */
export function calculateRefundAmount(totalPaid: number): number {
  const fee = calculateRetainedGatewayFee(totalPaid);
  return Math.max(0, Number((totalPaid - fee).toFixed(2)));
}

/**
 * Verifica se uma promoção está ativa
 */
function isPromoActive(active: boolean, start: string, end: string) {
  if (!active) return false;
  const now = new Date();
  if (start && !isNaN(new Date(start).getTime()) && now < new Date(start)) return false;
  if (end && !isNaN(new Date(end).getTime()) && now > new Date(end)) return false;
  return true;
}

/**
 * Calcula a quebra financeira básica para checkout
 */
export function calculateFinancialBreakdown(facePrice: number, globalFees?: any, promotions?: any, orgSettings?: any) {
  const price = parseFloat(facePrice as any) || 0;
  if (price <= 0) return { ticketBasePrice: 0, customerFinalPrice: 0, administrativeFeeAmount: 0, producerFeeAmount: 0, producerNetAmount: 0, totalVibyRevenue: 0 };
  
  let bPercentVal = globalFees?.buyerFeePercent ?? 15;
  if (promotions && isPromoActive(promotions.buyerPromoActive, promotions.buyerPromoStart, promotions.buyerPromoEnd)) {
    bPercentVal = (promotions.buyerPromoPercent !== undefined) ? promotions.buyerPromoPercent : bPercentVal;
  }
  const buyerFeePercent = bPercentVal / 100;
  const administrativeFeeAmount = Number((price * buyerFeePercent).toFixed(2));
  const customerFinalPrice = Number((price + administrativeFeeAmount).toFixed(2));
  
  let oPercentVal = globalFees?.organizerFeePercent ?? 10;
  let oMinVal = globalFees?.organizerMinFee ?? 9.99;
  let oMaxVal = globalFees?.organizerMaxFee ?? 0;

  if (orgSettings?.customFeeActive) {
    oPercentVal = (orgSettings.customFeePercent !== undefined) ? orgSettings.customFeePercent : oPercentVal;
    oMinVal = (orgSettings.customMinFee !== undefined) ? orgSettings.customMinFee : oMinVal;
    oMaxVal = (orgSettings.customMaxFee !== undefined) ? orgSettings.customMaxFee : oMaxVal;
  } else if (promotions && isPromoActive(promotions.organizerPromoActive, promotions.organizerPromoStart, promotions.organizerPromoEnd)) {
    oPercentVal = (promotions.organizerPromoPercent !== undefined) ? promotions.organizerPromoPercent : oPercentVal;
    oMinVal = (promotions.organizerPromoMinFee !== undefined) ? promotions.organizerPromoMinFee : oMinVal;
  }

  const calculatedPercentFee = Number((price * (oPercentVal / 100)).toFixed(2));
  let producerFeeAmount = Math.max(calculatedPercentFee, oMinVal);
  if (oMaxVal > 0) producerFeeAmount = Math.min(producerFeeAmount, oMaxVal);
  
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
  globalFees?: any,
  stripeSettings?: any,
  isFirstItemInOrder: boolean = true,
  promotions?: any,
  orgSettings?: any
) {
  const basic = calculateFinancialBreakdown(facePrice, globalFees, promotions, orgSettings);
  
  const totalFace = Number((basic.ticketBasePrice * quantity).toFixed(2));
  const buyerFeeTotal = Number((basic.administrativeFeeAmount * quantity).toFixed(2));
  const organizerFeeTotal = Number((basic.producerFeeAmount * quantity).toFixed(2));
  const totalCharged = Number((basic.customerFinalPrice * quantity).toFixed(2));
  
  // Taxas do Stripe (Padrão: 3.99% + 0.39 se não configurado)
  const stripePercent = (stripeSettings?.feePercent ?? 3.99) / 100;
  const stripeFixed = stripeSettings?.feeFixed ?? 0.39;
  
  const stripeFeePercentAmount = Number((totalCharged * stripePercent).toFixed(2));
  // A taxa fixa do Stripe é cobrada por transação. Se for o primeiro item, aplicamos.
  const stripeFeeFixedAmount = isFirstItemInOrder ? stripeFixed : 0;
  const stripeFeeTotal = Number((stripeFeePercentAmount + stripeFeeFixedAmount).toFixed(2));
  
  const vibyGross = Number((buyerFeeTotal + organizerFeeTotal).toFixed(2));
  const imposto = Number((vibyGross * 0.11).toFixed(2)); // Imposto fixo de 11% sobre a receita da Viby
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