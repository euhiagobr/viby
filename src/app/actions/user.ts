'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { decryptCPF, encryptCPF, hashCPF, maskCPF } from '@/lib/crypto-utils';
import { validateCPF, validateUsername } from '@/lib/utils';
import { recordAuditLog } from './audit';

/**
 * Recupera o CPF real de um usuário através de descriptografia segura.
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
      return { success: true, cpf: decryptCPF(encryptedCpf) };
    }
    return { success: false, error: "Dados não encontrados." };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Finaliza o registro do usuário de forma atômica no Firestore.
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
        role: "user", // Garante o role para as security rules
        status: "Ativo",
        walletBalance: 0,
        totalXp: 50,
        level: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      transaction.set(userRef, userData, { merge: true });

      // 4. Salvar Dados Sensíveis
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

      return { success: true };
    });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Atualiza o CPF de um usuário seguindo o novo padrão.
 */
export async function updateUserCPF(userId: string, cpf: string) {
  try {
    const db = getAdminDb();
    const cleanCPF = cpf.replace(/\D/g, "");
    
    if (!validateCPF(cleanCPF)) throw new Error("CPF informado é inválido.");

    const cpfEncrypted = encryptCPF(cleanCPF);
    const cpfHash = hashCPF(cleanCPF);
    const cpfMasked = maskCPF(cleanCPF);

    await db.runTransaction(async (transaction) => {
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

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}