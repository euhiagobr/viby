'use client';

import { createContext, useContext, ReactNode } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import { FirebaseStorage } from 'firebase/storage';

interface FirebaseContextValue {
  authApp: FirebaseApp | null;
  vibyApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
}

const FirebaseContext = createContext<FirebaseContextValue>({
  authApp: null,
  vibyApp: null,
  firestore: null,
  auth: null,
  storage: null,
});

export function FirebaseProvider({
  children,
  authApp,
  vibyApp,
  firestore,
  auth,
  storage,
}: {
  children: ReactNode;
  authApp: FirebaseApp;
  vibyApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
}) {
  return (
    <FirebaseContext.Provider value={{ authApp, vibyApp, firestore, auth, storage }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => useContext(FirebaseContext);
export const useAuthApp = () => useContext(FirebaseContext).authApp;
export const useVibyApp = () => useContext(FirebaseContext).vibyApp;
export const useFirebaseApp = () => useContext(FirebaseContext).vibyApp;
export const useFirestore = () => useContext(FirebaseContext).firestore;
export const useAuth = () => useContext(FirebaseContext).auth;
export const useStorage = () => useContext(FirebaseContext).storage;
