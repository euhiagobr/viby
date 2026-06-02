import { getFirestore, Firestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Instância isomórfica do Firestore.
 * Utiliza exclusivamente o banco de dados padrão (default) do projeto atual.
 */

let firestoreInstance: Firestore | null = null;

export const db = (() => {
  if (!firestoreInstance) {
    // getFirestore sem parâmetros adicionais usa o banco (default)
    firestoreInstance = getFirestore(app);
  }
  return firestoreInstance;
})();
