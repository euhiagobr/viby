'use client';

import { getAuth, Auth, setPersistence, indexedDBLocalPersistence } from "firebase/auth";
import { app } from "./apps";

/**
 * @fileOverview Inicialização do Firebase Auth (Singleton).
 */

declare global {
  var authInstance: Auth | undefined;
}

export const auth = (() => {
  if (typeof window !== 'undefined') {
    if (!globalThis.authInstance) {
      globalThis.authInstance = getAuth(app);
      // Configura persistência de forma não bloqueante
      setPersistence(globalThis.authInstance, indexedDBLocalPersistence).catch(() => {});
      console.log('[Auth] Singleton initialized on Client');
    }
    return globalThis.authInstance!;
  }
  return getAuth(app);
})();
