
'use client';

import { useMemo } from 'react';

export function useAds() {
  // Atualmente o AdsRenderer busca os anúncios diretamente. 
  // Este hook serve para placeholder caso precisemos injetar dados de Ads no unifiedFeed.
  return { ads: [] }; 
}
