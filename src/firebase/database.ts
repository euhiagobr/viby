'use client';

import { getFirestore, initializeFirestore, Firestore, getApps } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Gerenciamento ultra-estabilizado da instância do Firestore.
 * Utiliza o banco de dados isolado 'eventosviby'.
 * Implementa um Singleton resiliente para evitar múltiplas inicializações no App Router.
 */

const DATABASE_ID = "eventosviby";

let firestoreInstance: Firestore | null = null;

export function getVibyDb(): Firestore {
  if (firestoreInstance) return firestoreInstance;

  try {
    // Tenta obter a instância existente para evitar conflitos de inicialização múltipla
    firestoreInstance = getFirestore(app, DATABASE_ID);
  } catch (e) {
    // Se falhar (ex: instância não existe), inicializa de forma limpa
    firestoreInstance = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
    }, DATABASE_ID);
  }

  return firestoreInstance;
}

// Exporta o singleton como db para compatibilidade legada
export const db = getVibyDb();
