
import { VibyFinancialSnapshot } from "./financial-utils";

/**
 * Interface para agregação de métricas ERP
 */
export interface ERPMetrics {
  grossRevenue: number;     // Faturamento bruto (Face + Buyer Fee)
  netRevenue: number;       // Faturamento líquido (Taxas Viby + Ads)
  totalStripeFees: number;  // Custos gateway
  totalTaxes: number;       // Impostos (11%)
  totalPayouts: number;     // Repassado aos produtores
  totalAdsRevenue: number;  // Ganho com Ads
  internalExpenses: number; // Custos operacionais cadastrados
  realProfit: number;       // Lucro Real (NetRevenue - Stripe - Taxes - Expenses)
  pendingPayouts: number;   // Aguardando repasse
  totalRefunds: number;     // Estornos/Cancelamentos
}

/**
 * Calcula o Lucro Real da plataforma Viby
 */
export function calculateRealProfit(metrics: ERPMetrics): number {
  // Lucro Real = (Taxas de Ingressos + Receita Ads) - (Taxas Stripe + Impostos + Despesas Internas + Estornos)
  return metrics.netRevenue - metrics.totalStripeFees - metrics.totalTaxes - metrics.internalExpenses - metrics.totalRefunds;
}

/**
 * Filtra dados por período
 */
export function filterByPeriod(data: any[], dateField: string, days: number): any[] {
  const now = new Date();
  const threshold = new Date();
  threshold.setDate(now.getDate() - days);
  
  return data.filter(item => {
    const date = item[dateField]?.toDate ? item[dateField].toDate() : new Date(item[dateField]);
    return date >= threshold;
  });
}
