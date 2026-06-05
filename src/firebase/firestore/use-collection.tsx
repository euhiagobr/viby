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
 * Aprimorado com lógica profunda de extração de path para melhor depuração no ErrorManager.
 * Adicionada proteção contra erros de asserção interna do SDK (ID: ca9/b815).
 */
export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    // Se a query for nula, o hook fica em estado de espera (útil para aguardar o Auth)
    if (!query) {
      setLoading(false);
      return;
    }

    setLoading(true);

    let unsubscribe: () => void;

    try {
      unsubscribe = onSnapshot(
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
            let path = 'collection_query';
            try {
              const q = query as any;
              if (q._query?.path?.segments) {
                path = q._query.path.segments.join('/');
              } else if (q.query?.path?.segments) {
                path = q.query.path.segments.join('/');
              } else if (q.path) {
                path = q.path;
              }
            } catch (e) {
              console.warn("[Path Extraction Failed]", e);
            }
            
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
    } catch (e) {
      console.warn("[Firestore] Collection sync starting failed.");
      setLoading(false);
    }

    return () => {
      isMounted.current = false;
      if (unsubscribe) unsubscribe();
    };
  }, [query]);

  return { data: data || ([] as T[]), loading, error };
}