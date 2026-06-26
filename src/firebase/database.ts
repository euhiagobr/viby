'use client';

import { initializeFirestore, Firestore, memoryLocalCache, getFirestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Instância estabilizada do Firestore (Singleton).
 * Focado na resolução do erro ca9 (Unexpected state ID).
 */

declare global {
  var firestoreInstance: Firestore | undefined;
}

export const db = (() => {
  if (typeof window !== 'undefined') {
    if (!globalThis.firestoreInstance) {
      try {
        // Forçamos o uso de cache em memória para evitar conflitos de persistência
        // no ambiente de desenvolvimento que causam o erro ca9.
        globalThis.firestoreInstance = initializeFirestore(app, {
          localCache: memoryLocalCache(),
        });
        console.log('[Firestore-Debug] Singleton initialized with Memory Cache');
      } catch (e) {
        console.warn('[Firestore-Debug] Re-using existing instance');
        globalThis.firestoreInstance = getFirestore(app);
      }
    }
    return globalThis.firestoreInstance!;
  }
  
  return getFirestore(app);
})();
