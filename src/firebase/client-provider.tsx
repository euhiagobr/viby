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
 * Tenta usar o banco de dados 'eventosviby' se existir, caso contrário usa o (default).
 */
export function initializeFirebase() {
  const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  
  // No novo projeto, tentamos acessar o banco nomeado. 
  // Se não existir, o Firestore SDK fallback para o default em algumas situações, 
  // mas aqui definimos a conexão principal.
  const db: Firestore = getFirestore(app, 'eventosviby');

  const auth: Auth = getAuth(app);

  return { firebaseApp: app, firestore: db, auth };
}

export function FirebaseClientProvider({
  children,
}: {
  children: ReactNode;
}) {
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
