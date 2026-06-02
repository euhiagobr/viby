import { getFirestore, Firestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Instância isomórfica do Firestore utilizando o banco padrão (default).
 * Garante que todas as consultas do app apontem para a mesma fonte de dados.
 */

let firestoreInstance: Firestore | null = null;

export const db = (() => {
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(app);
  }
  return firestoreInstance;
})();
