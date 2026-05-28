'use client';

import { ReactNode } from 'react';
// Importação direta dos arquivos de inicialização para evitar dependência circular com index.ts
import { app } from './apps';
import { auth } from './auth';
import { db } from './database';
import { storage } from './storage';
import { FirebaseProvider } from './provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

/**
 * Provedor de cliente que garante a inicialização única do Firebase.
 * Registra também o listener global de erros de permissão.
 */
export function FirebaseClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <FirebaseProvider 
      firebaseApp={app}
      firestore={db} 
      auth={auth}
      storage={storage}
    >
      <FirebaseErrorListener />
      {children}
    </FirebaseProvider>
  );
}
