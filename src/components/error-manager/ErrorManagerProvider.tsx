
'use client';

import * as React from 'react';
import { useAuth, useUser } from '@/firebase';
import { logSystemError, ErrorSeverity } from '@/lib/error-manager';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';

interface ErrorManagerContextType {
  reportError: (params: { error: any; type: string; severity?: ErrorSeverity; metadata?: any }) => Promise<string>;
}

const ErrorManagerContext = React.createContext<ErrorManagerContextType | null>(null);

export function ErrorManagerProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { user } = useUser(auth);
  const { toast } = useToast();

  const reportError = React.useCallback(async (params: { 
    error: any; 
    type: string; 
    severity?: ErrorSeverity; 
    metadata?: any 
  }) => {
    const code = await logSystemError({
      ...params,
      user: user ? { uid: user.uid, email: user.email } : null
    });

    // Mostrar toast amigável
    toast({
      variant: params.severity === 'critical' ? 'destructive' : 'default',
      title: 'Ops! Aconteceu um erro inesperado.',
      description: `Código de rastreio: ${code}. Nossa equipe foi notificada automaticamente.`,
    });

    return code;
  }, [user, toast]);

  React.useEffect(() => {
    // Escutar erros globais do Firebase que já usam o errorEmitter
    const handleFirebaseError = (error: any) => {
      reportError({
        error,
        type: 'firebase_permission',
        severity: 'warning',
        metadata: { path: error.context?.path, op: error.context?.operation }
      });
    };

    // Escutar erros de runtime não tratados
    const handleWindowError = (event: ErrorEvent) => {
      reportError({
        error: event.error,
        type: 'runtime_exception',
        severity: 'error'
      });
    };

    // Escutar rejeições de promise não tratadas
    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      reportError({
        error: event.reason,
        type: 'unhandled_promise',
        severity: 'error'
      });
    };

    errorEmitter.on('permission-error', handleFirebaseError);
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handlePromiseRejection);

    return () => {
      errorEmitter.off('permission-error', handleFirebaseError);
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handlePromiseRejection);
    };
  }, [reportError]);

  return (
    <ErrorManagerContext.Provider value={{ reportError }}>
      {children}
    </ErrorManagerContext.Provider>
  );
}

export const useErrorManager = () => {
  const context = React.useContext(ErrorManagerContext);
  if (!context) throw new Error('useErrorManager must be used within ErrorManagerProvider');
  return context;
};
