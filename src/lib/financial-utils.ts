/**
 * @fileOverview Utilitários financeiros oficiais do Viby.
 * Implementa a regra única e centralizada para toda a plataforma com suporte a moedas nativas e persistência histórica.
 */

import { CurrencyCode } from "@/contexts/CurrencyContext";
import CryptoJS from 'crypto-js';

export type ProductType = 'event' | 'experience';

export const VIBY_MIN_FEE_BRL = 3.99;
export const VIBY_BUYER_MARKUP = 0.15;
export const VIBY_ORGANIZER_FEE = 0.10;

export const VIBY_EXPERIENCE_MIN_FEE_BRL = 4.99;
export const VIBY_EXPERIENCE_BUYER_MARKUP = 0.10;
export const VIBY_EXPERIENCE_ORGANIZER_FEE = 0.15;

export const VIBY_TAX_RATE = 0.11;

export function isTemporalActive(start: any, end: any): boolean {
  if (!start && !end) return true;
  const now = new Date();
  const startDate = start ? (start.toDate ? start.toDate() : new Date(start)) : null;
  const endDate = end ? (end.toDate ? end.toDate() : new Date(end)) : null;
  if (startDate && now < startDate) return false;
  if (endDate && now > endDate) return false;
  return true;
}

function isPromoActive(active: boolean, start: any, end: any): boolean {
  if (!active) return false;
  return isTemporalActive(start, end);
}

export function toCents(amount: number): number {
  return Math.round(Number((amount || 0).toFixed(2)) * 100);
}

export function formatCurrency(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export interface PricingSnapshot {
  facePrice: number;
  buyerFee: number;
  totalCharged: number;
  organizerFee: number;
  organizerNet: number;
  vibyApplicationFee: number;
  productType: ProductType;
  checksum: string;
}

export function generateSnapshotChecksum(data: any): string {
  const payload = `${data.facePrice}-${data.totalCharged}-${data.organizerNet}-${data.vibyApplicationFee}-${data.productType}`;
  return CryptoJS.SHA256(payload).toString();
}

export function calculateVibyOfficialSplit(
  facePrice: number, 
  eventCurrency: CurrencyCode, 
  rates: Record<string, number>, 
  orgFees: any,
  globalFees: any,
  promotions: any,
  productType: ProductType
): PricingSnapshot {
  if (!productType || !['event', 'experience'].includes(productType)) {
    throw new Error("FATAL_ERROR: Invalid or unresolved product_type.");
  }

  const price = Math.max(0, Number(facePrice) || 0);
  const isExp = productType === 'experience';

  let markup = isExp ? VIBY_EXPERIENCE_BUYER_MARKUP : VIBY_BUYER_MARKUP;
  const v2Override = orgFees?.financialOverrides?.[productType];
  const isV2Active = isTemporalActive(v2Override?.validFrom, v2Override?.validTo);

  if (isV2Active && v2Override?.markupBuyerPercent != null) {
    markup = v2Override.markupBuyerPercent / 100;
  } else if (isTemporalActive(orgFees?.customFeeStartAt, orgFees?.customFeeEndAt) && orgFees?.customBuyerMarkup != null) {
    markup = orgFees.customBuyerMarkup / 100;
  } else if (isPromoActive(promotions?.buyerPromoActive, promotions?.buyerPromoStart, promotions?.buyerPromoEnd)) {
    markup = promotions.buyerPromoPercent / 100;
  } else if (globalFees) {
    const globalMarkup = isExp ? globalFees.experienceBuyerMarkupPercent : globalFees.buyerMarkupPercent;
    if (globalMarkup != null) markup = globalMarkup / 100;
  }
  
  const buyerMarkupFee = Number((price * markup).toFixed(2));
  let commission = isExp ? VIBY_EXPERIENCE_ORGANIZER_FEE : VIBY_ORGANIZER_FEE;
  
  if (isV2Active && v2Override?.commissionPercent != null) {
    commission = v2Override.commissionPercent / 100;
  } else if (isTemporalActive(orgFees?.customFeeStartAt, orgFees?.customFeeEndAt) && orgFees?.customOrganizerPercent != null) {
    commission = orgFees.customOrganizerPercent / 100;
  } else if (isPromoActive(promotions?.organizerPromoActive, promotions?.organizerPromoStart, promotions?.organizerPromoEnd)) {
    commission = promotions.organizerPromoPercent / 100;
  } else if (globalFees) {
    const globalCommission = isExp ? globalFees.experienceOrganizerBasePercent : globalFees.organizerBasePercent;
    if (globalCommission != null) commission = globalCommission / 100;
  }
    
  const organizerPercentFee = Number((price * commission).toFixed(2));
  let minFeeBRL = isExp ? VIBY_EXPERIENCE_MIN_FEE_BRL : VIBY_MIN_FEE_BRL;
  
  if (isV2Active && v2Override?.minValue != null) {
    minFeeBRL = v2Override.minValue;
  } else if (isTemporalActive(orgFees?.customFeeStartAt, orgFees?.customFeeEndAt) && orgFees?.customOrganizerMinFee != null) {
    minFeeBRL = orgFees.customOrganizerMinFee;
  } else if (isPromoActive(promotions?.organizerPromoActive, promotions?.organizerPromoStart, promotions?.organizerPromoEnd)) {
    minFeeBRL = promotions.organizerPromoMinFee;
  } else if (globalFees) {
    const globalMin = isExp ? globalFees.experienceOrganizerMinFee : globalFees.organizerMinFee;
    if (globalMin != null) minFeeBRL = globalMin;
  }

  let minFeeInEventCurrency = minFeeBRL;
  if (eventCurrency !== 'BRL' && rates) {
    const rateBrlToEvent = rates[eventCurrency] || 1;
    minFeeInEventCurrency = Number((minFeeBRL * rateBrlToEvent).toFixed(2));
  }
  
  const appliedVibyCommission = Math.max(organizerPercentFee, minFeeInEventCurrency);
  let organizerNet, organizerFeeDeduction, buyerFeeTotal;

  if (price >= appliedVibyCommission) {
    organizerFeeDeduction = appliedVibyCommission;
    organizerNet = Number((price - appliedVibyCommission).toFixed(2));
    buyerFeeTotal = buyerMarkupFee;
  } else {
    organizerFeeDeduction = 0;
    organizerNet = price; 
    buyerFeeTotal = Number((buyerMarkupFee + appliedVibyCommission).toFixed(2));
  }

  const totalCharged = Number((price + buyerFeeTotal).toFixed(2));
  const vibyApplicationFee = Number((buyerFeeTotal + organizerFeeDeduction).toFixed(2));

  const snapshot: Omit<PricingSnapshot, 'checksum'> = {
    facePrice: price,
    buyerFee: buyerFeeTotal,
    totalCharged,
    organizerFee: organizerFeeDeduction,
    organizerNet,
    vibyApplicationFee,
    productType
  };

  return {
    ...snapshot,
    checksum: generateSnapshotChecksum(snapshot)
  };
}

export function calculateFinancialBreakdown(
  facePrice: number, 
  globalFees: any, 
  promotions: any, 
  orgSettings: any, 
  eventCurrency: CurrencyCode, 
  rates: Record<string, number>,
  productType: ProductType
) {
  const split = calculateVibyOfficialSplit(facePrice, eventCurrency, rates, orgSettings, globalFees, promotions, productType);
  return {
    ticketBasePrice: split.facePrice,
    customerFinalPrice: split.totalCharged,
    administrativeFeeAmount: split.buyerFee,
    producerFeeAmount: split.organizerFee,
    producerNetAmount: split.organizerNet,
    totalVibyRevenue: split.vibyApplicationFee,
    productType,
    checksum: split.checksum
  };
}

export function calculateDetailedVibyBreakdown(
  facePrice: number, 
  quantity: number = 1, 
  rates: Record<string, number>, 
  stripeConfig: any, 
  eventCurrency: CurrencyCode,
  orgSettings: any,
  globalFees: any,
  promotions: any,
  productType: ProductType
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
    productType,
    checksum: split.checksum
  };
}

export function calculateRefundAmount(totalPaid: number): number {
  const gatewayFee = calculateRetainedGatewayFee(totalPaid);
  return Math.max(0, totalPaid - gatewayFee);
}

export function calculateRetainedGatewayFee(totalPaid: number): number {
  return (totalPaid * 0.0499) + 1.00;
}
