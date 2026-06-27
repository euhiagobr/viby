
'use client';

import { getAuth, Auth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { app } from "./apps";

declare global {
  var authInstance: Auth | undefined;
}

const initializeAuth = (): Auth => {
  const auth = getAuth(app);
  setPersistence(auth, browserLocalPersistence).catch(e => {
    console.error('[Auth-Audit] Persistence Error:', e.code);
  });
  return auth;
};

export const auth = (() => {
  if (typeof window !== 'undefined') {
    if (!globalThis.authInstance) {
      globalThis.authInstance = initializeAuth();
      console.log('[Auth-Audit] Singleton initialized on Client');
    }
    return globalThis.authInstance;
  }
  return getAuth(app);
})();
