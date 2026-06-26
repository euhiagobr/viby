import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { firebaseConfig } from "./config";

/**
 * @fileOverview Inicialização centralizada do Firebase App (Singleton).
 */

let appInstance: FirebaseApp | null = null;

export const app = (() => {
  if (typeof window !== 'undefined') {
    if (!appInstance) {
      const apps = getApps();
      appInstance = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
    }
    return appInstance;
  }
  // No servidor, inicializa por requisição se necessário
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
})();
