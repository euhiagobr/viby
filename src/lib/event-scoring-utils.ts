
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
  
  const now = nowOverride ? nowOverride.getTime() : new Date().getTime();
  
  const parseDateToMs = (val: any) => {
    if (!val) return null;
    // 1. Objeto Timestamp do Client SDK (.toDate)
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    
    // 2. Objeto Timestamp serializado (Admin SDK ou Cache)
    if (typeof val === 'object' && 'seconds' in val) return val.seconds * 1000;
    
    // 3. String ISO ou data nativa
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.getTime();
  };

  const startMs = parseDateToMs(event.date);
  
  // Se não houver data de início (recém criado), assume visibilidade
  if (!startMs) return true;

  // Threshold de tolerância de 2 minutos para eventos recém-criados no servidor
  if (startMs > now - 120000) return true;

  let endMs = parseDateToMs(event.endDate);
  
  // Tratamento de virada de noite (ex: 22h às 04h)
  if (endMs && endMs <= startMs) {
    const dStart = new Date(startMs);
    const dEnd = new Date(endMs);
    if (dStart.toISOString().split('T')[0] === dEnd.toISOString().split('T')[0]) {
      endMs += 24 * 60 * 60 * 1000;
    }
  }

  // Fallback: Se não houver data de fim, usamos um padrão de 6h após o início
  const effectiveEndMs = endMs || (startMs + 6 * 60 * 60 * 1000);
  
  return now < effectiveEndMs;
}
