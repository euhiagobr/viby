/**
 * @fileOverview Utilitários financeiros atualizados para o modelo de Planos Dinâmicos.
 * Regra: A taxa é o maior valor entre o percentual do plano e o valor mínimo do plano.
 * No novo modelo (Adição), o comprador paga (Ingresso + Taxa) e o produtor recebe (Ingresso).
 */

export function formatCurrency(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Calcula a quebra financeira com base no plano atual do organizador.
 * @param basePrice Valor de face do ingresso (definido pelo produtor)
 * @param planData Dados do plano obtidos do Firestore (padrão ou override)
 */
export function calculateFinancialBreakdown(basePrice: number, planData?: any) {
  const price = parseFloat(basePrice as any) || 0;
  
  if (price <= 0) {
    return { 
      ticketBasePrice: 0,
      customerFinalPrice: 0, 
      administrativeFeeAmount: 0,
      producerNetAmount: 0,
      feePercentApplied: 0
    };
  }

  // Se não houver planData, usamos valores seguros do plano Start (16% ou R$ 9,99)
  // REGRA: Taxa é o MAIOR valor entre o percentual e o mínimo
  const feePercent = (planData?.feePercent ?? 16) / 100;
  const minFeeAmount = planData?.minFeeAmount ?? 9.99;
  
  const calculatedPercentFee = Number((price * feePercent).toFixed(2));
  const serviceFee = Math.max(calculatedPercentFee, minFeeAmount);
  
  // No modelo de ADIÇÃO:
  // Preço que o cliente paga = Preço do Produtor + Taxa da Plataforma
  const customerFinalPrice = Number((price + serviceFee).toFixed(2));

  // O produtor recebe o valor que ele definiu (Face Value)
  const producerNetAmount = price;

  return {
    ticketBasePrice: price, // O valor "limpo" do ingresso
    customerFinalPrice, // O valor total com taxa
    administrativeFeeAmount: serviceFee, // A parte da Viby
    producerNetAmount, // O que vai para o bolso do produtor
    feePercentApplied: feePercent,
    minFeeApplied: minFeeAmount
  };
}
