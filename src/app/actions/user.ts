
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { decryptCPF, encryptCPF, hashCPF, maskCPF } from '@/lib/crypto-utils';
import { validateCPF } from '@/lib/utils';
import { recordAuditLog } from './audit';

/**
 * Recupera o CPF real de um usuário através de descriptografia segura.
 * Ação exclusiva para o próprio usuário ou administradores globais.
 */
export async function getUserCPF(userId: string, requestingUid: string) {
  try {
    const db = getAdminDb();
    if (requestingUid !== userId) {
      const requesterSnap = await db.collection("users").doc(requestingUid).get();
      if (!requesterSnap.exists || requesterSnap.data()?.role !== 'admin') {
        throw new Error("Acesso negado.");
      }
    }

    const sensitiveRef = db.collection("users").doc(userId).collection("private").doc("sensitive");
    const sensitiveDoc = await sensitiveRef.get();
    
    if (sensitiveDoc.exists) {
      const encryptedCpf = sensitiveDoc.data()?.cpfEncrypted;
      await recordAuditLog({
        userId: requestingUid,
        action: 'cpf_view',
        category: 'profile',
        metadata: { targetUserId: userId },
        success: true
      });
      return { success: true, cpf: decryptCPF(encryptedCpf) };
    }
    return { success: false, error: "Dados não encontrados." };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Atualiza o CPF de um usuário seguindo o novo padrão de segurança Triplo (Encrypted, Hash, Masked).
 * Implementa verificação de duplicidade via hash.
 * Utiliza 'set' com merge para garantir funcionamento em novos cadastros.
 */
export async function updateUserCPF(userId: string, cpf: string) {
  try {
    const db = getAdminDb();
    const cleanCPF = cpf.replace(/\D/g, "");
    
    if (!validateCPF(cleanCPF)) {
      throw new Error("CPF informado é inválido.");
    }

    const cpfEncrypted = encryptCPF(cleanCPF);
    const cpfHash = hashCPF(cleanCPF);
    const cpfMasked = maskCPF(cleanCPF);

    await db.runTransaction(async (transaction) => {
      // 1. Verificar unicidade global via Hash
      const duplicateQuery = db.collection("users").where("cpfHash", "==", cpfHash).limit(1);
      const duplicateSnap = await transaction.get(duplicateQuery);
      
      const alreadyUsedByOther = duplicateSnap.docs.some(d => d.id !== userId);
      if (alreadyUsedByOther) {
        throw new Error("Este CPF já possui uma conta vinculada.");
      }

      // 2. Atualizar perfil público (Hash para busca, Masked para exibição)
      // Usar set com merge em vez de update para evitar falhas se o doc for novo
      transaction.set(db.collection("users").doc(userId), { 
        cpfHash,
        cpfMasked,
        cpf: cpfMasked, 
        needsCPFUpdate: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      }, { merge: true });

      // 3. Atualizar área restrita (Encrypted para recuperação/antifraude)
      const sensitiveRef = db.collection("users").doc(userId).collection("private").doc("sensitive");
      transaction.set(sensitiveRef, {
        cpfEncrypted,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    await recordAuditLog({
      userId,
      action: 'cpf_update',
      category: 'profile',
      success: true,
      metadata: { method: 'secure_triple_store' }
    });

    return { success: true };
  } catch (e: any) {
    console.error("[updateUserCPF Error]", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Localiza um usuário pelo hash do CPF.
 * Utilizado para fluxos de transferência sem expor dados.
 */
export async function findUserByCPF(cpf: string) {
  try {
    const db = getAdminDb();
    const hash = hashCPF(cpf);
    
    const q = db.collection("users").where("cpfHash", "==", hash).limit(1);
    const snap = await q.get();

    if (snap.empty) return { success: false, error: "Usuário não localizado." };

    const data = snap.docs[0].data();
    return { 
      success: true, 
      user: {
        uid: snap.docs[0].id,
        name: data.name,
        username: data.username,
        cpfMasked: data.cpfMasked
      }
    };
  } catch (e: any) {
    return { success: false, error: "Falha na busca técnica." };
  }
}
