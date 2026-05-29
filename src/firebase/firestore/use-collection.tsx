
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
 * Aprimorado para fornecer contextos de erro mais precisos.
 */
export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    if (!query) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
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
          // Extração robusta do caminho da coleção
          let path = 'collection_query';
          try {
            const q = query as any;
            if (q._query && q._query.path) {
              path = q._query.path.segments.join('/');
            } else if (q.path) {
              path = q.path;
            }
          } catch (e) {}
          
          const permissionError = new FirestorePermissionError({
            path: path,
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
          setData([]);
        } else {
          console.error(`[Firestore Collection Error] ${serverError.code}`, serverError);
          setError(serverError);
        }
        setLoading(false);
      }
    );

    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  }, [query]);

  return { data: data || ([] as T[]), loading, error };
}
