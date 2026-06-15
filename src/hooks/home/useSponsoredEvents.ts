
'use client';

import { useMemo } from 'react';

/**
 * CORREÇÃO: Filtra apenas eventos marcados explicitamente como patrocinados.
 * Eventos de curadoria não entram mais automaticamente nesta lista para não poluir o topo do feed.
 */
export function useSponsoredEvents(events: any[]) {
  return useMemo(() => events.filter(e => e.isSponsored === true), [events]);
}
