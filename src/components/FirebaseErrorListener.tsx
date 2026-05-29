
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

/**
 * Listener centralizado para erros de permissão do Firestore.
 * Exibe toasts informativos e registra os detalhes no log do sistema.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Exibir no console apenas em desenvolvimento para rastro técnico
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Firestore Permission Guard] Access Denied at ${error.context.path}`);
      }

      toast({
        variant: 'destructive',
        title: 'Acesso Restrito',
        description: `Não foi possível listar dados em: ${error.context.path}. Se o problema persistir, entre em contato com o suporte.`,
      });
    };

    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  return null;
}
