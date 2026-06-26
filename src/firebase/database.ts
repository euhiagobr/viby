'use client';

import { getFirestore, Firestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Instância estabilizada do Firestore.
 * Implementa proteção definitiva contra o erro de asserção ca9.
 * NUNCA habilite persistência local neste ambiente de desenvolvimento.
 */

let firestoreInstance: Firestore | null = null;

export const db = (() => {
  if (typeof window !== 'undefined') {
    if (!firestoreInstance) {
      firestoreInstance = getFirestore(app);
      console.log('[Firestore] Singleton initialized (no persistence)');
    }
    return firestoreInstance;
  }
  return getFirestore(app);
})();
