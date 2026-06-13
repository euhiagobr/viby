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
export function isEventVisible(event: any): boolean {
  if (!event || event.status !== 'Ativo') return false;
  
  const now = new Date();
  const parseDate = (val: any) => {
    if (!val) return null;
    if (val.toDate) return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const start = parseDate(event.date);
  if (!start) return false;

  // Normalização de Madrugada: se o fim for menor que o início na mesma data, interpretamos como dia seguinte
  let end = parseDate(event.endDate);
  if (end && end <= start) {
    if (start.toISOString().split('T')[0] === end.toISOString().split('T')[0]) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  // Se não houver data de fim, usamos um padrão de 6h após o início como threshold de visibilidade
  const effectiveEnd = end || new Date(start.getTime() + 6 * 60 * 60 * 1000);
  
  return now < effectiveEnd;
}
