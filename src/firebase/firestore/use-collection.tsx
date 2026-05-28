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
 * Aprimorado para evitar o erro de asserção interna ca9 (Unexpected state) 
 * através de controle estrito de montagem e encerramento de inscrições.
 */
export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  // Ref para rastrear se o componente ainda está montado e evitar atualizações de estado indevidas
  const isMountedRef = useRef(true);
  
  // Ref para armazenar a função de cancelamento da subscrição atual
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    // Se não houver query, limpa os dados e encerra para evitar ativação de listeners
    if (!query) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Inicia o listener em tempo real garantindo que limpamos qualquer subscrição anterior
    try {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

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

          // Silencia erros de permissão comuns em navegação anônima (visto que a plataforma é pública)
          if (serverError.code === 'permission-denied') {
            console.warn(`[Firestore] Acesso restrito silenciado.`);
            setData([]);
          } else {
            console.error(`[Firestore Error] ${serverError.code}: ${serverError.message}`);
          }
          
          setError(serverError);
          setLoading(false);
        }
      );

      unsubscribeRef.current = unsubscribe;
    } catch (e) {
      console.error("[Firestore] Falha crítica ao iniciar onSnapshot:", e);
      setLoading(false);
    }

    // Cleanup: Encerra o listener imediatamente ao desmontar ou mudar a query
    return () => {
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [query]);

  return { data: data || ([] as T[]), loading, error };
}
