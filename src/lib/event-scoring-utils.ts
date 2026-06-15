/**
 * @fileOverview Lógica de filtragem e normalização de eventos Viby.
 * Foco em: "Perto de você" (Filtro) e "No tempo certo" (Ordenação).
 */

import { calculateDistance, type Coordinates } from "./location-utils";

/**
 * Calcula a distância exata em metros entre dois pontos.
 */
export function calculateDistanceMeters(coords1: Coordinates, coords2: Coordinates): number {
  const km = calculateDistance(coords1, coords2);
  return Math.round(km * 1000);
}

/**
 * Define se um evento deve ser exibido nas vitrines públicas.
 * Regra: Eventos ativos cujo horário de encerramento ainda não passou.
 * Para eventos recorrentes, a visibilidade depende da próxima ocorrência válida.
 */
export function isEventVisible(event: any, nowOverride?: Date | null): boolean {
  if (!event || event.status !== 'Ativo') return false;
  
  // Garantir comparação em milissegundos absolutos para evitar problemas de fuso horário
  const now = nowOverride ? nowOverride.getTime() : new Date().getTime();
  
  const parseDateToMs = (val: any) => {
    if (!val) return null;
    if (val.toDate) return val.toDate().getTime();
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.getTime();
  };

  const startMs = parseDateToMs(event.date);
  if (!startMs) return false;

  let endMs = parseDateToMs(event.endDate);
  
  // Caso especial: Madrugada (ex: 22h às 04h)
  // Se o fim é menor que o início mas no mesmo dia de calendário (ex: "2026-06-10T22:00" e "2026-06-10T04:00")
  if (endMs && endMs <= startMs) {
    const dStart = new Date(startMs);
    const dEnd = new Date(endMs);
    if (dStart.toDateString() === dEnd.toDateString()) {
      endMs += 24 * 60 * 60 * 1000;
    }
  }

  // Se não houver data de fim, usamos um padrão de 6h após o início como threshold de visibilidade
  const effectiveEndMs = endMs || (startMs + 6 * 60 * 60 * 1000);
  
  // O evento só é visível se o momento atual for anterior ao encerramento (ou 6h após o início se não houver fim)
  return now < effectiveEndMs;
}
