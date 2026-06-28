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
  // Status 'Excluído', 'Oculto' ou 'draft' não aparecem no feed principal.
  if (event.status !== 'Ativo') return false;
  
  const now = nowOverride ? nowOverride.getTime() : new Date().getTime();

  // Captura a data de início (suporta aliases comuns no banco)
  const startDate = safeParseDate(event.date || event.startDate || event.eventDate);
  if (!startDate) return false; 

  const startMs = startDate.getTime();
  const endDate = safeParseDate(event.endDate);
  
  // RESOLUÇÃO DE FIM: Prioriza endDate para calcular o encerramento. 
  // Se não existir, utiliza a data de início como referência base de término.
  // IMPORTANTE: Nunca utiliza recurringEndDate para visibilidade do card individual.
  let endMs = endDate ? endDate.getTime() : startMs;
  
  // Tratamento de virada de noite (ex: Início 22h, Fim 04h do dia seguinte)
  // Se o fim for numericamente anterior ao início mas no mesmo dia informado, assumimos que pertence ao dia seguinte.
  if (endDate && endMs < startMs) {
    endMs += 24 * 60 * 60 * 1000;
  }

  // Janela de visibilidade: Horário de Término + 6 horas de tolerância (buffer de pós-evento)
  // Se o evento não tem fim definido, ele sairá do feed 6 horas após o seu horário de início.
  const visibilityThreshold = endMs + (6 * 60 * 60 * 1000);
  
  return now < visibilityThreshold;
}
