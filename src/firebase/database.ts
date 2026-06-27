
'use client';

import { initializeFirestore, Firestore, memoryLocalCache, getFirestore } from "firebase/firestore";
import { app } from "./apps";

declare global {
  var firestoreInstance: Firestore | undefined;
}

const initializeDb = (): Firestore => {
  if (globalThis.firestoreInstance) return globalThis.firestoreInstance;
  
  try {
    const firestore = initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
    globalThis.firestoreInstance = firestore;
    console.log('[Firestore-Audit] Singleton initialized with Memory Cache');
    return firestore;
  } catch (e) {
    console.warn("[Firestore-Audit] Fallback to getFirestore");
    return getFirestore(app);
  }
};

export const db = (() => {
  if (typeof window !== 'undefined') {
    return initializeDb();
  }
  return getFirestore(app);
})();
