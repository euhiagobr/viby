'use server';

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  getFirestore, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  Timestamp, 
  getDoc as firestoreGetDoc,
  writeBatch
} from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { maskEmail } from '@/lib/crypto-utils';
import { sendPasswordResetLinkEmail } from './email';
import { getAdminAuth } from '@/lib/firebase/admin';

/**
 * @fileOverview Ações de Recuperação de Senha por Código OTP.
 * Utiliza Admin SDK apenas para atualização final da senha.
 */

async function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

/**
 * Inicia o processo de recuperação enviando um código OTP de 6 dígitos.
 */
export async function requestPasswordRecovery(identifier: string) {
  try {
    const db = await getDb();
    const inputClean = identifier.trim().toLowerCase();
    const isEmail = inputClean.includes("@");
    
    let searchField = "username";
    let searchValue = inputClean.replace('@', '');

    if (isEmail) {
      searchField = "email";
      searchValue = inputClean;
    }

    // Busca usuário
    const q = query(collection(db, "users"), where(searchField, "==", searchValue), limit(1));
    const userSnap = await getDocs(q);
    
    // REGRA DE SEGURANÇA: Retorna sucesso genérico mesmo se não existir
    if (userSnap.empty) {
      return { success: true, maskedEmail: "seu e-mail" }; 
    }
    
    const userData = userSnap.docs[0].data();
    const targetEmail = userData.email;
    const userId = userSnap.docs[0].id;

    // LIMITE DE SOLICITAÇÃO: Máximo 3 por hora
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const rateQ = query(
      collection(db, "password_reset_codes"), 
      where("userId", "==", userId),
      where("createdAt", ">", Timestamp.fromDate(oneHourAgo))
    );
    const rateSnap = await getDocs(rateQ);
    if (rateSnap.size >= 3) {
      return { success: false, error: "Muitas solicitações. Tente novamente em uma hora." };
    }

    // Geração do código
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const resetRef = await addDoc(collection(db, "password_reset_codes"), {
      email: targetEmail,
      userId: userId,
      code: otpCode,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false,
      attempts: 0
    });

    await sendPasswordResetLinkEmail({
      to: targetEmail,
      userName: userData.name || userData.displayName || "Usuário",
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
 * Valida o código informado pelo usuário.
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
    
    // LIMITE DE TENTATIVAS: 10 validações por código
    if ((data.attempts || 0) >= 10) return { success: false, error: "Limite de tentativas excedido." };

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
 * Finaliza a redefinição atualizando a senha no Auth via Admin SDK.
 */
export async function resetPasswordWithCode(requestId: string, code: string, password: string) {
  try {
    const db = await getDb();
    const resetRef = doc(db, "password_reset_codes", requestId);
    const resetSnap = await firestoreGetDoc(resetRef);

    if (!resetSnap.exists()) return { success: false, error: "Sessão expirada." };
    const resetData = resetSnap.data();

    // Verificação de segurança final
    if (resetData.code !== code || resetData.used) {
      return { success: false, error: "Código inválido ou já utilizado." };
    }

    const userId = resetData.userId;
    
    // 1. Atualização no Firebase Auth via Admin SDK
    const adminAuth = getAdminAuth();
    await adminAuth.updateUser(userId, {
      password: password
    });

    // 2. Invalidação de todos os códigos do usuário
    const batch = writeBatch(db);
    const allCodesQ = query(collection(db, "password_reset_codes"), where("userId", "==", userId), where("used", "==", false));
    const allCodesSnap = await getDocs(allCodesQ);
    
    allCodesSnap.forEach(d => {
      batch.update(d.ref, { 
        used: true, 
        usedAt: serverTimestamp(),
        usedByRequestId: requestId 
      });
    });

    await batch.commit();

    return { success: true };
  } catch (error: any) {
    console.error("[Reset Password Final Error]:", error);
    return { success: false, error: `Falha ao atualizar senha: ${error.message}` };
  }
}
