'use client';

import { initializeFirestore, Firestore, memoryLocalCache, getFirestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Instância estabilizada do Firestore (Singleton).
 * Proteção total contra o erro ca9: 
 * 1. Usa memoryLocalCache para evitar conflitos de IndexedDB no Workstation.
 * 2. Mantém a instância em globalThis para sobreviver ao HMR do Next.js.
 */

declare global {
  var firestoreInstance: Firestore | undefined;
}

export const db = (() => {
  if (typeof window !== 'undefined') {
    if (!globalThis.firestoreInstance) {
      try {
        globalThis.firestoreInstance = initializeFirestore(app, {
          localCache: memoryLocalCache(),
        });
        console.log('[Firestore-Debug] Singleton initialized with Memory Cache');
      } catch (e) {
        console.warn('[Firestore-Debug] Falling back to getFirestore');
        globalThis.firestoreInstance = getFirestore(app);
      }
    }
    return globalThis.firestoreInstance!;
  }
  
  return getFirestore(app);
})();
