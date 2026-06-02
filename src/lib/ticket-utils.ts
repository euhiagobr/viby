import { query, where, getDocs, Firestore } from "firebase/firestore";
import { safeCollection } from "./firestore-safe";

/**
 * Gera um código de ingresso padrão Viby: 16 caracteres alfanuméricos em blocos de 4.
 * Exemplo: ABCD-1234-EFGH-5678
 */
export const generateTicketCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code.match(/.{1,4}/g)?.join('-') || code;
};

/**
 * Tenta gerar um código único garantindo que não exista duplicidade na coleção registrations.
 */
export const generateUniqueTicketCode = async (db: Firestore): Promise<string> => {
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    const code = generateTicketCode();
    const q = query(safeCollection(db, "registrations"), where("ticketCode", "==", code));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return code;
    }
    attempts++;
  }

  throw new Error("Não foi possível gerar um código único após múltiplas tentativas.");
};
