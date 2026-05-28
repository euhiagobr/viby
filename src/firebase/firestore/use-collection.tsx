'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Query,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

/**
 * Hook resiliente para escutar coleções do Firestore.
 * Aprimorado com proteção tripla contra o erro ca9 e vazamento de memória.
 */
export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  // Controle de estado e subscrição
  const isMounted = useRef(true);
  const unsubscribe = useRef<(() => void) | null>(null);
  const lastQueryString = useRef<string | null>(null);

  useEffect(() => {
    isMounted.current = true;

    if (!query) {
      setData([]);
      setLoading(false);
      return;
    }

    // Evita re-inscrição se a query for idêntica (baseado na representação interna)
    const currentQueryString = JSON.stringify(query);
    if (unsubscribe.current && lastQueryString.current === currentQueryString) {
      return;
    }

    setLoading(true);
    lastQueryString.current = currentQueryString;

    // Limpa subscrição anterior antes de iniciar nova
    if (unsubscribe.current) {
      unsubscribe.current();
    }

    try {
      unsubscribe.current = onSnapshot(
        query,
        (snapshot: QuerySnapshot<T>) => {
          if (!isMounted.current) return;
          
          const items = snapshot.docs.map((doc) => ({
            ...(doc.data() as T),
            id: doc.id,
          }));
          
          setData(items);
          setLoading(false);
          setError(null);
        },
        async (serverError: FirestoreError) => {
          if (!isMounted.current) return;

          if (serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
              path: 'collection_query',
              operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            setData([]);
          } else {
            console.error(`[Firestore Collection Error] ${serverError.code}`);
            setError(serverError);
          }
          setLoading(false);
        }
      );
    } catch (e) {
      console.warn("[Firestore] Falha ao registrar listener de coleção.");
      setLoading(false);
    }

    return () => {
      isMounted.current = false;
      if (unsubscribe.current) {
        unsubscribe.current();
        unsubscribe.current = null;
      }
    };
  }, [query]);

  return { data: data || ([] as T[]), loading, error };
}
