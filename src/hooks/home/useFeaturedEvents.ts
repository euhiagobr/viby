
'use client';

import { useMemo } from 'react';

export function useFeaturedEvents(events: any[]) {
  return useMemo(() => events.filter(e => e.isFeatured === true), [events]);
}
