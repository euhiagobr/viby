
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
          // Extração ultra-robusta do caminho da coleção para o ErrorManager
          let path = 'unknown_collection';
          try {
            const q = query as any;
            // Tenta diversas propriedades internas onde o SDK v11 armazena o path
            if (q.path) {
              path = q.path;
            } else if (q._query?.path?.segments) {
              path = q._query.path.segments.join('/');
            } else if (q.query?.path?.segments) {
              path = q.query.path.segments.join('/');
            } else if (typeof q.toString === 'function') {
              // Fallback para representação em string se disponível
              const qStr = q.toString();
              if (qStr.includes('Query(')) {
                path = qStr.split('Query(')[1].split(')')[0];
              }
            }
          } catch (e) {
            console.warn("[Path Extraction Failed]", e);
          }
          
          const permissionError = new FirestorePermissionError({
            path: path,
            operation: 'list',
          });
          
          // Emitir erro para o ErrorManager global
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
