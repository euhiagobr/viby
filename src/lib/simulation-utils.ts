
/**
 * @fileOverview Lógica de cálculo isolada para a Calculadora Comercial Viby.
 * NUNCA importar este arquivo no checkout real ou regras de cobrança.
 */

export interface SimulationResult {
  grossRevenue: number;
  viby: {
    orgFee: number;
    buyerFee: number;
    netOrganizer: number;
    totalFees: number;
  };
  competitor: {
    orgFee: number;
    buyerFee: number;
    netOrganizer: number;
    totalFees: number;
  };
  savings: {
    absolute: number;
    percent: number;
  };
}

export const VIBY_MARKET_AVG_ORG_FEE = 0.10; // 10% - Média do mercado para organizadores

export function calculateSimulation(
  qty: number,
  value: number,
  competitionBuyerPercent: number,
  vibyConfig: {
    orgPercent: number;
    orgMin: number;
    buyerPercent: number;
  }
): SimulationResult {
  const gross = qty * value;

  // Cálculos Competidor (Média de Mercado)
  const compOrgFee = gross * VIBY_MARKET_AVG_ORG_FEE;
  const compBuyerFee = gross * (competitionBuyerPercent / 100);
  const compNet = gross - compOrgFee;
  const compTotalFees = compOrgFee + compBuyerFee;

  // Cálculos Viby
  const unitOrgFee = Math.max(value * (vibyConfig.orgPercent / 100), vibyConfig.orgMin);
  const vibyOrgFee = qty * unitOrgFee;
  const vibyBuyerFee = gross * (vibyConfig.buyerPercent / 100);
  const vibyNet = gross - vibyOrgFee;
  const vibyTotalFees = vibyOrgFee + vibyBuyerFee;

  const absoluteSaving = vibyNet - compNet;
  const percentLessFees = compTotalFees > 0 
    ? ((compTotalFees - vibyTotalFees) / compTotalFees) * 100 
    : 0;

  return {
    grossRevenue: gross,
    viby: {
      orgFee: vibyOrgFee,
      buyerFee: vibyBuyerFee,
      netOrganizer: vibyNet,
      totalFees: vibyTotalFees
    },
    competitor: {
      orgFee: compOrgFee,
      buyerFee: compBuyerFee,
      netOrganizer: compNet,
      totalFees: compTotalFees
    },
    savings: {
      absolute: absoluteSaving,
      percent: percentLessFees
    }
  };
}
