import { collection, query, where, getDocs, Firestore } from "firebase/firestore";

export const generateTicketCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code.match(/.{1,4}/g)?.join('-') || code;
};

export const generateUniqueTicketCode = async (db: Firestore): Promise<string> => {
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    const code = generateTicketCode();
    const q = query(collection(db, "registrations"), where("ticketCode", "==", code));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return code;
    }
    attempts++;
  }

  throw new Error("Não foi possível gerar um código único após múltiplas tentativas.");
};