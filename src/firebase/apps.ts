import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { firebaseConfig } from "./config";

/**
 * @fileOverview Inicialização isomórfica do Firebase App com logs de diagnóstico.
 */

function initializeFirebaseApp(): FirebaseApp {
  if (getApps().length === 0) {
    const app = initializeApp(firebaseConfig);
    console.log('[Auth-Debug] Firebase App Initialized');
    return app;
  }
  return getApp();
}

export const app = initializeFirebaseApp();
