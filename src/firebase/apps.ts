import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { firebaseConfig } from "./config";

/**
 * @fileOverview Inicialização isomórfica do Firebase App.
 * Removida a diretiva 'use client' para permitir uso em Server Actions.
 */

function initializeFirebaseApp(): FirebaseApp {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

export const app = initializeFirebaseApp();
