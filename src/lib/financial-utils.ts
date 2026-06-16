/**
 * @fileOverview Utilitários financeiros oficiais do Viby.
 * Implementa a regra única e centralizada para toda a plataforma com suporte a moedas nativas e persistência histórica.
 */

import { CurrencyCode } from "@/contexts/CurrencyContext";

export const VIBY_MIN_FEE_BRL = 3.99; // Taxa mínima em BRL
export const VIBY_BUYER_MARKUP = 0.15; // 15% de taxa administrativa
export const VIBY_ORGANIZER_FEE = 0.10; // 10% de comissão base
export const VIBY_TAX_RATE = 0.11; // 11% de imposto sobre a receita

/**
 * Converte valor para centavos (inteiro para Stripe)
 */
export function toCents(amount: number): number {
  return Math.round(Number((amount || 0).toFixed(2)) * 100);
}

/**
 * Formata moeda para exibição (Estático para BRL - Fallback)
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
 * @param facePrice Preço base na moeda do evento
 * @param eventCurrency Moeda do evento
 * @param rates Taxas de conversão atuais (necessário para calcular o mínimo de R$ 3,99 na moeda local)
 * @param customFees Objeto da organização contendo possíveis sobrescrições de taxas
 */
export function calculateVibyOfficialSplit(facePrice: number, eventCurrency: CurrencyCode = 'BRL', rates?: Record<string, number>, customFees?: any) {
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
  // Prioridade: Organização > Global (15%)
  const markup = customFees?.customBuyerMarkup !== undefined && customFees.customBuyerMarkup !== null 
    ? (customFees.customBuyerMarkup / 100) 
    : VIBY_BUYER_MARKUP;
    
  const buyerMarkupFee = Number((price * markup).toFixed(2));
  
  // 2. Taxa do Organizador (Comissão)
  // Prioridade: Organização > Global (10%)
  const commission = customFees?.customOrganizerPercent !== undefined && customFees.customOrganizerPercent !== null
    ? (customFees.customOrganizerPercent / 100)
    : VIBY_ORGANIZER_FEE;
    
  const organizerPercentFee = Number((price * commission).toFixed(2));
  
  // Taxa Mínima BRL
  // Prioridade: Organização > Global (R$ 3,99)
  const minFeeBRL = customFees?.customOrganizerMinFee !== undefined && customFees.customOrganizerMinFee !== null
    ? customFees.customOrganizerMinFee
    : VIBY_MIN_FEE_BRL;

  // Converte a taxa mínima de BRL para a moeda do evento
  let minFeeInEventCurrency = minFeeBRL;
  if (eventCurrency !== 'BRL' && rates) {
    const rateBrlToEvent = rates[eventCurrency] || 1;
    minFeeInEventCurrency = Number((minFeeBRL * rateBrlToEvent).toFixed(2));
  }
  
  const appliedVibyFee = Math.max(organizerPercentFee, minFeeInEventCurrency);

  let organizerNet, organizerFeeDeduction, buyerFeeTotal;

  // --- NOVA REGRA DE GARANTIA DE TAXA MÍNIMA ---
  // Se o valor do ingresso for suficiente para cobrir a taxa mínima:
  if (price >= appliedVibyFee) {
    // Fluxo Padrão: Organizador paga a taxa
    organizerFeeDeduction = appliedVibyFee;
    organizerNet = Number((price - appliedVibyFee).toFixed(2));
    buyerFeeTotal = buyerMarkupFee;
  } else {
    // Fluxo de Baixo Valor: Comprador paga a diferença (Gap)
    // Isso garante que o repasse nunca seja negativo e o Stripe não falhe
    organizerFeeDeduction = 0;
    organizerNet = price; // Organizador recebe 100% do preço de face
    // O comprador paga o markup original + a taxa integral da plataforma
    buyerFeeTotal = Number((buyerMarkupFee + appliedVibyFee).toFixed(2));
  }

  const totalCharged = Number((price + buyerFeeTotal).toFixed(2));
  const vibyApplicationFee = Number((buyerMarkupFee + appliedVibyFee).toFixed(2));

  return {
    facePrice: price,
    buyerFee: buyerFeeTotal, // Valor total somado ao preço de face para o cliente
    totalCharged,
    organizerFee: organizerFeeDeduction, // Valor efetivamente deduzido do organizador
    organizerNet,
    vibyApplicationFee // Taxa total a ser retida pela Viby via Stripe Application Fee
  };
}

export function calculateFinancialBreakdown(facePrice: number, globalFees?: any, promotions?: any, orgSettings?: any, eventCurrency: CurrencyCode = 'BRL', rates?: Record<string, number>) {
  const split = calculateVibyOfficialSplit(facePrice, eventCurrency, rates, orgSettings);
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
 * Calcula o detalhamento fiscal completo para o Ledger com suporte a cotação congelada e taxas customizadas.
 */
export function calculateDetailedVibyBreakdown(
  facePrice: number, 
  quantity: number = 1, 
  rates?: Record<string, number>, 
  stripeConfig?: any, 
  eventCurrency: CurrencyCode = 'BRL',
  orgSettings?: any
) {
  const split = calculateVibyOfficialSplit(facePrice, eventCurrency, rates, orgSettings);
  
  // Taxa de conversão congelada (1 unidade da moeda do evento = X BRL)
  const rateToBRL = eventCurrency === 'BRL' ? 1 : (1 / (rates?.[eventCurrency] || 1));

  // Imposto provisionado (11% sobre a receita bruta da Viby)
  const imposto = Number((split.vibyApplicationFee * VIBY_TAX_RATE).toFixed(2));
  
  // Custo Stripe (Estimado ou Real conforme config)
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
    // Valores convertidos e fixados em BRL para o Ledger
    totalChargedBRL: Number((split.totalCharged * quantity * rateToBRL).toFixed(2)),
    vibyNetBRL: Number((vibyNet * quantity * rateToBRL).toFixed(2)),
    taxAmountBRL: Number((imposto * quantity * rateToBRL).toFixed(2)),
    payoutToProducerBRL: Number((split.organizerNet * quantity * rateToBRL).toFixed(2))
  };
}

/**
 * Calcula o valor de estorno líquido.
 */
export function calculateRefundAmount(totalPaid: number): number {
  const gatewayFee = calculateRetainedGatewayFee(totalPaid);
  return Math.max(0, totalPaid - gatewayFee);
}

export function calculateRetainedGatewayFee(totalPaid: number): number {
  return (totalPaid * 0.0499) + 1.00;
}
