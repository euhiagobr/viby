'use client';

import { 
  collection, 
  doc, 
  Firestore, 
  CollectionReference, 
  DocumentReference,
  DocumentData,
  addDoc,
  updateDoc,
  setDoc,
  getDoc,
  serverTimestamp
} from "firebase/firestore";
import { db as singletonDb } from "@/firebase/database";

/**
 * @fileOverview TRACE: Wrapper de Segurança e Auditoria do Firestore.
 * NUNCA remova os logs deste arquivo até que o erro ca9 seja resolvido.
 */

function validateDb(providedDb: any, source: string): Firestore {
  console.group(`[TRACE-VIBY] Validation: Firestore Access from ${source}`);
  
  const targetDb = providedDb || singletonDb;
  
  console.log("Input DB:", providedDb ? "PROVIDED" : "FALLBACK TO SINGLETON");
  console.log("DB Typeof:", typeof targetDb);
  console.log("DB Constructor:", targetDb?.constructor?.name);
  console.log("DB Object Keys:", Object.keys(targetDb || {}).slice(0, 5));
  
  // A verificação abaixo é o que o SDK do Firebase faz internamente
  const isValid = targetDb && typeof targetDb === 'object' && targetDb.type === 'firestore';
  
  console.log("Is Valid Instance?:", isValid ? "YES" : "NO - CRITICAL ERROR IMMINENT");
  
  if (!isValid) {
    console.error("[TRACE-VIBY] INVALID DB DETECTED. Printing Stack Trace...");
    console.trace(); // Imprime a pilha de chamadas para saber quem enviou o lixo
  }
  
  console.groupEnd();
  
  return targetDb as Firestore;
}

export const FirestoreService = {
  collection: (path: string, providedDb?: any): CollectionReference<DocumentData> => {
    const validDb = validateDb(providedDb, `collection(${path})`);
    return collection(validDb, path);
  },

  doc: (path: string, ...segments: string[]): DocumentReference<DocumentData> => {
    const validDb = validateDb(null, `doc(${path})`); // Sempre usa singleton para doc por segurança
    return doc(validDb, path, ...segments);
  },

  add: async (path: string, data: any) => {
    console.log(`[TRACE-VIBY] Op: Adding doc to ${path}`);
    const colRef = FirestoreService.collection(path);
    return addDoc(colRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
};

// Funções de compatibilidade também trackeadas
export function safeCollection(providedDb: any, path: string) {
  return FirestoreService.collection(path, providedDb);
}

export function safeDoc(providedDb: any, path: string, ...segments: string[]) {
  return FirestoreService.doc(path, ...segments);
}
