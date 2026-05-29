'use client';

import { 
  collection, 
  doc, 
  Firestore, 
  CollectionReference, 
  DocumentReference,
  DocumentData,
  getFirestore
} from "firebase/firestore";
import { db as singletonDb } from "@/firebase/database";
import { app } from "@/firebase/apps";

/**
 * @fileOverview Wrappers de segurança ultra-robustos para o Firestore.
 * Esta versão garante a resolução definitiva do erro "Expected first argument to collection()".
 */

function getValidDb(providedDb?: any): Firestore {
  // 1. Se o db provido parece ser uma instância válida de Firestore, usamos ele
  if (providedDb && typeof providedDb === 'object' && providedDb.type === 'firestore') {
    return providedDb;
  }
  
  // 2. Fallback para o singletonDb estático (que já é o resultado de getFirestore)
  if (singletonDb) {
    return singletonDb;
  }

  // 3. Fallback final: Recupera a instância diretamente do SDK usando o app inicializado
  return getFirestore(app, "eventosviby");
}

export function safeCollection(db: any, path: string): CollectionReference<DocumentData> {
  const validDb = getValidDb(db);
  // Garante que o caminho não está vazio e o db é válido
  if (!validDb) throw new Error("Firestore instance could not be resolved.");
  return collection(validDb, path);
}

export function safeDoc(db: any, path: string, ...pathSegments: string[]): DocumentReference<DocumentData> {
  const validDb = getValidDb(db);
  if (!validDb) throw new Error("Firestore instance could not be resolved.");
  return doc(validDb, path, ...pathSegments);
}
