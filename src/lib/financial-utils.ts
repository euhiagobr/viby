/**
 * @fileOverview Utilitários financeiros oficiais do Viby.
 * 
 * REGRAS DE NEGÓCIO:
 * 1. Taxa Administrativa (Plataforma): 15% fixos, somados ao valor do ingresso e pagos pelo COMPRADOR.
 * 2. Custo do Plano (Organizador): Calculado sobre o valor de face do ingresso e DESCONTADO do produtor.
 * 3. Regra do Plano: O custo é o MAIOR valor entre o percentual (%) e o valor mínimo (R$) definidos no plano.
 */

export function formatCurrency(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Calcula a quebra financeira completa de uma venda.
 * @param facePrice Valor de face definido pelo produtor (ex: R$ 100,00)
 * @param planData Dados do plano do organizador (ex: { feePercent: 10, minFeeAmount: 7.49 })
 */
export function calculateFinancialBreakdown(facePrice: number, planData?: any) {
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

  // 1. Taxa Administrativa (Viby Buyer Fee) - 15% fixos ADICIONADOS ao comprador
  const admFeePercent = 0.15;
  const administrativeFeeAmount = Number((price * admFeePercent).toFixed(2));
  const customerFinalPrice = Number((price + administrativeFeeAmount).toFixed(2));

  // 2. Custo do Plano (Viby Seller Fee) - DESCONTADO do produtor
  // Regra: Maior valor entre o percentual do plano e o mínimo do plano
  const planPercent = (planData?.feePercent ?? 16) / 100;
  const minPlanFee = planData?.minFeeAmount ?? 9.99;
  
  const calculatedPlanPercentFee = Number((price * planPercent).toFixed(2));
  const producerFeeAmount = Math.max(calculatedPlanPercentFee, minPlanFee);
  
  // 3. Valor Líquido do Produtor
  // Recebe o valor de face menos o custo do seu plano
  const producerNetAmount = Number((price - producerFeeAmount).toFixed(2));

  return {
    ticketBasePrice: price, // Valor "de tabela" do ingresso
    customerFinalPrice, // Quanto sai do bolso do cliente (Price + 15%)
    administrativeFeeAmount, // Parte 1 da receita Viby (paga pelo cliente)
    producerFeeAmount, // Parte 2 da receita Viby (paga pelo produtor - custo plano)
    producerNetAmount, // Quanto o produtor de fato recebe
    totalVibyRevenue: Number((administrativeFeeAmount + producerFeeAmount).toFixed(2))
  };
}
