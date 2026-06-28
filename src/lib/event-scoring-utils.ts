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
 * EXPIRE IMEDIATO: O evento some no exato momento em que termina.
 */
export function isEventVisible(event: any, nowOverride?: Date | null): boolean {
  if (!event) return false;
  
  // REGRA DE OURO: Apenas eventos Ativos entram nas vitrines.
  if (event.status !== 'Ativo') return false;
  
  const now = nowOverride ? nowOverride.getTime() : new Date().getTime();

  // Captura a data de início
  const startDate = safeParseDate(event.date || event.startDate || event.eventDate);
  if (!startDate) return false; 

  const startMs = startDate.getTime();
  const endDate = safeParseDate(event.endDate);
  
  // RESOLUÇÃO DE FIM: Prioriza endDate. Se não existir, utiliza o startDate.
  let endMs = endDate ? endDate.getTime() : startMs;
  
  // Tratamento de virada de noite (ex: Início 22h, Fim 04h do dia seguinte)
  if (endDate && endMs < startMs) {
    // Se o fim é numericamente menor que o início (ex: 04:00 < 22:00), assumimos dia seguinte
    endMs += 24 * 60 * 60 * 1000;
  }

  // Visibilidade estrita: some assim que termina.
  return now < endMs;
}
