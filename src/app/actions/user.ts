'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { decryptCPF, encryptCPF, hashCPF, maskCPF } from '@/lib/crypto-utils';
import { validateCPF, validateUsername } from '@/lib/utils';
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
 * Finaliza o registro do usuário de forma atômica no Firestore.
 * Garante a criação do perfil, índice de username, dados sensíveis e vínculo de afiliado.
 */
export async function finalizeUserRegistration(params: {
  uid: string;
  email: string;
  name: string;
  username: string;
  cpf: string;
  gender: string;
  referredBy?: string;
}) {
  const db = getAdminDb();
  const { uid, email, name, username, cpf, gender, referredBy } = params;
  
  const cleanCPF = cpf.replace(/\D/g, "");
  if (!validateCPF(cleanCPF)) throw new Error("CPF informado é inválido.");
  
  const normalizedUsername = username.toLowerCase().trim();
  if (!validateUsername(normalizedUsername)) throw new Error("Username inválido (mínimo 5 caracteres).");

  const cpfEncrypted = encryptCPF(cleanCPF);
  const cpfHash = hashCPF(cleanCPF);
  const cpfMasked = maskCPF(cleanCPF);

  try {
    return await db.runTransaction(async (transaction) => {
      // 1. Verificar unicidade do Username
      const usernameRef = db.collection("usernames").doc(normalizedUsername);
      const usernameSnap = await transaction.get(usernameRef);
      if (usernameSnap.exists && usernameSnap.data()?.uid !== uid) {
        throw new Error("Este @username já está sendo usado.");
      }

      // 2. Verificar unicidade do CPF via Hash
      const duplicateQuery = db.collection("users").where("cpfHash", "==", cpfHash).limit(1);
      const duplicateSnap = await transaction.get(duplicateQuery);
      if (!duplicateSnap.empty && duplicateSnap.docs[0].id !== uid) {
        throw new Error("Este CPF já possui uma conta vinculada.");
      }

      // 3. Dados do Perfil Principal
      const userRef = db.collection("users").doc(uid);
      const expireAt = new Date();
      expireAt.setDate(expireAt.getDate() + 365);

      const userData = {
        uid,
        email: email.toLowerCase().trim(),
        name,
        username: normalizedUsername,
        gender,
        cpfHash,
        cpfMasked,
        cpf: cpfMasked, 
        referredBy: referredBy || null,
        affiliateExpireAt: referredBy ? admin.firestore.Timestamp.fromDate(expireAt) : null,
        profileComplete: true,
        needsCPFUpdate: false,
        plan: "free",
        walletBalance: 0,
        totalXp: 50,
        level: 1,
        status: "Ativo",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      transaction.set(userRef, userData, { merge: true });

      // 4. Salvar Dados Sensíveis (Criptografados)
      const sensitiveRef = userRef.collection("private").doc("sensitive");
      transaction.set(sensitiveRef, {
        cpfEncrypted,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // 5. Atualizar Índice de Username
      transaction.set(usernameRef, {
        uid,
        type: 'user',
        email: email.toLowerCase().trim(),
        username: normalizedUsername
      });

      // 6. Incrementar Estatísticas do Afiliado
      if (referredBy) {
        const statsRef = db.collection("affiliate_stats").doc(referredBy);
        transaction.update(statsRef, {
          totalUsersReferred: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      return { success: true };
    });
  } catch (e: any) {
    console.error("[finalizeUserRegistration Error]", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Atualiza o CPF de um usuário seguindo o novo padrão de segurança Triplo.
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
      const duplicateQuery = db.collection("users").where("cpfHash", "==", cpfHash).limit(1);
      const duplicateSnap = await transaction.get(duplicateQuery);
      
      const alreadyUsedByOther = duplicateSnap.docs.some(d => d.id !== userId);
      if (alreadyUsedByOther) {
        throw new Error("Este CPF já possui uma conta vinculada.");
      }

      transaction.set(db.collection("users").doc(userId), { 
        cpfHash,
        cpfMasked,
        cpf: cpfMasked, 
        needsCPFUpdate: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      }, { merge: true });

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
