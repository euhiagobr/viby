'use client';

import { getFirestore, initializeFirestore, Firestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Gerenciamento estabilizado da instância do Firestore para o banco 'eventosviby'.
 * Utiliza um padrão Singleton resiliente para evitar múltiplas inicializações e o erro ca9 do SDK v11.
 */

const DATABASE_ID = "eventosviby";

let firestoreInstance: Firestore;

try {
  // Tenta recuperar a instância já inicializada para o banco nomeado
  firestoreInstance = getFirestore(app, DATABASE_ID);
} catch (e) {
  // Se não houver instância, inicializa uma nova
  // Usar initializeFirestore é mais seguro para bancos nomeados no App Router
  firestoreInstance = initializeFirestore(app, {}, DATABASE_ID);
}

export const db = firestoreInstance;
