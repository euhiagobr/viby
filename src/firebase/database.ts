'use client';

import { getFirestore, Firestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Instância estável do Firestore para o banco 'eventosviby'.
 */

// Exporta a instância diretamente para ser um singleton real em ambos os ambientes
export const db = getFirestore(app, "eventosviby");
