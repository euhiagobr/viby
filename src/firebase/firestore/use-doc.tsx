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
 * Implementa controle de montagem para evitar erros de estado interno no SDK.
 */
export function useDoc<T = DocumentData>(docRef: DocumentReference<T> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    if (!docRef) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot<T>) => {
        if (!isMountedRef.current) return;

        if (snapshot.exists()) {
          setData({ ...(snapshot.data() as T), id: snapshot.id });
        } else {
          setData(null);
        }
        
        setLoading(false);
        setError(null);
      },
      (serverError: FirestoreError) => {
        if (!isMountedRef.current) return;

        if (serverError.code === 'permission-denied') {
          console.warn(`[Firestore] Documento privado ou inexistente: ${docRef.path}.`);
          setData(null);
        } else {
          console.error(`[Firestore Error] ${serverError.code}: ${serverError.message}`);
        }
        
        setError(serverError);
        setLoading(false);
      }
    );

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [docRef]);

  return { data, loading, error };
}
