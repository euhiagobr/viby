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
 * Regra: Eventos ativos cujo horário de encerramento ainda não passou.
 * Para eventos recorrentes, a visibilidade depende da próxima ocorrência válida.
 */
export function isEventVisible(event: any, nowOverride?: Date | null): boolean {
  if (!event || event.status === 'Excluído') return false;
  
  // Status 'Oculto' permite visualização via link direto mas remove das vitrines se não for admin
  if (event.status !== 'Ativo') return false;
  
  const now = nowOverride ? nowOverride.getTime() : new Date().getTime();
  
  const startDate = safeParseDate(event.date);
  if (!startDate) return true; // Se não houver data válida, assume visibilidade para evitar descarte indevido

  const startMs = startDate.getTime();

  // Tolerância para eventos que estão acontecendo AGORA: 
  // Mostramos até 6 horas após o início caso não haja data de término definida.
  const endDate = safeParseDate(event.endDate);
  let endMs = endDate ? endDate.getTime() : null;
  
  if (endMs && endMs <= startMs) {
    // Tratamento de virada de noite (ex: 22h às 04h)
    const dStart = new Date(startMs);
    const dEnd = new Date(endMs);
    if (dStart.toISOString().split('T')[0] === dEnd.toISOString().split('T')[0]) {
      endMs += 24 * 60 * 60 * 1000;
    }
  }

  // Fallback: Se não houver data de fim, usamos um padrão de 12h após o início para garantir visibilidade no dia
  const effectiveEndMs = endMs || (startMs + 12 * 60 * 60 * 1000);
  
  return now < effectiveEndMs;
}