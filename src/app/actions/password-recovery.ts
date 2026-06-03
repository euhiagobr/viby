
'use server';

import { collection, query, where, getDocs, limit, getFirestore, addDoc, serverTimestamp, doc, updateDoc, Timestamp, getDoc as firestoreGetDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { maskEmail } from '@/lib/crypto-utils';
import { sendPasswordResetLinkEmail } from './email';
import { adminAuth } from '@/lib/firebase/admin';

/**
 * @fileOverview Recuperação de senha utilizando código numérico (OTP) e Admin SDK.
 */

async function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

/**
 * Solicita a recuperação de senha gerando um código OTP.
 */
export async function requestPasswordRecovery(identifier: string) {
  try {
    const db = await getDb();
    const inputClean = identifier.trim().toLowerCase();
    const isEmail = inputClean.includes("@");
    const searchField = isEmail ? "email" : "username";
    const searchValue = inputClean.replace('@', '');

    const q = query(collection(db, "users"), where(searchField, "==", searchValue), limit(1));
    const userSnap = await getDocs(q);
    
    if (userSnap.empty) {
      return { success: false, error: 'Usuário não localizado.' }; 
    }
    
    const userData = userSnap.docs[0].data();
    const targetEmail = userData.email;
    const userName = userData.name || userData.displayName || "Usuário";

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const resetRef = await addDoc(collection(db, "password_reset_codes"), {
      email: targetEmail,
      userId: userSnap.docs[0].id,
      code: otpCode,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false,
      attempts: 0
    });

    await sendPasswordResetLinkEmail({
      to: targetEmail,
      userName: userName,
      otpCode: otpCode
    });

    return { 
      success: true, 
      requestId: resetRef.id,
      maskedEmail: maskEmail(targetEmail) 
    };
  } catch (error: any) {
    console.error('[Recovery Action Error]', error);
    return { success: false, error: 'Erro ao processar solicitação.' };
  }
}

/**
 * Verifica se o código OTP informado é válido.
 */
export async function verifyRecoveryCode(requestId: string, code: string) {
  try {
    const db = await getDb();
    const resetRef = doc(db, "password_reset_codes", requestId);
    const resetSnap = await firestoreGetDoc(resetRef);

    if (!resetSnap.exists()) return { success: false, error: "Solicitação inválida." };

    const data = resetSnap.data();
    const now = new Date();
    const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

    if (data.used) return { success: false, error: "Este código já foi utilizado." };
    if (now > expiresAt) return { success: false, error: "Este código expirou." };
    if (data.code !== code) {
      await updateDoc(resetRef, { attempts: (data.attempts || 0) + 1 });
      return { success: false, error: "Código incorreto." };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: "Erro na validação do código." };
  }
}

/**
 * Redefine a senha utilizando o Admin SDK para atualizar o Firebase Auth.
 */
export async function resetPasswordWithCode(requestId: string, code: string, password: string) {
  try {
    const db = await getDb();
    const resetRef = doc(db, "password_reset_codes", requestId);
    const resetSnap = await firestoreGetDoc(resetRef);

    if (!resetSnap.exists()) return { success: false, error: "Sessão expirada." };
    const resetData = resetSnap.data();

    if (resetData.code !== code || resetData.used) {
      return { success: false, error: "Código inválido ou já utilizado." };
    }

    const userId = resetData.userId;
    if (!userId) {
       return { success: false, error: "Dados do usuário corrompidos." };
    }

    // 1. Atualiza a senha no Firebase Auth via Admin SDK
    await adminAuth.updateUser(userId, {
      password: password
    });

    // 2. Marca código como usado no Firestore
    await updateDoc(resetRef, { 
      used: true, 
      usedAt: serverTimestamp() 
    });

    return { success: true };
  } catch (error: any) {
    console.error("[Admin Auth Reset Error]", error.message);
    return { success: false, error: "Falha técnica ao atualizar senha no servidor." };
  }
}
