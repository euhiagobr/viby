'use client';

import { 
  collection, 
  doc, 
  Firestore, 
  CollectionReference, 
  DocumentReference,
  DocumentData
} from "firebase/firestore";
import { logSystemError } from "./error-manager";

/**
 * @fileOverview Wrappers seguros para operações do Firestore.
 * Validam a instância do banco antes da execução para evitar erros de "Expected first argument...".
 */

function validateFirestore(db: any): db is Firestore {
  return !!db && typeof db === 'object' && (db.type === 'firestore' || !!db._databaseId);
}

export function safeCollection(db: Firestore | null, path: string): CollectionReference<DocumentData> {
  if (!validateFirestore(db)) {
    const error = new Error(`Falha crítica: Instância Firestore inválida ao acessar coleção "${path}"`);
    logSystemError({ 
      error, 
      type: 'firestore_validation_error', 
      severity: 'critical',
      metadata: { path, db_state: db ? 'invalid_object' : 'null' }
    });
    throw error;
  }
  return collection(db, path);
}

export function safeDoc(db: Firestore | null, path: string, ...pathSegments: string[]): DocumentReference<DocumentData> {
  if (!validateFirestore(db)) {
    const error = new Error(`Falha crítica: Instância Firestore inválida ao acessar documento "${path}"`);
    logSystemError({ 
      error, 
      type: 'firestore_validation_error', 
      severity: 'critical',
      metadata: { path, segments: pathSegments, db_state: db ? 'invalid_object' : 'null' }
    });
    throw error;
  }
  return doc(db, path, ...pathSegments);
}
