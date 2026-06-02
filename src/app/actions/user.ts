
'use server';

import { getAdminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { decryptData, encryptDeterministic } from '@/lib/crypto-utils';

/**
 * @fileOverview Server Actions para manipulação de dados sensíveis utilizando Admin SDK.
 */

/**
 * Recupera o CPF descriptografado de um usuário.
 */
export async function getUserCPF(userId: string, requestingUid: string) {
  try {
    const db = getAdminDb();
    
    // Verificação de permissão
    if (requestingUid !== userId) {
      const requesterSnap = await db.collection("users").doc(requestingUid).get();
      if (!requesterSnap.exists || requesterSnap.data()?.role !== 'admin') {
        throw new Error("Acesso negado.");
      }
    }

    const sensitiveDoc = await db.collection("users").doc(userId).collection("private").doc("sensitive").get();
    
    if (sensitiveDoc.exists) {
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
    const db = getAdminDb();
    const encryptedCpf = encryptDeterministic(cpf);
    const sensitiveRef = db.collection("users").doc(userId).collection("private").doc("sensitive");
    
    await sensitiveRef.set({
      cpf: encryptedCpf,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true };
  } catch (e: any) {
    console.error("[updateUserCPF Error]", e.message);
    return { success: false, error: e.message };
  }
}
