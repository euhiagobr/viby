/**
 * @fileOverview Utilitários financeiros oficiais do Viby.
 * Implementa a regra única e centralizada para toda a plataforma com suporte a moedas nativas e persistência histórica.
 */

import { CurrencyCode } from "@/contexts/CurrencyContext";

export const VIBY_MIN_FEE_BRL = 3.99; // Fallback absoluto
export const VIBY_BUYER_MARKUP = 0.15; // Fallback 15%
export const VIBY_ORGANIZER_FEE = 0.10; // Fallback 10%
export const VIBY_TAX_RATE = 0.11; // 11% de imposto sobre a receita bruta da Viby

/**
 * Verifica se uma campanha promocional está vigente.
 */
function isPromoActive(active: boolean, start: any, end: any): boolean {
  if (!active) return false;
  const now = new Date();
  const startDate = start ? (start.toDate ? start.toDate() : new Date(start)) : null;
  const endDate = end ? (end.toDate ? end.toDate() : new Date(end)) : null;
  
  if (startDate && now < startDate) return false;
  if (endDate && now > endDate) return false;
  return true;
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
 * HIERARQUIA: Organização > Promoção > Config Global > Constantes
 */
export function calculateVibyOfficialSplit(
  facePrice: number, 
  eventCurrency: CurrencyCode = 'BRL', 
  rates?: Record<string, number>, 
  orgFees?: any,
  globalFees?: any,
  promotions?: any
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

  // 1. Taxa do Comprador (Markup)
  let markup = VIBY_BUYER_MARKUP;
  if (orgFees?.customBuyerMarkup !== undefined && orgFees.customBuyerMarkup !== null) {
    markup = orgFees.customBuyerMarkup / 100;
  } else if (isPromoActive(promotions?.buyerPromoActive, promotions?.buyerPromoStart, promotions?.buyerPromoEnd)) {
    markup = promotions.buyerPromoPercent / 100;
  } else if (globalFees?.buyerMarkupPercent !== undefined) {
    markup = globalFees.buyerMarkupPercent / 100;
  }
  
  const buyerMarkupFee = Number((price * markup).toFixed(2));
  
  // 2. Taxa do Organizador (Comissão)
  let commission = VIBY_ORGANIZER_FEE;
  if (orgFees?.customOrganizerPercent !== undefined && orgFees.customOrganizerPercent !== null) {
    commission = orgFees.customOrganizerPercent / 100;
  } else if (isPromoActive(promotions?.organizerPromoActive, promotions?.organizerPromoStart, promotions?.organizerPromoEnd)) {
    commission = promotions.organizerPromoPercent / 100;
  } else if (globalFees?.organizerBasePercent !== undefined) {
    commission = globalFees.organizerBasePercent / 100;
  }
    
  const organizerPercentFee = Number((price * commission).toFixed(2));
  
  // 3. Taxa Mínima (BRL)
  let minFeeBRL = VIBY_MIN_FEE_BRL;
  if (orgFees?.customOrganizerMinFee !== undefined && orgFees.customOrganizerMinFee !== null) {
    minFeeBRL = orgFees.customOrganizerMinFee;
  } else if (isPromoActive(promotions?.organizerPromoActive, promotions?.organizerPromoStart, promotions?.organizerPromoEnd)) {
    minFeeBRL = promotions.organizerPromoMinFee;
  } else if (globalFees?.organizerMinFee !== undefined) {
    minFeeBRL = globalFees.organizerMinFee;
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
  rates?: Record<string, number>
) {
  const split = calculateVibyOfficialSplit(facePrice, eventCurrency, rates, orgSettings, globalFees, promotions);
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
  promotions?: any
) {
  const split = calculateVibyOfficialSplit(facePrice, eventCurrency, rates, orgSettings, globalFees, promotions);
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
    payoutToProducerBRL: Number((split.organizerNet * quantity * rateToBRL).toFixed(2))
  };
}

export function calculateRefundAmount(totalPaid: number): number {
  const gatewayFee = calculateRetainedGatewayFee(totalPaid);
  return Math.max(0, totalPaid - gatewayFee);
}

export function calculateRetainedGatewayFee(totalPaid: number): number {
  return (totalPaid * 0.0499) + 1.00;
}
