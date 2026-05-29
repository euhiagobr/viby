'use client';

import { 
  collection, 
  doc, 
  Firestore, 
  CollectionReference, 
  DocumentReference,
  DocumentData,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc
} from "firebase/firestore";
import { logSystemError } from "./error-manager";

/**
 * @fileOverview Wrappers seguros para o Firestore SDK.
 * Garante que o banco de dados seja uma instância válida antes de qualquer operação.
 * Integração profunda com o ErrorManager para rastreio de falhas de inicialização.
 */

function validateFirestore(db: any): db is Firestore {
  const isValid = !!db && typeof db === 'object' && (db.type === 'firestore' || !!db._databaseId || !!db.firestore);
  if (!isValid) {
    console.error("[Firestore Safe] Erro: Tentativa de uso do Firestore com instância inválida.", db);
  }
  return isValid;
}

export function safeCollection(db: Firestore | null, path: string): CollectionReference<DocumentData> {
  if (!validateFirestore(db)) {
    const error = new Error(`Falha crítica: collection() recebeu instância inválida para o caminho "${path}"`);
    throw error;
  }
  return collection(db, path);
}

export function safeDoc(db: Firestore | null, path: string, ...pathSegments: string[]): DocumentReference<DocumentData> {
  if (!validateFirestore(db)) {
    const error = new Error(`Falha crítica: doc() recebeu instância inválida para o caminho "${path}"`);
    throw error;
  }
  return doc(db, path, ...pathSegments);
}

// Helpers para operações comuns com tratamento de erro
export async function safeAddDoc(db: Firestore | null, path: string, data: any) {
  const coll = safeCollection(db, path);
  return addDoc(coll, data);
}

export async function safeUpdateDoc(db: Firestore | null, path: string, id: string, data: any) {
  const docRef = safeDoc(db, path, id);
  return updateDoc(docRef, data);
}

export async function safeGetDoc(db: Firestore | null, path: string, id: string) {
  const docRef = safeDoc(db, path, id);
  return getDoc(docRef);
}
