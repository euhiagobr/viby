'use client';

import { getFirestore, Firestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Singleton Definitivo do Firestore.
 * Garante que a instância 'eventosviby' seja exportada de forma síncrona e estável.
 * Este arquivo é a ÚNICA fonte da instância db para o cliente.
 */

const DATABASE_ID = "eventosviby";

// Inicialização imediata para evitar race conditions em hooks
const dbInstance: Firestore = getFirestore(app, DATABASE_ID);

export const db = dbInstance;
