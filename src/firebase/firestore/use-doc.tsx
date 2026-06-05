'use client';

import { useState, useEffect, useRef } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentSnapshot,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';

/**
 * Hook resiliente para escutar documentos únicos.
 * Implementa proteção contra race conditions e o erro de asserção ca9 do SDK v11.
 * Silencia erros de permissão inofensivos durante a troca de contexto de auth.
 */
export function useDoc<T = DocumentData>(docRef: DocumentReference<T> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    if (!docRef) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    let unsubscribe: () => void;

    try {
      unsubscribe = onSnapshot(
        docRef,
        (snapshot: DocumentSnapshot<T>) => {
          if (!isMounted.current) return;

          if (snapshot.exists()) {
            setData({ ...(snapshot.data() as T), id: snapshot.id });
          } else {
            setData(null);
          }
          
          setLoading(false);
          setError(null);
        },
        (serverError: FirestoreError) => {
          if (!isMounted.current) return;
          
          // O erro ca9 muitas vezes ocorre em conjunto com falhas de permissão no stream.
          // Silenciamos logs de erro de permissão no console se forem transitórios.
          if (serverError.code !== 'permission-denied') {
            console.error(`[Firestore Doc Error] ${serverError.code}`, serverError);
          }
          
          setData(null);
          setError(serverError);
          setLoading(false);
        }
      );
    } catch (e) {
      console.warn("[Firestore] Sync starting failed, likely permission or SDK state issue.");
      setLoading(false);
    }

    return () => {
      isMounted.current = false;
      if (unsubscribe) unsubscribe();
    };
  }, [docRef]);

  return { data, loading, error };
}