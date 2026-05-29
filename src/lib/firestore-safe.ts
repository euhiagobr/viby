'use client';

import { 
  collection, 
  doc, 
  Firestore, 
  CollectionReference, 
  DocumentReference,
  DocumentData,
  getDoc,
  updateDoc,
  addDoc
} from "firebase/firestore";
import { db as singletonDb } from "@/firebase/database";

/**
 * @fileOverview Wrappers de segurança para o Firestore.
 * Prioriza a instância estável do banco de dados para evitar erros de inicialização.
 */

function getValidDb(providedDb?: any): Firestore {
  // Se o db passado existir, usa ele. Caso contrário, usa o singleton garantido.
  // Removida a verificação de .type === 'firestore' que estava causando falhas de reconhecimento.
  if (providedDb) {
    return providedDb;
  }
  return singletonDb;
}

export function safeCollection(db: any, path: string): CollectionReference<DocumentData> {
  const validDb = getValidDb(db);
  return collection(validDb, path);
}

export function safeDoc(db: any, path: string, ...pathSegments: string[]): DocumentReference<DocumentData> {
  const validDb = getValidDb(db);
  return doc(validDb, path, ...pathSegments);
}

export async function safeAddDoc(db: any, path: string, data: any) {
  const coll = safeCollection(db, path);
  return addDoc(coll, data);
}

export async function safeUpdateDoc(db: any, path: string, id: string, data: any) {
  const docRef = safeDoc(db, path, id);
  return updateDoc(docRef, data);
}

export async function safeGetDoc(db: any, path: string, id: string) {
  const docRef = safeDoc(db, path, id);
  return getDoc(docRef);
}
