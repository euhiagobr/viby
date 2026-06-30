/**
 * @fileOverview Utilitários financeiros oficiais do Viby.
 * Implementa a regra única e centralizada para toda a plataforma com suporte a moedas nativas e persistência histórica.
 */

import { CurrencyCode } from "@/contexts/CurrencyContext";

export type ProductType = 'event' | 'experience';

export const VIBY_MIN_FEE_BRL = 3.99; // Fallback absoluto Eventos
export const VIBY_BUYER_MARKUP = 0.15; // Fallback 15% Eventos
export const VIBY_ORGANIZER_FEE = 0.10; // Fallback 10% Eventos

export const VIBY_EXPERIENCE_MIN_FEE_BRL = 4.99; // Fallback absoluto Experiências
export const VIBY_EXPERIENCE_BUYER_MARKUP = 0.10; // Fallback 10% Experiências
export const VIBY_EXPERIENCE_ORGANIZER_FEE = 0.15; // Fallback 15% Experiências

export const VIBY_TAX_RATE = 0.11; // 11% de imposto sobre a receita bruta da Viby

/**
 * Verifica se um período de vigência está ativo.
 * Considera timezone America/Sao_Paulo (UTC-3) para os objetos de data do Firestore.
 */
export function isTemporalActive(start: any, end: any): boolean {
  if (!start && !end) return false;
  
  const now = new Date();
  const startDate = start ? (start.toDate ? start.toDate() : new Date(start)) : null;
  const endDate = end ? (end.toDate ? end.toDate() : new Date(end)) : null;
  
  if (startDate && now < startDate) return false;
  if (endDate && now > endDate) return false;
  return true;
}

/**
 * Verifica se uma campanha promocional está vigente.
 */
function isPromoActive(active: boolean, start: any, end: any): boolean {
  if (!active) return false;
  return isTemporalActive(start, end);
}

/**
 * Converte valor para centavos (inteiro para Stripe)
 */
export function toCents(amount: number): number {
  return Math.round(Number((amount || 0).toFixed(2)) * 100);
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
 * CÁLCULO OFICIAL VIBY - Suporte Multi-Moeda e Taxas Customizadas por Organização
 * HIERARQUIA: 
 * 1. Overrides v2 (Segmentado por produto + Vigência)
 * 2. Overrides v1 (Custom fields na Org + Vigência)
 * 3. Promoções Vigentes
 * 4. Configuração Global (Firestore)
 * 5. Constantes Fallback (Code)
 */
export function calculateVibyOfficialSplit(
  facePrice: number, 
  eventCurrency: CurrencyCode = 'BRL', 
  rates?: Record<string, number>, 
  orgFees?: any,
  globalFees?: any,
  promotions?: any,
  productType: ProductType = 'event'
) {
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

  const isExp = productType === 'experience';

  // 1. RESOLUÇÃO DE MARGENS (Markup e Comissão)
  
  // Resolução de Precedência para Markup (Taxa do Comprador)
  let markup = isExp ? VIBY_EXPERIENCE_BUYER_MARKUP : VIBY_BUYER_MARKUP;
  
  // Tenta Overrides v2 (Novo Padrão)
  const v2Override = orgFees?.financialOverrides?.[productType];
  const isV2Active = isTemporalActive(v2Override?.validFrom, v2Override?.validTo);

  if (isV2Active && v2Override?.markupBuyerPercent != null) {
    markup = v2Override.markupBuyerPercent / 100;
  } 
  // Tenta Overrides v1 (Legado)
  else if (isTemporalActive(orgFees?.customFeeStartAt, orgFees?.customFeeEndAt) && orgFees?.customBuyerMarkup != null) {
    markup = orgFees.customBuyerMarkup / 100;
  }
  // Tenta Promoções
  else if (isPromoActive(promotions?.buyerPromoActive, promotions?.buyerPromoStart, promotions?.buyerPromoEnd)) {
    markup = promotions.buyerPromoPercent / 100;
  } 
  // Tenta Config Global
  else if (globalFees) {
    const globalMarkup = isExp ? globalFees.experienceBuyerMarkupPercent : globalFees.buyerMarkupPercent;
    if (globalMarkup != null) markup = globalMarkup / 100;
  }
  
  const buyerMarkupFee = Number((price * markup).toFixed(2));
  
  // Resolução de Precedência para Comissão (Taxa do Produtor)
  let commission = isExp ? VIBY_EXPERIENCE_ORGANIZER_FEE : VIBY_ORGANIZER_FEE;
  
  if (isV2Active && v2Override?.commissionPercent != null) {
    commission = v2Override.commissionPercent / 100;
  }
  else if (isTemporalActive(orgFees?.customFeeStartAt, orgFees?.customFeeEndAt) && orgFees?.customOrganizerPercent != null) {
    commission = orgFees.customOrganizerPercent / 100;
  }
  else if (isPromoActive(promotions?.organizerPromoActive, promotions?.organizerPromoStart, promotions?.organizerPromoEnd)) {
    commission = promotions.organizerPromoPercent / 100;
  } 
  else if (globalFees) {
    const globalCommission = isExp ? globalFees.experienceOrganizerBasePercent : globalFees.organizerBasePercent;
    if (globalCommission != null) commission = globalCommission / 100;
  }
    
  const organizerPercentFee = Number((price * commission).toFixed(2));
  
  // Resolução de Precedência para Taxa Mínima (BRL)
  let minFeeBRL = isExp ? VIBY_EXPERIENCE_MIN_FEE_BRL : VIBY_MIN_FEE_BRL;
  
  if (isV2Active && v2Override?.minValue != null) {
    minFeeBRL = v2Override.minValue;
  }
  else if (isTemporalActive(orgFees?.customFeeStartAt, orgFees?.customFeeEndAt) && orgFees?.customOrganizerMinFee != null) {
    minFeeBRL = orgFees.customOrganizerMinFee;
  }
  else if (isPromoActive(promotions?.organizerPromoActive, promotions?.organizerPromoStart, promotions?.organizerPromoEnd)) {
    minFeeBRL = promotions.organizerPromoMinFee;
  } 
  else if (globalFees) {
    const globalMin = isExp ? globalFees.experienceOrganizerMinFee : globalFees.organizerMinFee;
    if (globalMin != null) minFeeBRL = globalMin;
  }

  // Converte a taxa mínima de BRL para a moeda do evento
  let minFeeInEventCurrency = minFeeBRL;
  if (eventCurrency !== 'BRL' && rates) {
    const rateBrlToEvent = rates[eventCurrency] || 1;
    minFeeInEventCurrency = Number((minFeeBRL * rateBrlToEvent).toFixed(2));
  }
  
  const appliedVibyFee = Math.max(organizerPercentFee, minFeeInEventCurrency);

  let organizerNet, organizerFeeDeduction, buyerFeeTotal;

  // Proteção contra repasse negativo (Low Price Protection)
  if (price >= appliedVibyFee) {
    organizerFeeDeduction = appliedVibyFee;
    organizerNet = Number((price - appliedVibyFee).toFixed(2));
    buyerFeeTotal = buyerMarkupFee;
  } else {
    organizerFeeDeduction = 0;
    organizerNet = price; // Produtor recebe 100%
    buyerFeeTotal = Number((buyerMarkupFee + appliedVibyFee).toFixed(2));
  }

  const totalCharged = Number((price + buyerFeeTotal).toFixed(2));
  const vibyApplicationFee = Number((buyerMarkupFee + appliedVibyFee).toFixed(2));

  return {
    facePrice: price,
    buyerFee: buyerFeeTotal,
    totalCharged,
    organizerFee: organizerFeeDeduction,
    organizerNet,
    vibyApplicationFee
  };
}

/**
 * Wrapper para decomposição financeira de transação única
 */
export function calculateFinancialBreakdown(
  facePrice: number, 
  globalFees?: any, 
  promotions?: any, 
  orgSettings?: any, 
  eventCurrency: CurrencyCode = 'BRL', 
  rates?: Record<string, number>,
  productType: ProductType = 'event'
) {
  const split = calculateVibyOfficialSplit(facePrice, eventCurrency, rates, orgSettings, globalFees, promotions, productType);
  return {
    ticketBasePrice: split.facePrice,
    customerFinalPrice: split.totalCharged,
    administrativeFeeAmount: split.buyerFee,
    producerFeeAmount: split.organizerFee,
    producerNetAmount: split.organizerNet,
    totalVibyRevenue: split.vibyApplicationFee,
    productType
  };
}

/**
 * Calcula o detalhamento fiscal completo para o Ledger (Persistência em BRL)
 */
export function calculateDetailedVibyBreakdown(
  facePrice: number, 
  quantity: number = 1, 
  rates?: Record<string, number>, 
  stripeConfig?: any, 
  eventCurrency: CurrencyCode = 'BRL',
  orgSettings?: any,
  globalFees?: any,
  promotions?: any,
  productType: ProductType = 'event'
) {
  const split = calculateVibyOfficialSplit(facePrice, eventCurrency, rates, orgSettings, globalFees, promotions, productType);
  const rateToBRL = eventCurrency === 'BRL' ? 1 : (1 / (rates?.[eventCurrency] || 1));

  const imposto = Number((split.vibyApplicationFee * VIBY_TAX_RATE).toFixed(2));
  const stripeFeePercent = stripeConfig?.feePercent || 3.99;
  const stripeFeeFixed = stripeConfig?.feeFixed || 0.39;
  const stripeFeeTotal = Number(((split.totalCharged * (stripeFeePercent / 100)) + stripeFeeFixed).toFixed(2));

  const vibyNet = Number((split.vibyApplicationFee - imposto - stripeFeeTotal).toFixed(2));

  return {
    totalFace: Number((split.facePrice * quantity).toFixed(2)),
    totalCharged: Number((split.totalCharged * quantity).toFixed(2)),
    totalBuyerFee: Number((split.buyerFee * quantity).toFixed(2)),
    vibyGross: Number((split.vibyApplicationFee * quantity).toFixed(2)),
    stripeFeeTotal: Number((stripeFeeTotal * quantity).toFixed(2)),
    imposto: Number((imposto * quantity).toFixed(2)),
    vibyNet: Number((vibyNet * quantity).toFixed(2)),
    payoutToProducer: Number((split.organizerNet * quantity).toFixed(2)),
    currency: eventCurrency,
    exchangeRate: rateToBRL,
    totalChargedBRL: Number((split.totalCharged * quantity * rateToBRL).toFixed(2)),
    vibyNetBRL: Number((vibyNet * quantity * rateToBRL).toFixed(2)),
    taxAmountBRL: Number((imposto * quantity * rateToBRL).toFixed(2)),
    payoutToProducerBRL: Number((split.organizerNet * quantity * rateToBRL).toFixed(2)),
    productType
  };
}

export function calculateRefundAmount(totalPaid: number): number {
  const gatewayFee = calculateRetainedGatewayFee(totalPaid);
  return Math.max(0, totalPaid - gatewayFee);
}

export function calculateRetainedGatewayFee(totalPaid: number): number {
  return (totalPaid * 0.0499) + 1.00;
}
