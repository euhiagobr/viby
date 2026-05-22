'use client';

import { ReactNode } from 'react';
import { auth, db, storage } from './index';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from './config';
import { FirebaseProvider } from './provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export function FirebaseClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

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
