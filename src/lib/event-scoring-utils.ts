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

  // Captura a data de início com hora se disponível
  const dateWithTime = event.startTime
    ? `${event.date || event.startDate || event.eventDate}T${event.startTime}:00`
    : (event.date || event.startDate || event.eventDate);
  const startDate = safeParseDate(dateWithTime);
  if (!startDate) return false; 

  const startMs = startDate.getTime();
  
  // Captura a data de fim com hora se disponível
  let endMs: number;
  if (event.endDate) {
    const endWithTime = event.endTime
      ? `${event.endDate}T${event.endTime}:00`
      : event.endDate;
    const endDate = safeParseDate(endWithTime);
    endMs = endDate ? endDate.getTime() : startMs;
  } else {
    // Se não houver endDate, fim padrão é 4h após o início
    endMs = startMs + (4 * 60 * 60 * 1000);
  }
  
  // Tratamento de virada de noite (ex: Início 22h, Fim 04h do dia seguinte)
  if (event.endDate && endMs < startMs) {
    // Se o fim é numericamente menor que o início (ex: 04:00 < 22:00), assumimos dia seguinte
    endMs += 24 * 60 * 60 * 1000;
  }

  // Visibilidade estrita: some assim que termina.
  const isVisible = now < endMs;
  
  // DEBUG LOG
  if (!isVisible) {
    console.log(`[isEventVisible] ${event.title || 'Sem título'} NÃO VISÍVEL`, {
      now: new Date(now).toISOString(),
      startMs: new Date(startMs).toISOString(),
      endMs: new Date(endMs).toISOString(),
      nowVsEnd: now - endMs,
      status: event.status,
      eventId: event.id || 'sem-id'
    });
  }
  
  return isVisible;
}
