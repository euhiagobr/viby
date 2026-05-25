/**
 * @fileOverview Utilitários financeiros oficiais do Viby com suporte a campanhas promocionais.
 */

export function formatCurrency(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Interface que define o snapshot financeiro de uma venda.
 */
export interface VibyFinancialSnapshot {
  unitPrice: number;
  quantity: number;
  totalFace: number;
  buyerFeeTotal: number;
  organizerFeeTotal: number;
  customerPaid: number;
  stripeFeePercentAmount: number;
  stripeFeeFixedAmount: number;
  stripeFeeTotal: number;
  vibyGross: number;
  imposto: number;
  vibyNet: number;
  payoutToProducer: number;
}

/**
 * Verifica se uma promoção está ativa baseada em switch e datas.
 * Garante tratamento robusto para datas vazias ou inválidas.
 */
function isPromoActive(active: boolean, start: string, end: string) {
  if (!active) return false;
  const now = new Date();
  
  if (start) {
    const startDate = new Date(start);
    if (!isNaN(startDate.getTime()) && now < startDate) return false;
  }
  
  if (end) {
    const endDate = new Date(end);
    if (!isNaN(endDate.getTime()) && now > endDate) return false;
  }
  
  return true;
}

/**
 * Calcula a quebra financeira completa de uma venda seguindo as regras de negócio da Viby.
 * O imposto de 11% é calculado apenas sobre o Lucro Bruto da Viby (Taxas - Stripe).
 */
export function calculateDetailedVibyBreakdown(
  facePrice: number, 
  qty: number, 
  globalFees: any, 
  stripeSettings: any,
  isFirstInCharge: boolean = true, 
  promotions: any = null
): VibyFinancialSnapshot {
  const impostoRate = 0.11;
  const totalFace = facePrice * qty;

  if (totalFace <= 0) {
    return {
      unitPrice: facePrice,
      quantity: qty,
      totalFace: 0,
      buyerFeeTotal: 0,
      organizerFeeTotal: 0,
      customerPaid: 0,
      stripeFeePercentAmount: 0,
      stripeFeeFixedAmount: 0,
      stripeFeeTotal: 0,
      vibyGross: 0,
      imposto: 0,
      vibyNet: 0,
      payoutToProducer: 0
    };
  }

  // 1. Taxa do Comprador (Buyer Fee)
  let bPercentVal = globalFees?.buyerFeePercent ?? 15;
  if (promotions && isPromoActive(promotions.buyerPromoActive, promotions.buyerPromoStart, promotions.buyerPromoEnd)) {
    bPercentVal = (promotions.buyerPromoPercent !== undefined) ? promotions.buyerPromoPercent : bPercentVal;
  }
  const bPercent = bPercentVal / 100;
  const buyerFeeTotal = totalFace * bPercent;
  const customerPaid = totalFace + buyerFeeTotal;

  // 2. Taxa do Organizador (Seller Fee)
  let oPercentVal = globalFees?.organizerFeePercent ?? 10;
  let oMinVal = globalFees?.organizerMinFee ?? 9.99;
  
  if (promotions && isPromoActive(promotions.organizerPromoActive, promotions.organizerPromoStart, promotions.organizerPromoEnd)) {
    oPercentVal = (promotions.organizerPromoPercent !== undefined) ? promotions.organizerPromoPercent : oPercentVal;
    oMinVal = (promotions.organizerPromoMinFee !== undefined) ? promotions.organizerPromoMinFee : oMinVal;
  }

  const oPercent = oPercentVal / 100;
  const oMin = oMinVal * qty;
  const calculatedOrgFee = totalFace * oPercent;
  const organizerFeeTotal = Math.max(calculatedOrgFee, oMin);

  // 3. Taxa Stripe (Calculada sobre o total pago pelo cliente)
  const sPercent = (stripeSettings?.feePercent ?? 3.99) / 100;
  const sFixed = isFirstInCharge ? (stripeSettings?.feeFixed ?? 0.39) : 0; 
  
  const stripeFeePercentAmount = customerPaid * sPercent;
  const stripeFeeFixedAmount = sFixed;
  const stripeFeeTotal = stripeFeePercentAmount + stripeFeeFixedAmount;

  // 4. Lucro Bruto da Viby (Taxas - Stripe)
  const vibyGross = (buyerFeeTotal + organizerFeeTotal) - stripeFeeTotal;

  // 5. Imposto (11% sobre o Lucro Bruto da Viby apenas)
  const imposto = vibyGross > 0 ? vibyGross * impostoRate : 0;

  // 6. Lucro Líquido Final da Viby
  const vibyNet = vibyGross - imposto;

  // 7. Repasse ao Produtor (Valor de Face - Taxa Organizador)
  const payoutToProducer = totalFace - organizerFeeTotal;

  return {
    unitPrice: Number(facePrice.toFixed(2)),
    quantity: qty,
    totalFace: Number(totalFace.toFixed(2)),
    buyerFeeTotal: Number(buyerFeeTotal.toFixed(2)),
    organizerFeeTotal: Number(organizerFeeTotal.toFixed(2)),
    customerPaid: Number(customerPaid.toFixed(2)),
    stripeFeePercentAmount: Number(stripeFeePercentAmount.toFixed(2)),
    stripeFeeFixedAmount: Number(stripeFeeFixedAmount.toFixed(2)),
    stripeFeeTotal: Number(stripeFeeTotal.toFixed(2)),
    vibyGross: Number(vibyGross.toFixed(2)),
    imposto: Number(imposto.toFixed(2)),
    vibyNet: Number(vibyNet.toFixed(2)),
    payoutToProducer: Number(payoutToProducer.toFixed(2))
  };
}

/**
 * Calcula a quebra financeira básica considerando promoções.
 */
export function calculateFinancialBreakdown(facePrice: number, globalFees?: any, promotions?: any) {
  const price = parseFloat(facePrice as any) || 0;
  if (price <= 0) return { ticketBasePrice: 0, customerFinalPrice: 0, administrativeFeeAmount: 0, producerFeeAmount: 0, producerNetAmount: 0, totalVibyRevenue: 0 };
  
  // Taxa Comprador
  let bPercentVal = globalFees?.buyerFeePercent ?? 15;
  if (promotions && isPromoActive(promotions.buyerPromoActive, promotions.buyerPromoStart, promotions.buyerPromoEnd)) {
    bPercentVal = (promotions.buyerPromoPercent !== undefined) ? promotions.buyerPromoPercent : bPercentVal;
  }
  const buyerFeePercent = bPercentVal / 100;
  const administrativeFeeAmount = Number((price * buyerFeePercent).toFixed(2));
  const customerFinalPrice = Number((price + administrativeFeeAmount).toFixed(2));
  
  // Taxa Organizador
  let oPercentVal = globalFees?.organizerFeePercent ?? 10;
  let oMinVal = globalFees?.organizerMinFee ?? 9.99;
  
  if (promotions && isPromoActive(promotions.organizerPromoActive, promotions.organizerPromoStart, promotions.organizerPromoEnd)) {
    oPercentVal = (promotions.organizerPromoPercent !== undefined) ? promotions.organizerPromoPercent : oPercentVal;
    oMinVal = (promotions.organizerPromoMinFee !== undefined) ? promotions.organizerPromoMinFee : oMinVal;
  }

  const orgFeePercent = oPercentVal / 100;
  const orgMinFee = oMinVal;
  const calculatedPercentFee = Number((price * orgFeePercent).toFixed(2));
  const producerFeeAmount = Math.max(calculatedPercentFee, orgMinFee);
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
