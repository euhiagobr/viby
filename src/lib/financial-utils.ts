
/**
 * @fileOverview Utilitários financeiros oficiais do Viby.
 * Implementa a regra única e centralizada para toda a plataforma.
 */

export const VIBY_MIN_FEE = 3.99; // Taxa mínima da plataforma (paga pelo organizador)
export const VIBY_BUYER_MARKUP = 0.15; // 15% de taxa administrativa (paga pelo comprador)
export const VIBY_ORGANIZER_FEE = 0.10; // 10% de comissão base (paga pelo organizador)
export const VIBY_TAX_RATE = 0.11; // 11% de imposto sobre a receita da plataforma (lucro bruto)

/**
 * Converte valor para centavos (inteiro para Stripe)
 */
export function toCents(amount: number): number {
  return Math.round(Number((amount || 0).toFixed(2)) * 100);
}

/**
 * Formata moeda para exibição (Estático para BRL)
 */
export function formatCurrency(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata moeda para exibição dinâmica (Geral)
 * @param value Valor numérico
 * @param currency Código da moeda (BRL, USD, EUR)
 */
export function formatCurrencyDynamic(value: number, currency: string = 'BRL'): string {
  if (isNaN(value) || value === null || value === undefined) return 'R$ 0,00';
  
  const locales: Record<string, string> = {
    BRL: 'pt-BR',
    USD: 'en-US',
    EUR: 'de-DE'
  };

  return new Intl.NumberFormat(locales[currency] || 'pt-BR', {
    style: 'currency',
    currency: currency,
  }).format(value);
}

/**
 * CÁLCULO OFICIAL VIBY - Única fonte de verdade para ingressos.
 * @param facePrice Preço base definido pelo produtor (Sempre em BRL)
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

  // 1. Taxa do Comprador (15% sobre o valor de face)
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
    vibyApplicationFee // Lucro Bruto Viby por ingresso
  };
}

/**
 * Calcula o detalhamento profundo para fins de ERP e Fiscal
 */
export function calculateDetailedVibyBreakdown(facePrice: number, quantity: number = 1, coupon: any = null, stripeConfig: any = null) {
  const base = calculateVibyOfficialSplit(facePrice);
  const qty = Math.max(1, quantity);
  
  const stripePercent = stripeConfig?.feePercent || 3.99;
  const stripeFixed = stripeConfig?.feeFixed || 0.39;

  // Totais Brutos
  const totalFace = base.facePrice * qty;
  const totalBuyerFee = base.buyerFee * qty;
  const totalCharged = base.totalCharged * qty;
  const vibyGross = base.vibyApplicationFee * qty;

  // Custos Gateway (Estimativa para o ERP)
  const stripeFeeTotal = Number(((totalCharged * (stripePercent / 100)) + stripeFixed).toFixed(2));

  // Impostos (11% sobre o Lucro Bruto da Viby)
  const imposto = Number((vibyGross * VIBY_TAX_RATE).toFixed(2));

  // Lucro Líquido Real (DRE)
  const vibyNet = Number((vibyGross - stripeFeeTotal - imposto).toFixed(2));

  return {
    totalFace,
    totalBuyerFee,
    totalCharged,
    vibyGross,
    stripeFeeTotal,
    imposto,
    vibyNet,
    payoutToProducer: base.organizerNet * qty
  };
}

/**
 * Alias para compatibilidade legada
 */
export function calculateFinancialBreakdown(facePrice: number, globalFees?: any, promotions?: any, orgSettings?: any) {
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
  if (!totalPaid || totalPaid <= 0) return 0;
  return Number(((totalPaid * 0.0499) + 1.00).toFixed(2));
}
