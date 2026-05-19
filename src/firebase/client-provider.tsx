'use client';

import { ReactNode, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from './config';
import { FirebaseProvider } from './provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export function initializeFirebase() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  // Configuração explícita para o Named Database 'eventosviby'
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