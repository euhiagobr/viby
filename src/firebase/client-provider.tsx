'use client';

import { ReactNode, useMemo } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';
import { FirebaseProvider } from './provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

/**
 * Inicialização centralizada para o Viby.
 * Suporta bancos de dados nomeados (eventosviby) de forma resiliente.
 */
export function initializeFirebase() {
  // Inicializa o App se não existir
  const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  
  /**
   * GARANTIA VIBY:
   * Para acessar o banco de dados nomeado 'eventosviby', usamos a assinatura
   * getFirestore(app, databaseId). Isso funciona tanto em SSR quanto no cliente.
   */
  const db: Firestore = getFirestore(app, 'eventosviby');

  // Inicializa Auth
  const auth: Auth = getAuth(app);

  return { firebaseApp: app, firestore: db, auth };
}

export function FirebaseClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  // useMemo garante estabilidade na referência dos serviços e evita re-inicialização
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
