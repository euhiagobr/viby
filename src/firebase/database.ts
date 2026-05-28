'use client';

import { initializeFirestore, Firestore, getFirestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Gerenciamento ultra-seguro da instância do Firestore.
 * Implementa um Singleton que evita a re-inicialização do banco de dados 'eventosviby',
 * causa principal do erro INTERNAL ASSERTION FAILED (ca9) no Next.js 15.
 */

const DATABASE_NAME = "eventosviby";

function getDbInstance(): Firestore {
  // No servidor, criamos uma nova instância por requisição
  if (typeof window === "undefined") {
    return getFirestore(app, DATABASE_NAME);
  }

  // No cliente, persistimos a instância globalmente para evitar o erro de asserção ca9
  // @ts-ignore
  if (!globalThis.__VIBY_FIRESTORE_INSTANCE__) {
    try {
      // Usar initializeFirestore com configurações vazias é mais estável para bancos nomeados no v11
      // @ts-ignore
      globalThis.__VIBY_FIRESTORE_INSTANCE__ = initializeFirestore(app, {}, DATABASE_NAME);
    } catch (e) {
      // Se já estiver inicializado por outro meio, recuperamos a instância existente
      // @ts-ignore
      globalThis.__VIBY_FIRESTORE_INSTANCE__ = getFirestore(app, DATABASE_NAME);
    }
  }

  // @ts-ignore
  return globalThis.__VIBY_FIRESTORE_INSTANCE__;
}

export const db = getDbInstance();
