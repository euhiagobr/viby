
'use server';

import { db } from '@/firebase/database';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, limit, runTransaction } from 'firebase/firestore';
import { decryptData, encryptDeterministic, maskCPF } from '@/lib/crypto-utils';
import { recordAuditLog } from './audit';

/**
 * @fileOverview Server Actions para manipulação de dados sensíveis.
 * CORREÇÃO CRÍTICA 07: Unicidade de CPF garantida transacionalmente.
 */

export async function getUserCPF(userId: string, requestingUid: string) {
  try {
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
      await recordAuditLog({
        userId: requestingUid,
        action: 'cpf_view',
        category: 'profile',
        metadata: { targetUserId: userId },
        success: true
      });
      return { success: true, cpf: decryptData(encryptedCpf) };
    }
    return { success: false, error: "Dados não encontrados." };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Salva ou atualiza o CPF criptografado com verificação de unicidade atômica.
 */
export async function updateUserCPF(userId: string, cpf: string) {
  try {
    const cleanCPF = cpf.replace(/\D/g, "");
    if (cleanCPF.length !== 11) throw new Error("CPF Inválido.");

    const encryptedCpf = encryptDeterministic(cleanCPF);
    const masked = maskCPF(cleanCPF);

    // CORREÇÃO CRÍTICA 07: Transação para garantir unicidade real contra race conditions
    await runTransaction(db, async (transaction) => {
      // 1. Verifica se já existe o CPF mascarado na coleção users
      const q = query(collection(db, "users"), where("cpf", "==", masked), limit(1));
      const snap = await getDocs(q);
      
      const alreadyUsed = snap.docs.some(d => d.id !== userId);
      if (alreadyUsed) throw new Error("Este CPF já possui uma conta vinculada.");

      // 2. Grava o dado mascarado no perfil público (para busca de unicidade rápida)
      transaction.update(doc(db, "users", userId), { 
        cpf: masked, 
        updatedAt: serverTimestamp() 
      });

      // 3. Grava o dado real na subcoleção restrita
      const sensitiveRef = doc(db, "users", userId, "private", "sensitive");
      transaction.set(sensitiveRef, {
        cpf: encryptedCpf,
        updatedAt: serverTimestamp()
      }, { merge: true });
    });

    await recordAuditLog({
      userId,
      action: 'cpf_update',
      category: 'profile',
      success: true
    });

    return { success: true };
  } catch (e: any) {
    console.error("[updateUserCPF Error]", e.message);
    return { success: false, error: e.message };
  }
}
