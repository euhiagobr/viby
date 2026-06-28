/**
 * @fileOverview Lógica de filtragem e normalização de eventos Viby.
 * Foco em: "Perto de você" (Filtro) e "No tempo certo" (Ordenação).
 */

import { calculateDistance, type Coordinates } from "./location-utils";
import { safeParseDate } from "./utils";

/**
 * Calcula a distância exata em metros entre dois pontos.
 */
export function calculateDistanceMeters(coords1: Coordinates, coords2: Coordinates): number {
  if (!coords1 || !coords2) return Infinity;
  const km = calculateDistance(coords1, coords2);
  return Math.round(km * 1000);
}

/**
 * Define se um evento deve ser exibido nas vitrines públicas.
 * REGRA ABSOLUTA: Apenas status "Ativo" é visível.
 * QUALQUER EVENTO EM MODO 'DRAFT' OU DIFERENTE DE 'ATIVO' SERÁ OCULTADO.
 */
export function isEventVisible(event: any, nowOverride?: Date | null): boolean {
  if (!event) return false;
  
  // REGRA DE OURO: Apenas eventos Ativos entram nas vitrines.
  // Status 'Excluído' ou 'draft' não aparecem.
  if (event.status !== 'Ativo') return false;
  
  const now = nowOverride ? nowOverride.getTime() : new Date().getTime();
  
  let endMs: number;

  // CORREÇÃO: Removemos a dependência do recurringEndDate para visibilidade do card.
  // Agora a validade é baseada exclusivamente na data da ocorrência (date/endDate).
  // O pipeline de hooks (useRecurringEvents) já injeta a data da próxima sessão nestes campos.
  const startDate = safeParseDate(event.date);
  if (!startDate) return true; 

  const startMs = startDate.getTime();
  const endDate = safeParseDate(event.endDate);
  
  // Se não houver data de fim, usamos um padrão de 6h após o início para manter visível no dia
  endMs = endDate ? endDate.getTime() : (startMs + 6 * 60 * 60 * 1000);
  
  // Tratamento de virada de noite (ex: 22h às 04h)
  if (endDate && endMs <= startMs) {
    if (startDate.toDateString() === endDate.toDateString()) {
      endMs += 24 * 60 * 60 * 1000;
    }
  }

  // Tolerância de 6 horas para eventos "Acontecendo Agora" ou recém-finalizados
  const visibilityThreshold = new Date(endMs + 6 * 60 * 60 * 1000).getTime();
  
  return now < visibilityThreshold;
}
