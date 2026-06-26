'use client';

import { getFirestore, Firestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Instância estabilizada do Firestore.
 * Implementa proteção definitiva contra o erro de asserção ca9 do SDK v11.
 * Utiliza o objeto global para manter a instância viva entre re-renderizações do HMR.
 */

declare global {
  var firestoreInstance: Firestore | undefined;
}

export const db = (() => {
  if (typeof window !== 'undefined') {
    // Em ambientes de desenvolvimento (Studio/Workstations), o HMR pode tentar 
    // reinicializar o Firestore múltiplas vezes, causando o erro 'ca9'.
    // O Singleton via globalThis garante estabilidade total.
    if (!globalThis.firestoreInstance) {
      globalThis.firestoreInstance = getFirestore(app);
      console.log('[Firestore] Singleton initialized on Client');
    }
    return globalThis.firestoreInstance;
  }
  return getFirestore(app);
})();
