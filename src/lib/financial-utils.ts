
/**
 * @fileOverview Utilitários financeiros oficiais do Viby.
 */

export function formatCurrency(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Calcula a quebra financeira completa de uma venda baseada nas configurações globais de taxas e stripe.
 */
export function calculateDetailedVibyBreakdown(facePrice: number, qty: number, globalFees: any, stripeSettings: any) {
  const impostoRate = 0.11;
  const totalFace = facePrice * qty;

  if (totalFace <= 0) {
    return {
      totalFace: 0,
      buyerFeeTotal: 0,
      organizerFeeTotal: 0,
      customerPaid: 0,
      stripeFeeAmount: 0,
      vibyGrossProfit: 0,
      taxAmount: 0,
      vibyNetProfit: 0,
      payoutToProducer: 0
    };
  }

  // 1. Taxa do Comprador (Buyer Fee)
  const bPercent = (globalFees?.buyerFeePercent ?? 15) / 100;
  const buyerFeeTotal = totalFace * bPercent;
  const customerPaid = totalFace + buyerFeeTotal;

  // 2. Taxa do Organizador (Seller Fee)
  const oPercent = (globalFees?.organizerFeePercent ?? 10) / 100;
  const oMin = (globalFees?.organizerMinFee ?? 9.99) * qty;
  const calculatedOrgFee = totalFace * oPercent;
  const organizerFeeTotal = Math.max(calculatedOrgFee, oMin);

  // 3. Taxa Stripe (Calculada sobre o total pago pelo cliente)
  const sPercent = (stripeSettings?.feePercent ?? 3.99) / 100;
  const sFixed = (stripeSettings?.feeFixed ?? 0.39) * qty;
  const stripeFeeAmount = (customerPaid * sPercent) + sFixed;

  // 4. Lucro Bruto da Viby (Taxas - Stripe)
  const vibyGrossProfit = (buyerFeeTotal + organizerFeeTotal) - stripeFeeAmount;

  // 5. Imposto (11% sobre o Lucro Bruto)
  const taxAmount = vibyGrossProfit > 0 ? vibyGrossProfit * impostoRate : 0;

  // 6. Lucro Líquido Final da Viby
  const vibyNetProfit = vibyGrossProfit - taxAmount;

  // 7. Repasse ao Produtor (Valor de Face - Taxa Organizador)
  const payoutToProducer = totalFace - organizerFeeTotal;

  return {
    totalFace: Number(totalFace.toFixed(2)),
    buyerFeeTotal: Number(buyerFeeTotal.toFixed(2)),
    organizerFeeTotal: Number(organizerFeeTotal.toFixed(2)),
    customerPaid: Number(customerPaid.toFixed(2)),
    stripeFeeAmount: Number(stripeFeeAmount.toFixed(2)),
    vibyGrossProfit: Number(vibyGrossProfit.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    vibyNetProfit: Number(vibyNetProfit.toFixed(2)),
    payoutToProducer: Number(payoutToProducer.toFixed(2))
  };
}

/**
 * Legado: Mantido para compatibilidade em componentes que ainda não foram refatorados.
 */
export function calculateFinancialBreakdown(facePrice: number, globalFees?: any) {
  const price = parseFloat(facePrice as any) || 0;
  if (price <= 0) return { ticketBasePrice: 0, customerFinalPrice: 0, administrativeFeeAmount: 0, producerFeeAmount: 0, producerNetAmount: 0, totalVibyRevenue: 0 };
  const buyerFeePercent = (globalFees?.buyerFeePercent ?? 15) / 100;
  const administrativeFeeAmount = Number((price * buyerFeePercent).toFixed(2));
  const customerFinalPrice = Number((price + administrativeFeeAmount).toFixed(2));
  const orgFeePercent = (globalFees?.organizerFeePercent ?? 10) / 100;
  const orgMinFee = globalFees?.organizerMinFee ?? 9.99;
  const calculatedPercentFee = Number((price * orgFeePercent).toFixed(2));
  const producerFeeAmount = Math.max(calculatedPercentFee, orgMinFee);
  const producerNetAmount = Number((price - producerFeeAmount).toFixed(2));
  return { ticketBasePrice: price, customerFinalPrice, administrativeFeeAmount, producerFeeAmount, producerNetAmount, totalVibyRevenue: Number((administrativeFeeAmount + producerFeeAmount).toFixed(2)) };
}
