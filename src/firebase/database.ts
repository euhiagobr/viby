
'use client';

import { getFirestore, Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Instância estabilizada do Firestore.
 * Implementa proteção contra o erro de asserção ca9 do SDK v11.
 * Em desenvolvimento, a persistência é simplificada para evitar conflitos de HMR.
 */

let firestoreInstance: Firestore | null = null;

export const db = (() => {
  if (typeof window !== 'undefined') {
    if (!firestoreInstance) {
      try {
        // No ambiente do Studio/Trabalho, a persistência múltipla pode causar o erro ca9
        // Ativamos apenas se não estivermos em um ambiente de desenvolvimento instável
        const isDev = window.location.hostname === 'localhost' || window.location.hostname.includes('cloudworkstations.dev');
        
        if (isDev) {
          firestoreInstance = getFirestore(app);
          console.log('[Firestore-Debug] initialized in standard mode (no persistence to avoid ca9)');
        } else {
          firestoreInstance = initializeFirestore(app, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
          });
          console.log('[Firestore-Debug] initialized with persistence');
        }
      } catch (e) {
        console.warn('[Firestore-Debug] Initialization warning, falling back to getFirestore');
        firestoreInstance = getFirestore(app);
      }
    }
  } else {
    // SSR: Sempre usa a instância padrão sem cache
    if (!firestoreInstance) {
      firestoreInstance = getFirestore(app);
    }
  }
  return firestoreInstance;
})();
