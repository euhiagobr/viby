'use client';

import { getFirestore, Firestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Gerenciamento simplificado e estável da instância do Firestore.
 * Garante que o banco 'eventosviby' seja instanciado corretamente e exportado como singleton.
 */

const DATABASE_ID = "eventosviby";

// Exportamos a instância diretamente. O Firebase SDK gerencia internamente 
// a persistência da instância única por ID de banco de dados.
export const db = getFirestore(app, DATABASE_ID);
