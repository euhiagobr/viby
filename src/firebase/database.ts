'use client';

import { initializeFirestore, Firestore, memoryLocalCache, getFirestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Singleton Robusto do Firestore para evitar o erro ca9.
 * Forçamos o cache em memória para evitar conflitos de persistência no Workstation.
 */

declare global {
  var firestoreInstance: Firestore | undefined;
}

const initializeDb = (): Firestore => {
  try {
    // Verificamos se já existe uma instância antes de tentar inicializar novamente
    if (globalThis.firestoreInstance) return globalThis.firestoreInstance;

    const firestore = initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
    console.log('[Firestore] Singleton initialized with Memory Cache');
    return firestore;
  } catch (e) {
    console.warn("[Firestore] Initialization error, falling back to getFirestore:", e);
    return getFirestore(app);
  }
};

export const db = (() => {
  if (typeof window !== 'undefined') {
    if (!globalThis.firestoreInstance) {
      globalThis.firestoreInstance = initializeDb();
    }
    return globalThis.firestoreInstance;
  }
  return getFirestore(app);
})();
