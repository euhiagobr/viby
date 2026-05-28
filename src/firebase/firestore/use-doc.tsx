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
 * Implementa proteção contra race conditions e o erro de asserção ca9 do SDK.
 */
export function useDoc<T = DocumentData>(docRef: DocumentReference<T> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  const isMounted = useRef(true);
  const unsubscribe = useRef<(() => void) | null>(null);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    isMounted.current = true;

    if (!docRef) {
      setData(null);
      setLoading(false);
      return;
    }

    // Evita duplicidade se o caminho for o mesmo
    if (unsubscribe.current && lastPath.current === docRef.path) {
      return;
    }

    setLoading(true);
    lastPath.current = docRef.path;

    if (unsubscribe.current) {
      unsubscribe.current();
    }
    
    try {
      unsubscribe.current = onSnapshot(
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
          if (serverError.code !== 'permission-denied') {
            console.error(`[Firestore Doc Error] ${serverError.code}`);
          }
          setData(null);
          setError(serverError);
          setLoading(false);
        }
      );
    } catch (e) {
      setLoading(false);
    }

    return () => {
      isMounted.current = false;
      if (unsubscribe.current) {
        unsubscribe.current();
        unsubscribe.current = null;
      }
    };
  }, [docRef]);

  return { data, loading, error };
}
