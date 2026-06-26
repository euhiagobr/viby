'use client';

import { getAuth, Auth, setPersistence, indexedDBLocalPersistence } from "firebase/auth";
import { app } from "./apps";

/**
 * @fileOverview Inicialização do Firebase Auth (Singleton).
 */

let authInstance: Auth | null = null;

export const auth = (() => {
  if (typeof window !== 'undefined') {
    if (!authInstance) {
      authInstance = getAuth(app);
      // Configura persistência apenas uma vez no cliente
      setPersistence(authInstance, indexedDBLocalPersistence).catch(console.error);
    }
    return authInstance;
  }
  return getAuth(app);
})();
