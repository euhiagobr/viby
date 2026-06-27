'use client';

import { getAuth, Auth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { app } from "./apps";

declare global {
  var authInstance: Auth | undefined;
}

const initializeAuth = (): Auth => {
  const auth = getAuth(app);
  console.log('[AUDIT-AUTH] Initializing Auth Instance. Configured Persistence: LOCAL');
  
  setPersistence(auth, browserLocalPersistence)
    .then(() => console.log('[AUDIT-AUTH] Persistence set to LOCAL successfully'))
    .catch(e => console.error('[AUDIT-AUTH] Persistence Error:', e.code));
    
  return auth;
};

export const auth = (() => {
  if (typeof window !== 'undefined') {
    if (!globalThis.authInstance) {
      globalThis.authInstance = initializeAuth();
      console.log('[AUDIT-AUTH] Singleton Auth created on Client Global scope');
    } else {
      console.log('[AUDIT-AUTH] Reusing existing Singleton Auth from Global scope');
    }
    return globalThis.authInstance;
  }
  return getAuth(app);
})();
