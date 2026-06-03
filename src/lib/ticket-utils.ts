import { query, where, getDocs, Firestore, collection } from "firebase/firestore";

/**
 * Gera um código de ingresso padrão Viby: 16 caracteres alfanuméricos [A-Z0-9].
 * Formato visual: XXXX-XXXX-XXXX-XXXX
 */
export const generateTicketCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Aplica a formatação XXXX-XXXX-XXXX-XXXX
  const formatted = code.match(/.{1,4}/g)?.join('-') || code;
  return formatted.toUpperCase();
};

/**
 * Tenta gerar um código único garantindo que não exista duplicidade na coleção registrations.
 * Implementa a verificação de unicidade global exigida.
 */
export const generateUniqueTicketCode = async (db: Firestore): Promise<string> => {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateTicketCode();
    // Busca pelo campo ticketCode, conforme a nova regra (não usar como ID de documento)
    const q = query(collection(db, "registrations"), where("ticketCode", "==", code));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return code;
    }
    attempts++;
  }

  throw new Error("Falha ao gerar código único de ingresso. Limite de tentativas excedido.");
};
