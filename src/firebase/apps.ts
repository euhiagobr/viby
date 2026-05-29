'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { firebaseConfig } from "./config";

/**
 * @fileOverview Inicialização robusta do Firebase App (Isomórfico: Client & Server).
 */

function initializeFirebaseApp(): FirebaseApp {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

export const app = initializeFirebaseApp();
