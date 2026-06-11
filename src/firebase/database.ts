import { getFirestore, Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Instância estabilizada do Firestore.
 * Utiliza cache persistente e gerenciamento de múltiplas abas para evitar o erro ca9 do SDK v11.
 */

let firestoreInstance: Firestore | null = null;

export const db = (() => {
  if (typeof window !== 'undefined') {
    if (!firestoreInstance) {
      firestoreInstance = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      });
    }
  } else {
    if (!firestoreInstance) {
      firestoreInstance = getFirestore(app);
    }
  }
  return firestoreInstance;
})();
