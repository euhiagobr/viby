'use client';

import { app } from './app';
import { auth } from './auth';
import { db } from './database';
import { storage } from './storage';

export { app } from './app';
export { auth } from './auth';
export { db } from './database';
export { storage } from './storage';
export { AuthProvider, useAuthContext, useUser } from './auth-context';

export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { useMemoFirebase } from './firestore/use-memo-firebase';

/**
 * Hooks de instância para acesso direto aos serviços do Firebase no Cliente.
 */
export const useFirebaseApp = () => app;
export const useAuth = () => auth;
export const useFirestore = () => db;
export const useStorage = () => storage;
