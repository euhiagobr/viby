
'use client';

import { useMemo } from 'react';

export function useSponsoredEvents(events: any[]) {
  return useMemo(() => events.filter(e => e.isSponsored === true || e.curationType === 'curadoria'), [events]);
}
