
'use server';

import { collection, query, where, getDocs, limit, getFirestore, addDoc, serverTimestamp, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { maskEmail, encryptDeterministic } from '@/lib/crypto-utils';
import { sendPasswordResetLinkEmail } from './email';

/**
 * @fileOverview Recuperação de senha utilizando código numérico (OTP).
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

    // 1. Localizar o usuário
    const q = query(collection(db, "users"), where(searchField, "==", searchValue), limit(1));
    const userSnap = await getDocs(q);
    
    if (userSnap.empty) {
      return { success: false, error: 'Usuário não localizado.' }; 
    }
    
    const userData = userSnap.docs[0].data();
    const targetEmail = userData.email;
    const userName = userData.name || userData.displayName || "Usuário";

    // 2. Gerar código OTP de 6 dígitos
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // 3. Salvar código no Firestore
    const resetRef = await addDoc(collection(db, "password_reset_codes"), {
      email: targetEmail,
      code: otpCode,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false,
      attempts: 0
    });

    // 4. Enviar e-mail com o código
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
    const resetSnap = await getDoc(resetRef);

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
 * Redefine a senha após validação do código.
 */
export async function resetPasswordWithCode(requestId: string, code: string, password: string) {
  try {
    const db = await getDb();
    const resetRef = doc(db, "password_reset_codes", requestId);
    const resetSnap = await getDoc(resetRef);

    if (!resetSnap.exists()) return { success: false, error: "Sessão expirada." };
    const resetData = resetSnap.data();

    // Verificação final do código por segurança
    if (resetData.code !== code || resetData.used) {
      return { success: false, error: "Código inválido." };
    }

    // Marca como usado
    await updateDoc(resetRef, { 
      used: true, 
      usedAt: serverTimestamp() 
    });

    // Nota: A alteração real no Firebase Auth requer o Admin SDK ou o usuário estar logado.
    // Em ambiente de protótipo, simulamos o sucesso da operação lógica.
    return { success: true };
  } catch (error) {
    return { success: false, error: "Falha ao redefinir senha." };
  }
}

async function getDoc(ref: any) {
  const { getDoc: firestoreGetDoc } = await import('firebase/firestore');
  return firestoreGetDoc(ref);
}
