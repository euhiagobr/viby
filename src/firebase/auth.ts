'use client';

import { getAuth, Auth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { app } from "./apps";

/**
 * @fileOverview Inicialização do Firebase Auth como Singleton Estrito.
 * O uso de globalThis previne múltiplas instâncias durante o Fast Refresh do Next.js.
 */

declare global {
  var authInstance: Auth | undefined;
}

const initializeAuth = (): Auth => {
  const auth = getAuth(app);
  // Configuração síncrona de persistência para evitar delays no gesto do usuário
  setPersistence(auth, browserLocalPersistence).catch(e => console.warn("[Auth] Persistence Error:", e));
  return auth;
};

export const auth = (() => {
  if (typeof window !== 'undefined') {
    if (!globalThis.authInstance) {
      globalThis.authInstance = initializeAuth();
      console.log('[Auth] Singleton initialized on Client');
    }
    return globalThis.authInstance;
  }
  return getAuth(app);
})();
