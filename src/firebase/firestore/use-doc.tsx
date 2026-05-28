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
 * Hook resiliente para escutar documentos únicos no Firestore.
 * Implementa proteção contra race conditions e o erro de asserção ca9 do SDK no Next.js 15.
 */
export function useDoc<T = DocumentData>(docRef: DocumentReference<T> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  const isMountedRef = useRef(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    if (!docRef) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      // Limpa listener anterior se existir
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

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
            setData(null);
          } else {
            console.error(`[Firestore Error] ${serverError.code}: ${serverError.message}`);
          }
          
          setError(serverError);
          setLoading(false);
        }
      );

      unsubscribeRef.current = unsubscribe;
    } catch (e) {
      console.error("[Firestore] Falha ao iniciar listener de documento:", e);
      setLoading(false);
    }

    return () => {
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [docRef]);

  return { data, loading, error };
}
