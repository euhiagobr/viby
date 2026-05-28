'use client';

import { getFirestore, Firestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * Singleton para a instância do Firestore.
 * Garante que a conexão com o banco de dados 'eventosviby' seja única por sessão.
 */
let dbInstance: Firestore | null = null;

if (typeof window !== "undefined") {
  if (!dbInstance) {
    dbInstance = getFirestore(app, "eventosviby");
  }
} else {
  // No servidor, inicializa normalmente por requisição
  dbInstance = getFirestore(app, "eventosviby");
}

export const db = dbInstance!;
