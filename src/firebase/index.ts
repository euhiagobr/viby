'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from './config';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app, "eventosviby");
export const storage = getStorage(app);

export {
  FirebaseProvider,
  useFirebase,
  useFirebaseApp,
  useFirestore,
  useAuth,
  useStorage,
} from './provider';

export { FirebaseClientProvider } from './client-provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { useMemoFirebase } from './firestore/use-memo-firebase';
export { useUser } from './auth/use-user';
