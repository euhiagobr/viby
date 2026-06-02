import { getFirestore, Firestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Instância isomórfica do Firestore utilizando o banco nomeado 'eventosviby'.
 */

let firestoreInstance: Firestore | null = null;

export const db = (() => {
  if (!firestoreInstance) {
    // Conecta explicitamente ao banco de dados solicitado pelo usuário
    firestoreInstance = getFirestore(app, "eventosviby");
  }
  return firestoreInstance;
})();
