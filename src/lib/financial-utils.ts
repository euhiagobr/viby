/**
 * @fileOverview Utilitários financeiros oficiais do Viby.
 * 
 * REGRAS DE NEGÓCIO:
 * 1. Taxa Administrativa (Plataforma): Definida globalmente, somada ao valor do ingresso e paga pelo COMPRADOR.
 * 2. Taxa do Organizador (Plataforma): Definida globalmente, calculada sobre o valor de face do ingresso e DESCONTADA do produtor.
 * 3. Regra do Organizador: O custo é o MAIOR valor entre o percentual (%) e o valor mínimo (R$) definidos globalmente.
 */

export function formatCurrency(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Calcula a quebra financeira completa de uma venda baseada nas configurações globais de taxas.
 * @param facePrice Valor de face definido pelo produtor (ex: R$ 100,00)
 * @param globalFees Configurações de taxas (ex: { buyerFeePercent: 15, organizerFeePercent: 10, organizerMinFee: 9.99 })
 */
export function calculateFinancialBreakdown(facePrice: number, globalFees?: any) {
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

  // 1. Taxa Administrativa (Viby Buyer Fee) - Paga pelo CLIENTE
  const buyerFeePercent = (globalFees?.buyerFeePercent ?? 15) / 100;
  const administrativeFeeAmount = Number((price * buyerFeePercent).toFixed(2));
  const customerFinalPrice = Number((price + administrativeFeeAmount).toFixed(2));

  // 2. Taxa do Organizador (Viby Seller Fee) - DESCONTADA do produtor
  // Regra: Maior valor entre o percentual e o mínimo
  const orgFeePercent = (globalFees?.organizerFeePercent ?? 10) / 100;
  const orgMinFee = globalFees?.organizerMinFee ?? 9.99;
  
  const calculatedPercentFee = Number((price * orgFeePercent).toFixed(2));
  const producerFeeAmount = Math.max(calculatedPercentFee, orgMinFee);
  
  // 3. Valor Líquido do Produtor
  // Recebe o valor de face menos o custo da plataforma
  const producerNetAmount = Number((price - producerFeeAmount).toFixed(2));

  return {
    ticketBasePrice: price, // Valor "de tabela" do ingresso
    customerFinalPrice, // Quanto sai do bolso do cliente (Price + 15%)
    administrativeFeeAmount, // Parte 1 da receita Viby (paga pelo cliente)
    producerFeeAmount, // Parte 2 da receita Viby (paga pelo produtor)
    producerNetAmount, // Quanto o produtor de fato recebe
    totalVibyRevenue: Number((administrativeFeeAmount + producerFeeAmount).toFixed(2))
  };
}
