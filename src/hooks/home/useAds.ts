
'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';

export function useAds() {
  const db = useFirestore();

  const adsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, "ads"), 
      where("status", "==", "Ativo"),
      limit(10)
    );
  }, [db]);

  const { data: ads, loading } = useCollection<any>(adsQuery);

  return { ads: ads || [], loading }; 
}
