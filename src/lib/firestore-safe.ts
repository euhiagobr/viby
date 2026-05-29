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
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { db as singletonDb } from "@/firebase/database";
import { logSystemError } from "./error-manager";

/**
 * @fileOverview FirestoreService - Wrapper de segurança global.
 * Centraliza e valida todas as operações do banco para evitar erros de inicialização.
 */

function validateDb(providedDb?: any): Firestore {
  // Sempre prioriza a instância estável se a provida for nula ou inválida
  const validDb = providedDb || singletonDb;
  
  if (!validDb || typeof validDb !== 'object') {
    const errorMsg = "Instância do Firestore inválida ou não inicializada.";
    logSystemError({
      error: new Error(errorMsg),
      type: 'firestore_init_error',
      severity: 'critical'
    });
    throw new Error(errorMsg);
  }
  
  return validDb;
}

export const FirestoreService = {
  collection: (path: string, providedDb?: any): CollectionReference<DocumentData> => {
    return collection(validateDb(providedDb), path);
  },

  doc: (path: string, ...segments: string[]): DocumentReference<DocumentData> => {
    return doc(validateDb(), path, ...segments);
  },

  add: async (path: string, data: any) => {
    const colRef = collection(validateDb(), path);
    return addDoc(colRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  update: async (path: string, id: string, data: any) => {
    const docRef = doc(validateDb(), path, id);
    return updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  set: async (path: string, id: string, data: any, options = { merge: true }) => {
    const docRef = doc(validateDb(), path, id);
    return setDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    }, options);
  },

  get: async (path: string, id: string) => {
    const docRef = doc(validateDb(), path, id);
    return getDoc(docRef);
  }
};

// Mantemos as funções individuais para compatibilidade, mas agora usando o Service interno
export function safeCollection(db: any, path: string) { return FirestoreService.collection(path, db); }
export function safeDoc(db: any, path: string, ...segments: string[]) { return FirestoreService.doc(path, ...segments); }
