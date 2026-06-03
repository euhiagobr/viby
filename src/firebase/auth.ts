'use client';

import { getAuth, setPersistence, indexedDBLocalPersistence } from "firebase/auth";
import { app } from "./apps";

/**
 * @fileOverview Inicialização do Firebase Auth com logs e persistência explícita.
 */

export const auth = getAuth(app);
console.log('[Auth-Debug] Firebase Auth Initialized');
console.log('[Auth-Debug] Auth Instance:', auth);

// Configuração de persistência imediata
setPersistence(auth, indexedDBLocalPersistence)
  .then(() => {
    console.log('[Auth-Debug] Persistence Configured');
  })
  .catch((err) => {
    console.error('[Auth-Debug] Persistence Error:', err);
  });
