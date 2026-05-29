'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { firebaseConfig } from "./config";

/**
 * @fileOverview TRACE: Inicialização do Firebase App.
 */

let firebaseApp: FirebaseApp;

console.log("[TRACE-VIBY] Control: Verificando inicialização do Firebase App...");

if (getApps().length === 0) {
  console.log("[TRACE-VIBY] Action: Initializing NEW Firebase App", firebaseConfig.projectId);
  firebaseApp = initializeApp(firebaseConfig);
} else {
  console.log("[TRACE-VIBY] Action: Using EXISTING Firebase App");
  firebaseApp = getApp();
}

console.log("[TRACE-VIBY] State: Firebase App is ready.", { appId: firebaseApp.options.appId });

export const app = firebaseApp;
