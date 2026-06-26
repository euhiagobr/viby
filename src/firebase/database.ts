'use client';

import { initializeFirestore, Firestore, memoryLocalCache } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Instância estabilizada do Firestore para ambientes de desenvolvimento.
 * Implementa proteção definitiva contra o erro de asserção ca9 do SDK v11.
 * Utiliza o objeto global e memória local para evitar conflitos de persistência no HMR.
 */

declare global {
  var firestoreInstance: Firestore | undefined;
}

export const db = (() => {
  if (typeof window !== 'undefined') {
    // Em ambientes de desenvolvimento (Studio/Workstations), o Hot Module Replacement (HMR) 
    // pode tentar reinicializar o Firestore múltiplas vezes, causando o erro 'ca9'.
    // Usar initializeFirestore com cache em memória é a solução oficial para este cenário.
    if (!globalThis.firestoreInstance) {
      try {
        globalThis.firestoreInstance = initializeFirestore(app, {
          localCache: memoryLocalCache(),
        });
        console.log('[Firestore] Singleton initialized with Memory Cache');
      } catch (e) {
        // Se já foi inicializado por outro caminho, tenta recuperar a instância padrão
        const { getFirestore } = require("firebase/firestore");
        globalThis.firestoreInstance = getFirestore(app);
      }
    }
    return globalThis.firestoreInstance!;
  }
  
  const { getFirestore } = require("firebase/firestore");
  return getFirestore(app);
})();
