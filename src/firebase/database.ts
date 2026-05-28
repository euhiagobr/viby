'use client';

import { getFirestore, Firestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Gerenciamento ultra-seguro da instância do Firestore.
 * Implementa um Singleton que evita a re-inicialização do banco de dados 'eventosviby',
 * causa principal do erro INTERNAL ASSERTION FAILED (ca9) no Next.js.
 */

const DATABASE_NAME = "eventosviby";

function getDbInstance(): Firestore {
  // No servidor, criamos uma nova instância por requisição
  if (typeof window === "undefined") {
    return getFirestore(app, DATABASE_NAME);
  }

  // No cliente, persistimos a instância globalmente para evitar o erro ca9
  // @ts-ignore
  if (!globalThis.__VIBY_FIRESTORE_DB__) {
    try {
      // @ts-ignore
      globalThis.__VIBY_FIRESTORE_DB__ = getFirestore(app, DATABASE_NAME);
    } catch (e) {
      console.error("[Firestore] Erro crítico na inicialização:", e);
      // Fallback seguro
      return getFirestore(app, DATABASE_NAME);
    }
  }

  // @ts-ignore
  return globalThis.__VIBY_FIRESTORE_DB__;
}

export const db = getDbInstance();
