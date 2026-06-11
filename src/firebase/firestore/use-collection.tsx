'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Query,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  FirestoreError,
  Unsubscribe,
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

/**
 * Hook resiliente para escutar coleções.
 * Implementa controle rígido de ciclo de vida para prevenir erros de asserção ca9 e vazamento de listeners.
 */
export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  const isMounted = useRef(true);
  const unsubRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    isMounted.current = true;

    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    if (!query) {
      setLoading(false);
      setData([]);
      return;
    }

    setLoading(true);

    try {
      unsubRef.current = onSnapshot(
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
        (serverError: FirestoreError) => {
          if (!isMounted.current) return;

          if (serverError.code === 'permission-denied') {
            console.warn("[useCollection] Permission denied for query");
            setData([]);
          } else {
            setError(serverError);
          }
          setLoading(false);
        }
      );
    } catch (e) {
      if (isMounted.current) {
        setLoading(false);
      }
    }

    return () => {
      isMounted.current = false;
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [query]);

  return { data: data || ([] as T[]), loading, error };
}
