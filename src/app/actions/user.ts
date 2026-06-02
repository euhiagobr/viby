'use server';

import { db } from '@/firebase/database';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { decryptData, encryptDeterministic } from '@/lib/crypto-utils';

/**
 * @fileOverview Server Actions para manipulação de dados sensíveis utilizando o Client SDK de forma isomórfica.
 */

/**
 * Recupera o CPF descriptografado de um usuário.
 */
export async function getUserCPF(userId: string, requestingUid: string) {
  try {
    // Verificação de permissão básica
    if (requestingUid !== userId) {
      const requesterSnap = await getDoc(doc(db, "users", requestingUid));
      if (!requesterSnap.exists() || requesterSnap.data()?.role !== 'admin') {
        throw new Error("Acesso negado.");
      }
    }

    const sensitiveRef = doc(db, "users", userId, "private", "sensitive");
    const sensitiveDoc = await getDoc(sensitiveRef);
    
    if (sensitiveDoc.exists()) {
      const encryptedCpf = sensitiveDoc.data()?.cpf;
      // Retorna o CPF descriptografado apenas para o dono ou admin
      return { success: true, cpf: decryptData(encryptedCpf) };
    }
    
    return { success: false, error: "Dados não encontrados." };
  } catch (e: any) {
    console.error("[getUserCPF Error]", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Salva ou atualiza o CPF criptografado na subcoleção privada.
 */
export async function updateUserCPF(userId: string, cpf: string) {
  try {
    const encryptedCpf = encryptDeterministic(cpf);
    const sensitiveRef = doc(db, "users", userId, "private", "sensitive");
    
    await setDoc(sensitiveRef, {
      cpf: encryptedCpf,
      updatedAt: serverTimestamp()
    }, { merge: true });

    return { success: true };
  } catch (e: any) {
    console.error("[updateUserCPF Error]", e.message);
    return { success: false, error: e.message };
  }
}
