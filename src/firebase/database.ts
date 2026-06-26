'use client';

import { initializeFirestore, Firestore, memoryLocalCache, getFirestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Singleton Robusto do Firestore para evitar o erro ca9.
 * Desativamos a persistência em disco no ambiente de dev para evitar conflitos de lock.
 */

declare global {
  var firestoreInstance: Firestore | undefined;
}

const initializeDb = (): Firestore => {
  try {
    return initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
  } catch (e) {
    return getFirestore(app);
  }
};

export const db = (() => {
  if (typeof window !== 'undefined') {
    if (!globalThis.firestoreInstance) {
      globalThis.firestoreInstance = initializeDb();
      console.log('[Firestore] Singleton initialized with Memory Cache');
    }
    return globalThis.firestoreInstance;
  }
  return getFirestore(app);
})();
