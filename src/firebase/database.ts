'use client';

import { getFirestore, Firestore, getApps } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Gerenciamento ultra-estabilizado da instância do Firestore.
 * Singleton resiliente para garantir que o banco 'eventosviby' seja instanciado uma única vez.
 */

const DATABASE_ID = "eventosviby";

let firestoreInstance: Firestore | null = null;

function initializeVibyDb(): Firestore {
  if (typeof window === 'undefined') {
    // No servidor (SSR), retornamos a inicialização padrão
    return getFirestore(app, DATABASE_ID);
  }

  // No cliente, garantimos um singleton para evitar erros de inicialização múltipla (ca9)
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(app, DATABASE_ID);
  }
  return firestoreInstance;
}

export const db = initializeVibyDb();
