'use client';

/**
 * @fileOverview Ponto de entrada central para o Firebase no cliente.
 * Atua como um "barrel file" para re-exportar instâncias e hooks.
 * As instâncias reais são inicializadas em arquivos separados para evitar dependências circulares.
 */

export { app } from './apps';
export { auth } from './auth';
export { db } from './database';
export { storage } from './storage';

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
