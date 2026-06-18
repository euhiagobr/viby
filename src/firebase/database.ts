
'use client';

import { getFirestore, Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Instância estabilizada do Firestore.
 * Utiliza cache persistente e gerenciamento de múltiplas abas para evitar o erro ca9 do SDK v11.
 * O erro ca9 ocorre quando o IndexedDB entra em conflito.
 */

let firestoreInstance: Firestore | null = null;

export const db = (() => {
  if (typeof window !== 'undefined') {
    if (!firestoreInstance) {
      // Usamos initializeFirestore uma única vez por ciclo de vida do cliente
      try {
        firestoreInstance = initializeFirestore(app, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        });
        console.log('[Firestore-Debug] initialized with persistence');
      } catch (e) {
        // Fallback se a inicialização falhar (ex: IndexedDB indisponível ou re-inicialização)
        console.warn('[Firestore-Debug] persistence failed, falling back to getFirestore');
        firestoreInstance = getFirestore(app);
      }
    }
  } else {
    // SSR
    if (!firestoreInstance) {
      firestoreInstance = getFirestore(app);
    }
  }
  return firestoreInstance;
})();
