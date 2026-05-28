'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { firebaseConfig } from "./config";

/**
 * Garante que o Firebase App seja inicializado apenas uma vez no cliente.
 */
let firebaseApp: FirebaseApp;

if (getApps().length === 0) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp();
}

export const app = firebaseApp;
