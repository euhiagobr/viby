import { getFirestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Instância isomórfica do Firestore para o banco 'eventosviby'.
 * Funciona tanto no Client quanto no Server (Server Actions).
 */

export const db = getFirestore(app, "eventosviby");
