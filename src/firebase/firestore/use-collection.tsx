
'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Hook para escutar coleções do Firestore de forma estável.
 * Implementa try/catch e silent fail para usuários deslogados.
 */
export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!query) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    let unsubscribe = () => {};

    try {
      unsubscribe = onSnapshot(
        query,
        (snapshot: QuerySnapshot<T>) => {
          if (!isMounted) return;
          
          const items = snapshot.docs.map((doc) => ({
            ...(doc.data() as T),
            id: doc.id,
          }));
          
          setData(items);
          setLoading(false);
          setError(null);
        },
        (serverError: FirestoreError) => {
          if (!isMounted) return;

          // Silent fail para erros de permissão em navegação pública
          if (serverError.code === 'permission-denied') {
            console.warn(`[Firestore] Acesso negado ou restrito a: ${(query as any)._query?.path?.toString() || 'unknown'}. Retornando lista vazia.`);
            setData([]);
          } else {
            console.error(`[Firestore Error] ${serverError.code}: ${serverError.message}`);
          }
          
          setError(serverError);
          setLoading(false);
        }
      );
    } catch (err) {
      if (isMounted) {
        setData([]);
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [query]);

  return { data: data || ([] as T[]), loading, error };
}
