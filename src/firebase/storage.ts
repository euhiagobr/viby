'use client';

import { getStorage, FirebaseStorage } from "firebase/storage";
import { app } from "./apps";

/**
 * @fileOverview Inicialização do Firebase Storage (Singleton).
 */

let storageInstance: FirebaseStorage | null = null;

export const storage = (() => {
  if (typeof window !== 'undefined') {
    if (!storageInstance) {
      storageInstance = getStorage(app);
    }
    return storageInstance;
  }
  return getStorage(app);
})();
