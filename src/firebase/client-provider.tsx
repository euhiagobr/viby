
'use client';

import { ReactNode, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from './config';
import { FirebaseProvider } from './provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

/**
 * Inicialização centralizada para o Viby.
 * Alinhado com a arquitetura de projeto compartilhado (ONG Desafios).
 * Força a conexão com o banco de dados 'eventosviby'.
 */
export function initializeFirebase() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  
  // GARANTIA: Aponta exclusivamente para o banco de dados secundário do Viby
  const db = getFirestore(app, 'eventosviby');
  const auth = getAuth(app);

  return { firebaseApp: app, firestore: db, auth };
}

export function FirebaseClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { firebaseApp, firestore, auth } = useMemo(() => initializeFirebase(), []);

  return (
    <FirebaseProvider firebaseApp={firebaseApp} firestore={firestore} auth={auth}>
      <FirebaseErrorListener />
      {children}
    </FirebaseProvider>
  );
}
