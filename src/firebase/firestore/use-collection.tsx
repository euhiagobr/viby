'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Query,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';

/**
 * Hook resiliente para escutar coleções do Firestore.
 * Corrigido para evitar o erro de asserção interna ca9 através de uma limpeza estrita.
 */
export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  // Ref para rastrear se o componente ainda está montado
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    if (!query) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Inicia o listener de forma segura
    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<T>) => {
        if (!isMountedRef.current) return;
        
        const items = snapshot.docs.map((doc) => ({
          ...(doc.data() as T),
          id: doc.id,
        }));
        
        setData(items);
        setLoading(false);
        setError(null);
      },
      (serverError: FirestoreError) => {
        if (!isMountedRef.current) return;

        // Trata erro de permissão silenciosamente para navegação pública
        if (serverError.code === 'permission-denied') {
          console.warn(`[Firestore] Acesso restrito em: ${query.toString()}.`);
          setData([]);
        } else {
          console.error(`[Firestore Error] ${serverError.code}: ${serverError.message}`);
        }
        
        setError(serverError);
        setLoading(false);
      }
    );

    return () => {
      isMountedRef.current = false;
      // Garante que o listener seja encerrado antes de qualquer tentativa de resubscrição
      unsubscribe();
    };
  }, [query]);

  return { data: data || ([] as T[]), loading, error };
}
