import { getFirestore, Firestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Instância isomórfica do Firestore.
 * Utiliza automaticamente o banco de dados padrão (default) do projeto Firebase configurado.
 */

let firestoreInstance: Firestore | null = null;

export const db = (() => {
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(app);
  }
  return firestoreInstance;
})();