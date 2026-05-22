'use client';

import { ReactNode, useMemo } from 'react';
import { authApp, vibyApp } from './apps';
import { auth } from './auth';
import { db } from './database';
import { storage } from './storage';
import { FirebaseProvider } from './provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export function FirebaseClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <FirebaseProvider 
      authApp={authApp}
      vibyApp={vibyApp}
      firestore={db} 
      auth={auth}
      storage={storage}
    >
      <FirebaseErrorListener />
      {children}
    </FirebaseProvider>
  );
}
