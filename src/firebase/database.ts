import { getFirestore, Firestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Instância isomórfica do Firestore para o banco 'eventosviby'.
 * Utiliza um padrão de inicialização segura para evitar múltiplas instâncias ou erros de contexto.
 */

let firestoreInstance: Firestore | null = null;

export const db = (() => {
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(app, "eventosviby");
  }
  return firestoreInstance;
})();
