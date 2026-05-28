'use client';

import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentSnapshot,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';

/**
 * Hook para escutar um documento do Firestore de forma estável.
 * Implementa silent fail para acesso público sem erros de console vermelhos.
 */
export function useDoc<T = DocumentData>(docRef: DocumentReference<T> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!docRef) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onSnapshot(
        docRef,
        (snapshot: DocumentSnapshot<T>) => {
          if (!isMounted) return;

          if (snapshot.exists()) {
            setData({ ...(snapshot.data() as T), id: snapshot.id });
          } else {
            setData(null);
          }
          
          setLoading(false);
          setError(null);
        },
        (serverError: FirestoreError) => {
          if (!isMounted) return;

          if (serverError.code === 'permission-denied') {
            console.warn(`[Firestore] Leitura privada negada: ${docRef.path}. Retornando nulo.`);
            setData(null);
          } else {
            console.error(`[Firestore Error] ${serverError.code}: ${serverError.message}`);
          }
          
          setError(serverError);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error("[useDoc] Erro ao iniciar listener:", err);
      if (isMounted) {
        setData(null);
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [docRef]);

  return { data, loading, error };
}
