'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { decryptData, encryptDeterministic, maskCPF } from '@/lib/crypto-utils';
import { recordAuditLog } from './audit';

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

export async function updateUserCPF(userId: string, cpf: string) {
  try {
    const db = getAdminDb();
    const cleanCPF = cpf.replace(/\D/g, "");
    if (cleanCPF.length !== 11) throw new Error("CPF Inválido.");

    const encryptedCpf = encryptDeterministic(cleanCPF);
    const masked = maskCPF(cleanCPF);

    await db.runTransaction(async (transaction) => {
      const q = db.collection("users").where("cpf", "==", masked).limit(1);
      const snap = await transaction.get(q);
      
      const alreadyUsed = snap.docs.some(d => d.id !== userId);
      if (alreadyUsed) throw new Error("Este CPF já possui uma conta vinculada.");

      transaction.update(db.collection("users").doc(userId), { 
        cpf: masked, 
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      });

      const sensitiveRef = db.collection("users").doc(userId).collection("private").doc("sensitive");
      transaction.set(sensitiveRef, {
        cpf: encryptedCpf,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
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