'use client';

import { ReactNode, useMemo } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, initializeFirestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';
import { FirebaseProvider } from './provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

/**
 * Inicialização centralizada para o Viby.
 * Ajustado para ser resiliente em ambientes SSR.
 */
export function initializeFirebase() {
  const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  
  // No servidor, evitamos persistência complexa e usamos inicialização básica
  const isServer = typeof window === 'undefined';
  
  const db: Firestore = isServer 
    ? getFirestore(app, 'eventosviby')
    : initializeFirestore(app, { databaseId: 'eventosviby' });

  const auth: Auth = getAuth(app);

  return { firebaseApp: app, firestore: db, auth };
}

export function FirebaseClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  // useMemo garante estabilidade na referência dos serviços
  const firebaseData = useMemo(() => initializeFirebase(), []);

  return (
    <FirebaseProvider 
      firebaseApp={firebaseData.firebaseApp} 
      firestore={firebaseData.firestore} 
      auth={firebaseData.auth}
    >
      <FirebaseErrorListener />
      {children}
    </FirebaseProvider>
  );
}
