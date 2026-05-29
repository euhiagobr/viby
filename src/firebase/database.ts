'use client';

import { getFirestore, Firestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview TRACE: Inicialização do Singleton Firestore.
 */

const DATABASE_ID = "eventosviby";

console.log("[TRACE-VIBY] Control: Solicitando instância Firestore:", DATABASE_ID);

let dbInstance: Firestore;

try {
  dbInstance = getFirestore(app, DATABASE_ID);
  console.log("[TRACE-VIBY] State: Firestore instance created/retrieved.", {
    dbId: DATABASE_ID,
    instanceExists: !!dbInstance,
    constructor: dbInstance?.constructor?.name
  });
} catch (e) {
  console.error("[TRACE-VIBY] ERROR: Falha crítica ao obter Firestore singleton", e);
  throw e;
}

export const db = dbInstance;
